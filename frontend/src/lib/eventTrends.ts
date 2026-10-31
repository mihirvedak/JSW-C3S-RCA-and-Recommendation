/**
 * Time windows and sample picks around one RCA event.
 *
 * Process trends cover a fixed window around the event. Laboratory samples come every one to
 * two hours (AFR about once a day), far too sparse for that window, so they are read from a
 * longer look-back and summarised as the last few samples taken at or before the event.
 */

import { extractSeries } from './series'
import type { Point, TimestampRow } from './series'
import { HOUR_MS, MINUTE_MS } from './time'

export const TREND_BEFORE_MS = HOUR_MS
export const TREND_AFTER_MS = 30 * MINUTE_MS

/** How far back laboratory samples are looked for. Long enough for four daily AFR samples. */
export const LAB_LOOKBACK_MS = 96 * HOUR_MS

export const SAMPLE_COUNT = 4

export interface EventWindow {
  start: number
  end: number
}

export function trendWindow(eventMs: number): EventWindow {
  return { start: eventMs - TREND_BEFORE_MS, end: eventMs + TREND_AFTER_MS }
}

export function labWindow(eventMs: number): EventWindow {
  return { start: eventMs - LAB_LOOKBACK_MS, end: eventMs }
}

/**
 * The part of the selected range to chart around an event when the range is longer than the
 * process data loaded at once: `spanMs` centred on the event, slid to stay inside the range.
 */
export function contextWindow(eventMs: number, range: EventWindow, spanMs: number): EventWindow {
  if (range.end - range.start <= spanMs) return { ...range }
  let start = Math.max(range.start, eventMs - spanMs / 2)
  const end = Math.min(range.end, start + spanMs)
  start = Math.max(range.start, end - spanMs)
  return { start, end }
}

/**
 * The selected range's rows with an event window's own rows spliced in: outside the window the
 * range rows are kept (thinned to 5 minutes on a long range), inside it every minute reading of
 * the event load replaces them. Oldest first.
 */
export function spliceRows(
  range: readonly TimestampRow[],
  detail: readonly TimestampRow[],
  w: EventWindow,
): TimestampRow[] {
  if (detail.length === 0) return [...range].sort((a, b) => a.t - b.t)
  return [...range.filter((r) => r.t < w.start || r.t > w.end), ...detail].sort((a, b) => a.t - b.t)
}

/** The last `n` readings of a sensor at or before `atMs`, newest first. */
export function lastSamples(
  rows: readonly TimestampRow[],
  sensorId: string,
  atMs: number,
  n = SAMPLE_COUNT,
): Point[] {
  return extractSeries(rows, sensorId)
    .filter((p) => p.t <= atMs)
    .slice(-n)
    .reverse()
}

/**
 * The reading in force at `atMs`: the newest one at or before it, if no older than
 * `maxAgeMs`. A process tag reports every minute, so anything older is a gap, not a value.
 */
export function valueAt(points: readonly Point[], atMs: number, maxAgeMs = 5 * MINUTE_MS): Point | null {
  let best: Point | null = null
  for (const p of points) {
    if (p.t > atMs) break
    best = p
  }
  return best && atMs - best.t <= maxAgeMs ? best : null
}
