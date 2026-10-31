/**
 * Series handling and prediction/actual sample matching.
 *
 * Two rules drive this file:
 *
 *   1. Laboratory measurements are never forward-filled, interpolated or resampled.
 *      A gap in the lab series is rendered as a gap. Only the points the lab actually
 *      reported exist.
 *
 *   2. A prediction is matched to a laboratory observation inside an explicit, named
 *      tolerance window. Anything outside it stays unmatched and is reported as such,
 *      rather than being snapped to the nearest timestamp.
 */

import { MINUTE_MS } from './time'

export interface Point {
  t: number
  v: number
}

/** Rows as returned by `getDataByStEt`: one object per timestamp, one key per sensor. */
export interface TimestampRow {
  t: number
  values: Readonly<Record<string, number>>
}

/**
 * Tolerance for pairing a prediction with a laboratory result.
 *
 * Observed cadence: predictions every 15 min, lab C3S roughly every 2 h at irregular
 * offsets. ±15 min keeps a pairing to the prediction tick that brackets the sample and
 * refuses anything looser. Configurable because it is a process convention, not a law.
 */
export const C3S_MATCH_TOLERANCE_MS = Number(
  import.meta.env.VITE_C3S_MATCH_TOLERANCE_MIN ?? 15,
) * MINUTE_MS

/**
 * Latest value per sensor within already-windowed rows.
 *
 * Used so every figure on the dashboard describes the selected window instead of "the
 * device's newest reading", which would ignore the time picker. A sensor with no value in
 * the window has no entry — absent stays absent.
 */
export function latestFromRows(
  rows: readonly TimestampRow[],
): Map<string, { value: number; time: number }> {
  const out = new Map<string, { value: number; time: number }>()
  for (const row of rows) {
    for (const [sensorId, value] of Object.entries(row.values)) {
      const cur = out.get(sensorId)
      if (!cur || row.t >= cur.time) out.set(sensorId, { value, time: row.t })
    }
  }
  return out
}

/**
 * Thin a dense series of rows to at most one row per `bucketMs`, merging the values of rows
 * that fall in the same bucket (later readings win). Absent sensors stay absent.
 */
export function thinRows(rows: readonly TimestampRow[], bucketMs: number): TimestampRow[] {
  if (bucketMs <= 0) return [...rows]
  const buckets = new Map<number, { t: number; values: Record<string, number> }>()
  // Chronological order so "later readings win" holds whatever order the caller used.
  for (const row of [...rows].sort((a, b) => a.t - b.t)) {
    const key = Math.floor(row.t / bucketMs)
    const cur = buckets.get(key)
    if (!cur) buckets.set(key, { t: row.t, values: { ...row.values } })
    else {
      cur.t = row.t
      Object.assign(cur.values, row.values)
    }
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t)
}

/** Extract one sensor's points from timestamp-grouped rows, dropping absent readings. */
export function extractSeries(rows: readonly TimestampRow[], sensorId: string): Point[] {
  const out: Point[] = []
  for (const row of rows) {
    const v = row.values[sensorId]
    if (typeof v === 'number' && Number.isFinite(v)) {
      out.push({ t: row.t, v })
    }
  }
  return dedupe(sortByTime(out))
}

export function sortByTime(points: readonly Point[]): Point[] {
  return [...points].sort((a, b) => a.t - b.t)
}

/**
 * Collapse duplicate timestamps, keeping the last occurrence.
 *
 * Duplicates do occur (a re-reported sample). Keeping the latest is the convention; the
 * count of collapsed rows is surfaced separately so it is visible rather than silent.
 */
export function dedupe(sorted: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const p of sorted) {
    const last = out[out.length - 1]
    if (last && last.t === p.t) out[out.length - 1] = p
    else out.push(p)
  }
  return out
}

export function countDuplicates(sorted: readonly Point[]): number {
  let n = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].t === sorted[i - 1].t) n++
  }
  return n
}

