/**
 * Device data access: the platform's device-level routes, one device per call.
 *
 * Rows come back keyed by the device's bare sensor id (as the platform returns them). Everything
 * above this layer goes through `lineDataService`, which qualifies the keys as `DEVICE:SENSOR`
 * and merges the devices of a line, so nothing downstream is ever addressed by D-tag alone.
 */

import { ApiError, api } from './apiClient'
import { DAY_MS, MINUTE_MS, toEpochMs } from '../lib/time'
import { thinRows } from '../lib/series'
import { afterCutoff, clampEnd } from '../config/dataWindow'
import type { TimestampRow } from '../lib/series'

/**
 * A reading as a number. The platform normally sends numbers, but a laboratory or manual-entry feed
 * can send "61.2" as text; that is the same reading. Anything else ("NA", "", true, null) is no
 * reading. Never a guess: "61,2" or "61.2 %" stay unread rather than being cleaned up.
 */
export function asReading(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/* ------------------------------ latest values ------------------------------ */

export interface LastReading {
  sensorId: string
  value: number | null
  time: number | null
}

interface LastDpResponse {
  devID: string
  data: Record<string, { time?: unknown; value?: unknown } | unknown[]>
  isActive?: boolean
}

/**
 * Latest value per sensor. `PUT /api/account/deviceData/lastDP`.
 *
 * An empty array for a sensor means "no data recorded", which is reported as a null
 * value — distinct from a genuine reading of 0.
 */
export async function fetchLatest(
  devID: string,
  sensors: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, LastReading>> {
  const out = new Map<string, LastReading>()
  if (sensors.length === 0) return out

  const res = await api.put<LastDpResponse>(
    '/api/account/deviceData/lastDP',
    { devID, sensors: [...sensors] },
    signal,
  )

  for (const sensorId of sensors) {
    const entry = res?.data?.[sensorId]
    if (!entry || Array.isArray(entry)) {
      out.set(sensorId, { sensorId, value: null, time: null })
      continue
    }
    const value = asReading(entry.value)
    out.set(sensorId, { sensorId, value, time: toEpochMs(entry.time) })
  }

  return out
}

/* ------------------------------ time ranges ------------------------------ */

/**
 * Readings over a window. `GET /api/account/deviceData/getDataByStEt/:devID/:sTime/:eTime`.
 *
 * The route returns one object per distinct timestamp with a key per sensor that
 * reported at that instant; sensors that did not report are simply absent. That shape is
 * preserved — absent stays absent, and is never filled in.
 *
 * `sTime`/`eTime` are epoch milliseconds.
 */
export async function fetchRange(
  devID: string,
  startMs: number,
  requestedEndMs: number,
  signal?: AbortSignal,
): Promise<TimestampRow[]> {
  // Nothing after the configured cut-off is loaded (config/dataWindow.ts).
  const endMs = clampEnd(requestedEndMs)
  if (startMs >= endMs) return []
  const route =
    `/api/account/deviceData/getDataByStEt/${encodeURIComponent(devID)}` +
    `/${Math.round(startMs)}/${Math.round(endMs)}`

  const raw = await api.get<unknown>(route, signal)
  if (!Array.isArray(raw)) return []

  const rows: TimestampRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const t = toEpochMs(record.time)
    if (t == null || afterCutoff(t)) continue

    const values: Record<string, number> = {}
    for (const [key, value] of Object.entries(record)) {
      if (key === 'time') continue
      const n = asReading(value)
      if (n != null) values[key] = n
    }
    rows.push({ t, values })
  }

  // The route returns newest-first; downstream code assumes chronological order.
  return rows.sort((a, b) => a.t - b.t)
}

/** Below this span a chunk is not split further; a failure then is reported as it is. */
export const MIN_CHUNK_MS = 30 * MINUTE_MS

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

/**
 * One chunk, with the platform's failure modes handled: a gateway error (502/503/504), no response,
 * or a 2xx whose body was cut off (seen live on 2026-10-31 for the JSW DCS and clinker devices: HTTP
 * 200 with an empty body, and 502 with none). Those are transport failures that depend on the size
 * of the answer, so the chunk is split in half and each half asked for again, down to
 * `MIN_CHUNK_MS`; a half-hour that still fails is retried once and then reported as it is.
 * Anything else (a refusal, a session problem) is thrown at once.
 */
export async function fetchChunkResilient(
  devID: string,
  startMs: number,
  endMs: number,
  signal?: AbortSignal,
  depth = 0,
): Promise<TimestampRow[]> {
  try {
    return await fetchRange(devID, startMs, endMs, signal)
  } catch (err) {
    if (signal?.aborted || !(err instanceof ApiError) || !err.transient) throw err
    const span = endMs - startMs
    if (span > MIN_CHUNK_MS) {
      const mid = startMs + Math.floor(span / 2)
      const [a, b] = await Promise.all([
        fetchChunkResilient(devID, startMs, mid, signal, depth + 1),
        fetchChunkResilient(devID, mid, endMs, signal, depth + 1),
      ])
      return thinRows([...a, ...b], 1)
    }
    if (depth >= 0 && !(err as ApiError & { retried?: boolean }).retried) {
      await sleep(400, signal)
      try {
        return await fetchRange(devID, startMs, endMs, signal)
      } catch (again) {
        if (again instanceof ApiError) (again as ApiError & { retried?: boolean }).retried = true
        throw again
      }
    }
    throw err
  }
}

export interface ChunkedRange {
  rows: TimestampRow[]
  /** Start actually fetched. Later than the requested start when the span was capped. */
  fetchedStart: number
  /** True when the requested span exceeded `maxSpanMs` and the oldest part was dropped. */
  capped: boolean
}

/**
 * A dense device over a long window, fetched as parallel day-sized requests.
 *
 * A process device reports 100+ sensors every minute, so one request for a week is ~30 MB and
 * takes ~13 s — long enough for a gateway to give up, and heavy enough to freeze the page.
 * Day chunks run a few at a time, results are merged, and anything beyond `maxSpanMs` is
 * trimmed from the *old* end (the window's end is what the operator is looking at) and
 * reported through `capped` so the UI can say so instead of silently showing less.
 *
 * The route has no sensor or interval parameter (verified), so the only lever for the
 * client is `thinMs`: rows are merged into buckets of that size once received.
 */
export async function fetchRangeChunked(
  devID: string,
  startMs: number,
  requestedEndMs: number,
  opts: {
    chunkMs?: number
    concurrency?: number
    maxSpanMs?: number
    thinMs?: number
    signal?: AbortSignal
  } = {},
): Promise<ChunkedRange> {
  const {
    chunkMs = DAY_MS,
    concurrency = 4,
    maxSpanMs = 7 * DAY_MS,
    thinMs = 0,
    signal,
  } = opts
  // The cut-off first, so a long range ending after it keeps the newest days that have data
  // rather than the days past it.
  const endMs = clampEnd(requestedEndMs)

  // A minute of slack: a "7 days" preset is 7 days + 1 ms (the end is made inclusive), which
  // must not be reported as a shortened window.
  const capped = endMs - startMs > maxSpanMs + MINUTE_MS
  const from = capped ? endMs - maxSpanMs : startMs

  const chunks: Array<[number, number]> = []
  for (let s = from; s < endMs; s += chunkMs) chunks.push([s, Math.min(s + chunkMs, endMs)])

  const results: TimestampRow[][] = new Array(chunks.length)
  let next = 0
  async function worker() {
    while (next < chunks.length) {
      const i = next++
      results[i] = await fetchChunkResilient(devID, chunks[i][0], chunks[i][1], signal)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker))

  // Chunk edges can both report the same instant; merge rather than duplicate it.
  const merged = thinRows(results.flat(), 1)
  return {
    rows: thinMs > 0 ? thinRows(merged, thinMs) : merged,
    fetchedStart: from,
    capped,
  }
}

/** Bucket size used to thin dense process data once the window exceeds a day. */
export const PROCESS_THIN_MS = 5 * MINUTE_MS
