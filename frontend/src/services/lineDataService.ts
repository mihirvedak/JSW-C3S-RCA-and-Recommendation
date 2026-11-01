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

/** What one device's load came to: how many rows it returned, or why it returned none. */
export interface DeviceOutcome {
  devID: string
  /** Rows the device returned in the window (before merging), or 0 on failure. */
  rows: number
  /** Newest row time the device returned in the window. */
  newest: number | null
  /** The platform's message when the device could not be read. */
  error: string | null
}

export interface DevicesRange {
  rows: TimestampRow[]
  outcomes: DeviceOutcome[]
}

export interface DevicesChunkedRange extends ChunkedRange {
  outcomes: DeviceOutcome[]
}

/** A device that failed is reported, not fatal; only every device failing is. */
class AllDevicesFailed extends Error {
  readonly outcomes: DeviceOutcome[]
  constructor(outcomes: DeviceOutcome[]) {
    super(
      outcomes.length === 1
        ? `${outcomes[0].devID}: ${outcomes[0].error}`
        : `None of the ${outcomes.length} devices could be read. ${outcomes.map((o) => `${o.devID}: ${o.error}`).join(' · ')}`,
    )
    this.name = 'AllDevicesFailed'
    this.outcomes = outcomes
  }
}

/** Run `fn` over the devices a few at a time: a line with eleven laboratory devices must not open 44 requests at once. */
async function perDevice<T>(
  devIDs: readonly string[],
  fn: (devID: string) => Promise<T>,
  signal: AbortSignal | undefined,
  concurrency = 3,
): Promise<Array<{ devID: string; value?: T; error?: string }>> {
  const out: Array<{ devID: string; value?: T; error?: string }> = new Array(devIDs.length)
  let next = 0
  async function worker() {
    while (next < devIDs.length) {
      const i = next++
      const devID = devIDs[i]
      try {
        out[i] = { devID, value: await fn(devID) }
      } catch (err) {
        if (signal?.aborted) throw err
        out[i] = { devID, error: err instanceof Error ? err.message : String(err) }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, devIDs.length) }, worker))
  return out
}

function outcome(devID: string, rows: readonly TimestampRow[] | null, error: string | null): DeviceOutcome {
  return {
    devID,
    rows: rows?.length ?? 0,
    newest: rows && rows.length ? Math.max(...rows.map((r) => r.t)) : null,
    error,
  }
}

/** Every reading of the given devices over a window (one request per device). */
export async function fetchDevicesRange(
  line: LineModel,
  devIDs: readonly string[],
  startMs: number,
  endMs: number,
  signal?: AbortSignal,
): Promise<TimestampRow[]> {
  return (await fetchDevicesRangeDetailed(line, devIDs, startMs, endMs, signal)).rows
}

/** As `fetchDevicesRange`, with each device's outcome. Throws only when every device failed. */
export async function fetchDevicesRangeDetailed(
  line: LineModel,
  devIDs: readonly string[],
  startMs: number,
  endMs: number,
  signal?: AbortSignal,
): Promise<DevicesRange> {
  const results = await perDevice(devIDs, (d) => fetchRange(d, startMs, endMs, signal), signal)
  const outcomes = results.map((r) => outcome(r.devID, r.value ?? null, r.error ?? null))
  if (devIDs.length && results.every((r) => r.error != null)) throw new AllDevicesFailed(outcomes)
  const parts = results.flatMap((r) => (r.value ? [qualifyRows(line, r.devID, r.value)] : []))
  return { rows: mergeRows(parts), outcomes }
}

/** The chunked, capped, thinned load of `fetchRangeChunked`, for several devices at once. */
export async function fetchDevicesRangeChunked(
  line: LineModel,
  devIDs: readonly string[],
  startMs: number,
  endMs: number,
  opts: Parameters<typeof fetchRangeChunked>[3] = {},
): Promise<DevicesChunkedRange> {
  const results = await perDevice(devIDs, (d) => fetchRangeChunked(d, startMs, endMs, opts), opts.signal)
  const outcomes = results.map((r) => outcome(r.devID, r.value?.rows ?? null, r.error ?? null))
  if (devIDs.length && results.every((r) => r.error != null)) throw new AllDevicesFailed(outcomes)
  const ok = results.flatMap((r) => (r.value ? [{ devID: r.devID, part: r.value }] : []))
  return {
    rows: mergeRows(ok.map(({ devID, part }) => qualifyRows(line, devID, part.rows))),
    fetchedStart: ok.length ? Math.min(...ok.map(({ part }) => part.fetchedStart)) : startMs,
    capped: ok.some(({ part }) => part.capped),
    outcomes,
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

/** Newest reading per listed sensor of every device, and per device the platform's answer or refusal. */
export async function fetchLatestByDevice(
  line: LineModel,
  signal?: AbortSignal,
): Promise<{ byKey: Map<string, LastReading>; outcomes: DeviceOutcome[] }> {
  const byKey = new Map<string, LastReading>()
  const outcomes: DeviceOutcome[] = []
  await Promise.all(
    line.devices.map(async (d) => {
      const sensors = d.sensors.map((s) => s.id)
      try {
        const got = await fetchLatest(d.devID, sensors, signal)
        let newest: number | null = null
        for (const [sensorId, r] of got) {
          const key = sensorKey(d.devID, sensorId)
          const value = r.value != null && line.isImplausible(key, r.value) ? null : r.value
          byKey.set(key, { sensorId: key, value, time: r.time })
          if (r.time != null && (newest == null || r.time > newest)) newest = r.time
        }
        outcomes.push({ devID: d.devID, rows: [...got.values()].filter((r) => r.time != null).length, newest, error: null })
      } catch (err) {
        if (signal?.aborted) throw err
        outcomes.push({ devID: d.devID, rows: 0, newest: null, error: err instanceof Error ? err.message : String(err) })
      }
    }),
  )
  return { byKey, outcomes }
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