export interface MatchedSample {
  /** Laboratory sample time — always the original, never the prediction's time. */
  labTime: number
  actual: number
  /** Null when no prediction fell inside the tolerance window. */
  predicted: number | null
  predictedTime: number | null
  /** actual − predicted. Null when unmatched. */
  error: number | null
  /** Gap between the two timestamps, for showing timing uncertainty. */
  offsetMs: number | null
}

/**
 * Pair each laboratory C3S result with the nearest prediction inside the tolerance.
 *
 * Driven by the lab series: a prediction with no lab result yet is not a sample, it is
 * an outstanding prediction, and is reported separately by `unmatchedPredictions`.
 */
export function matchSamples(
  predicted: readonly Point[],
  actual: readonly Point[],
  toleranceMs: number = C3S_MATCH_TOLERANCE_MS,
): MatchedSample[] {
  const preds = sortByTime(predicted)
  return actual.map((lab) => {
    const near = nearestWithin(preds, lab.t, toleranceMs)
    return {
      labTime: lab.t,
      actual: lab.v,
      predicted: near?.v ?? null,
      predictedTime: near?.t ?? null,
      error: near ? lab.v - near.v : null,
      offsetMs: near ? lab.t - near.t : null,
    }
  })
}

/** Predictions with no laboratory result inside the tolerance — i.e. still awaiting one. */
export function unmatchedPredictions(
  predicted: readonly Point[],
  actual: readonly Point[],
  toleranceMs: number = C3S_MATCH_TOLERANCE_MS,
): Point[] {
  const labs = sortByTime(actual)
  return predicted.filter((p) => nearestWithin(labs, p.t, toleranceMs) == null)
}

/** Binary search for the closest point to `t`, or null if none is within `toleranceMs`. */
export function nearestWithin(
  sorted: readonly Point[],
  t: number,
  toleranceMs: number,
): Point | null {
  if (sorted.length === 0) return null

  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].t < t) lo = mid + 1
    else hi = mid
  }

  // `lo` is the first point at or after t; the best match is it or its predecessor.
  let best: Point | null = null
  for (const idx of [lo - 1, lo]) {
    const cand = sorted[idx]
    if (!cand) continue
    const d = Math.abs(cand.t - t)
    if (d <= toleranceMs && (best == null || d < Math.abs(best.t - t))) best = cand
  }
  return best
}

/* ---------------------------------------------------------------- *
 * Quality classification against the band retrieved from the RCA
 * insight. Thresholds are never hardcoded here.
 * ---------------------------------------------------------------- */

export type QualityState = 'low' | 'high' | 'in_band'

export interface Band {
  low: number
  high: number
}

export function classify(value: number, band: Band | null): QualityState | null {
  if (!band) return null
  if (value < band.low) return 'low'
  if (value > band.high) return 'high'
  return 'in_band'
}

/**
 * Points ready to chart, with a `null` inserted wherever two consecutive samples are more
 * than `maxGapMs` apart, so the plotted line breaks there instead of being drawn straight
 * across a period with no data.
 *
 * Highcharts core ignores `gapSize` (that is a Highstock option) but does break a line at a
 * null point, which is what this provides. The null sits midway between the two samples.
 * With `maxGapMs` null the series is returned unbroken.
 */
export function breakAtGaps(
  points: readonly Point[],
  maxGapMs: number | null,
): Array<[number, number | null]> {
  const out: Array<[number, number | null]> = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const prev = points[i - 1]
    if (prev && maxGapMs != null && p.t - prev.t > maxGapMs) {
      out.push([prev.t + (p.t - prev.t) / 2, null])
    }
    out.push([p.t, p.v])
  }
  return out
}

/** Largest gap between consecutive samples — used to describe irregular sampling. */
export function medianIntervalMs(points: readonly Point[]): number | null {
  if (points.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < points.length; i++) gaps.push(points[i].t - points[i - 1].t)
  gaps.sort((a, b) => a - b)
  const mid = gaps.length >> 1
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2)
}
