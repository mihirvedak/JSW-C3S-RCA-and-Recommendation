/**
 * Device data for a whole line: the device-level routes of `deviceDataService`, run for every
 * device of a kind and merged into rows keyed by sensor key (`DEVICE:SENSOR`).
 *
 * The range route has no sensor filter (verified), so a device is always fetched whole; a line
 * that spreads its laboratory over six devices costs six requests per window. Rows from several
 * devices that share a timestamp are merged into one row; a device that did not report at an
 * instant is simply absent from that row's keys.
 *
 * Readings the line says are impossible (`LineModel.isImplausible`: predicted C3S above 50 %)
 * are dropped here, so no chart, table or figure downstream ever sees them.
 */

import type { LineModel } from '../config/lineModel'
import { sensorKey } from '../config/lineModel'
import { thinRows } from '../lib/series'
import type { TimestampRow } from '../lib/series'
import { fetchLatest, fetchRange, fetchRangeChunked } from './deviceDataService'
import type { ChunkedRange, LastReading } from './deviceDataService'

/** One device's bare-keyed rows as line rows, dropping the readings the line rejects. */
export function qualifyRows(line: LineModel, devID: string, rows: readonly TimestampRow[]): TimestampRow[] {
  const out: TimestampRow[] = []
  for (const r of rows) {
    const values: Record<string, number> = {}
    let any = false
    for (const [id, v] of Object.entries(r.values)) {
      const key = sensorKey(devID, id)
      if (line.isImplausible(key, v)) continue
      values[key] = v
      any = true
    }
    if (any) out.push({ t: r.t, values })
  }
  return out
}

/** Rows of several devices as one chronological list, merged at shared timestamps. */
export function mergeRows(parts: ReadonlyArray<readonly TimestampRow[]>): TimestampRow[] {
  if (parts.length === 1) return [...parts[0]].sort((a, b) => a.t - b.t)
  return thinRows(parts.flat(), 1)
}

/** Every reading of the given devices over a window (one request per device, in parallel). */
export async function fetchDevicesRange(
  line: LineModel,
  devIDs: readonly string[],
  startMs: number,
  endMs: number,
  signal?: AbortSignal,
): Promise<TimestampRow[]> {
  const parts = await Promise.all(devIDs.map(async (d) => qualifyRows(line, d, await fetchRange(d, startMs, endMs, signal))))
  return mergeRows(parts)
}

/** The chunked, capped, thinned load of `fetchRangeChunked`, for several devices at once. */
export async function fetchDevicesRangeChunked(
  line: LineModel,
  devIDs: readonly string[],
  startMs: number,
  endMs: number,
  opts: Parameters<typeof fetchRangeChunked>[3] = {},
): Promise<ChunkedRange> {
  const parts = await Promise.all(devIDs.map((d) => fetchRangeChunked(d, startMs, endMs, opts)))
  return {
    rows: mergeRows(parts.map((p, i) => qualifyRows(line, devIDs[i], p.rows))),
    fetchedStart: parts.length ? Math.min(...parts.map((p) => p.fetchedStart)) : startMs,
    capped: parts.some((p) => p.capped),
  }
}

/** Latest value per sensor key, across the devices the keys live on. */
export async function fetchLatestByKey(
  line: LineModel,
  keys: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, LastReading>> {
  const byDevice = new Map<string, string[]>()
  for (const k of keys) {
    const { devID, sensorId } = line.describe(k)
    byDevice.set(devID, [...(byDevice.get(devID) ?? []), sensorId])
  }
  const out = new Map<string, LastReading>()
  await Promise.all(
    [...byDevice].map(async ([devID, sensors]) => {
      const got = await fetchLatest(devID, sensors, signal)
      for (const [sensorId, r] of got) {
        const key = sensorKey(devID, sensorId)
        const value = r.value != null && line.isImplausible(key, r.value) ? null : r.value
        out.set(key, { sensorId: key, value, time: r.time })
      }
    }),
  )
  return out
}

/**
 * Newest timestamp carrying data for the line's C3S series (predicted and actual), on whichever
 * devices they live. The dashboard anchors its default window here instead of to `now`, so it
 * does not open on an empty range when the feed is behind.
 */
export async function fetchNewestC3S(line: LineModel, signal?: AbortSignal): Promise<number | null> {
  const latest = await fetchLatestByKey(line, [line.predictedC3S, line.actualC3S], signal)
  let newest: number | null = null
  for (const r of latest.values()) {
    if (r.time != null && (newest == null || r.time > newest)) newest = r.time
  }
  return newest
}
