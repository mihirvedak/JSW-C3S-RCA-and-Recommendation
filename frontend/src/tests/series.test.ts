import { describe, expect, it } from 'vitest'
import { DISPLAY_TIMEZONE, epochToWallClock, toEpochMs, wallClockToEpoch } from '../lib/time'
import {
  breakAtGaps,
  classify,
  countDuplicates,
  dedupe,
  extractSeries,
  latestFromRows,
  matchSamples,
  medianIntervalMs,
  nearestWithin,
  sortByTime,
  unmatchedPredictions,
  thinRows,
} from '../lib/series'
import type { Point, TimestampRow } from '../lib/series'

const MIN = 60_000

describe('toEpochMs', () => {
  it('passes through epoch milliseconds', () => {
    expect(toEpochMs(1_787_011_200_000)).toBe(1_787_011_200_000)
  })

  it('upconverts epoch seconds', () => {
    expect(toEpochMs(1_787_011_200)).toBe(1_787_011_200_000)
  })

  it('parses the ISO strings the platform returns', () => {
    expect(toEpochMs('2026-08-27T17:30:00.000Z')).toBe(Date.parse('2026-08-27T17:30:00.000Z'))
  })

  it('parses a numeric string as an epoch, not a date', () => {
    expect(toEpochMs('1787011200000')).toBe(1_787_011_200_000)
    expect(toEpochMs('1787011200')).toBe(1_787_011_200_000)
  })

  it('returns null for unusable input rather than a bogus date', () => {
    expect(toEpochMs(null)).toBeNull()
    expect(toEpochMs(undefined)).toBeNull()
    expect(toEpochMs('')).toBeNull()
    expect(toEpochMs('not a date')).toBeNull()
    expect(toEpochMs(0)).toBeNull()
    expect(toEpochMs(-5)).toBeNull()
    expect(toEpochMs([])).toBeNull()
  })
})

describe('time-range picker conversion', () => {
  // Default display zone is Asia/Kolkata (UTC+5:30), so 12:15 local is 06:45 UTC.
  it('reads a picker value as wall-clock time in the display zone', () => {
    expect(DISPLAY_TIMEZONE).toBe('Asia/Kolkata')
    expect(wallClockToEpoch('2026-08-28T12:15')).toBe(
      Date.parse('2026-08-28T06:45:00.000Z'),
    )
  })

  it('renders an epoch back into a picker value in the same zone', () => {
    expect(epochToWallClock(Date.parse('2026-08-28T06:45:00.000Z'))).toBe('2026-08-28T12:15')
  })

  it('round-trips without drift', () => {
    const original = '2026-08-18T00:00'
    expect(epochToWallClock(wallClockToEpoch(original))).toBe(original)
  })

  it('handles midnight, which must not wrap to hour 24', () => {
    const ms = wallClockToEpoch('2026-08-18T00:00')
    expect(ms).toBe(Date.parse('2026-08-17T18:30:00.000Z'))
    expect(epochToWallClock(ms)).toBe('2026-08-18T00:00')
  })

  it('rejects an incomplete or malformed value instead of guessing', () => {
    expect(wallClockToEpoch('')).toBeNull()
    expect(wallClockToEpoch('2026-08-18')).toBeNull()
    expect(wallClockToEpoch('not a date')).toBeNull()
  })

  it('returns an empty string for a null epoch so the input clears', () => {
    expect(epochToWallClock(null)).toBe('')
    expect(epochToWallClock(Number.NaN)).toBe('')
  })

  it('orders correctly across a range, so end > start compares as expected', () => {
    const a = wallClockToEpoch('2026-08-18T08:00')!
    const b = wallClockToEpoch('2026-08-18T20:00')!
    expect(b - a).toBe(12 * 60 * MIN)
  })
})

describe('extractSeries', () => {
  const rows: TimestampRow[] = [
    { t: 1000, values: { D55: 39.8, D58: 40.1 } },
    { t: 2000, values: { D55: 39.9 } }, // D58 absent — lab did not report
    { t: 3000, values: { D55: 40.0, D58: 39.5 } },
  ]

  it('pulls one sensor and skips timestamps where it did not report', () => {
    expect(extractSeries(rows, 'D55')).toEqual([
      { t: 1000, v: 39.8 },
      { t: 2000, v: 39.9 },
      { t: 3000, v: 40.0 },
    ])
    // The gap at t=2000 stays a gap — no forward fill of the previous lab value.
    expect(extractSeries(rows, 'D58')).toEqual([
      { t: 1000, v: 40.1 },
      { t: 3000, v: 39.5 },
    ])
  })

  it('returns nothing for a sensor that never reported', () => {
    expect(extractSeries(rows, 'D99')).toEqual([])
  })

  it('ignores non-numeric values', () => {
    const dirty = [{ t: 1, values: { D1: Number.NaN } }] as unknown as TimestampRow[]
    expect(extractSeries(dirty, 'D1')).toEqual([])
  })

  it('sorts out-of-order rows', () => {
    const unordered: TimestampRow[] = [
      { t: 3000, values: { D1: 3 } },
      { t: 1000, values: { D1: 1 } },
      { t: 2000, values: { D1: 2 } },
    ]
    expect(extractSeries(unordered, 'D1').map((p) => p.t)).toEqual([1000, 2000, 3000])
  })
})

describe('duplicate handling', () => {
  const dupes: Point[] = [
    { t: 1000, v: 1 },
    { t: 1000, v: 2 },
    { t: 2000, v: 3 },
  ]

  it('keeps the last value for a repeated timestamp', () => {
    expect(dedupe(sortByTime(dupes))).toEqual([
      { t: 1000, v: 2 },
      { t: 2000, v: 3 },
    ])
  })

  it('reports how many were collapsed so it is not silent', () => {
    expect(countDuplicates(sortByTime(dupes))).toBe(1)
    expect(countDuplicates([{ t: 1, v: 1 }])).toBe(0)
  })
})

describe('nearestWithin', () => {
  const pts: Point[] = [
    { t: 0, v: 0 },
    { t: 10 * MIN, v: 1 },
    { t: 30 * MIN, v: 2 },
  ]

  it('finds the closest point inside the tolerance', () => {
    expect(nearestWithin(pts, 12 * MIN, 15 * MIN)?.v).toBe(1)
    expect(nearestWithin(pts, 28 * MIN, 15 * MIN)?.v).toBe(2)
  })

  it('prefers the nearer of the two bracketing points', () => {
    expect(nearestWithin(pts, 19 * MIN, 60 * MIN)?.v).toBe(1)
    expect(nearestWithin(pts, 21 * MIN, 60 * MIN)?.v).toBe(2)
  })

  it('returns null outside the tolerance rather than snapping', () => {
    expect(nearestWithin(pts, 60 * MIN, 15 * MIN)).toBeNull()
    expect(nearestWithin([], 0, 15 * MIN)).toBeNull()
  })

  it('respects an exact boundary', () => {
    expect(nearestWithin(pts, 25 * MIN, 5 * MIN)?.v).toBe(2)
  })
})

describe('matchSamples', () => {
  // Predictions every 15 min, a lab result at an irregular offset — the real cadence.
  const predicted: Point[] = [
    { t: 0, v: 40.0 },
    { t: 15 * MIN, v: 39.8 },
    { t: 30 * MIN, v: 39.5 },
    { t: 45 * MIN, v: 39.2 },
  ]

  it('pairs a lab result with the prediction inside tolerance and keeps the lab time', () => {
    const actual: Point[] = [{ t: 17 * MIN, v: 40.3 }]
    const [m] = matchSamples(predicted, actual, 15 * MIN)

    expect(m.labTime).toBe(17 * MIN) // original lab timestamp, never the prediction's
    expect(m.actual).toBe(40.3)
    expect(m.predicted).toBe(39.8)
    expect(m.predictedTime).toBe(15 * MIN)
    expect(m.error).toBeCloseTo(0.5, 6)
    expect(m.offsetMs).toBe(2 * MIN)
  })

  it('leaves a lab result unmatched when no prediction is close enough', () => {
    const actual: Point[] = [{ t: 300 * MIN, v: 41.0 }]
    const [m] = matchSamples(predicted, actual, 15 * MIN)

    expect(m.actual).toBe(41.0)
    expect(m.predicted).toBeNull()
    expect(m.error).toBeNull()
    expect(m.offsetMs).toBeNull()
  })

  it('is driven by the lab series, one row per lab sample', () => {
    const actual: Point[] = [
      { t: 2 * MIN, v: 40.1 },
      { t: 32 * MIN, v: 39.4 },
    ]
    expect(matchSamples(predicted, actual, 15 * MIN)).toHaveLength(2)
  })

  it('handles an empty prediction series', () => {
    const [m] = matchSamples([], [{ t: 0, v: 40 }], 15 * MIN)
    expect(m.predicted).toBeNull()
  })

  it('identifies predictions still awaiting a lab result', () => {
    const actual: Point[] = [{ t: 2 * MIN, v: 40.1 }]
    const pending = unmatchedPredictions(predicted, actual, 15 * MIN)
    // t=0 and t=15min are within 15 min of the 2-min lab sample; 30 and 45 are not.
    expect(pending.map((p) => p.t)).toEqual([30 * MIN, 45 * MIN])
  })
})

describe('classify against the band', () => {
  const band = { low: 37.81, high: 41.88 }

  it('flags below, above and inside', () => {
    expect(classify(37.0, band)).toBe('low')
    expect(classify(42.5, band)).toBe('high')
    expect(classify(39.85, band)).toBe('in_band')
  })

  it('treats the limits as inclusive', () => {
    expect(classify(37.81, band)).toBe('in_band')
    expect(classify(41.88, band)).toBe('in_band')
  })

  it('returns null when no band was supplied, instead of assuming one', () => {
    expect(classify(39.0, null)).toBeNull()
  })
})

describe('medianIntervalMs', () => {
  it('reports the typical sampling gap', () => {
    expect(
      medianIntervalMs([
        { t: 0, v: 1 },
        { t: 15 * MIN, v: 1 },
        { t: 30 * MIN, v: 1 },
      ]),
    ).toBe(15 * MIN)
  })

  it('is null when there is nothing to measure', () => {
    expect(medianIntervalMs([])).toBeNull()
    expect(medianIntervalMs([{ t: 0, v: 1 }])).toBeNull()
  })
})

describe('latestFromRows', () => {
  it('returns the newest value per sensor inside the rows', () => {
    const rows: TimestampRow[] = [
      { t: 1000, values: { A: 1, B: 10 } },
      { t: 3000, values: { A: 3 } },
      { t: 2000, values: { A: 2, B: 20 } },
    ]
    const latest = latestFromRows(rows)
    expect(latest.get('A')).toEqual({ value: 3, time: 3000 })
    // B did not report in the newest row; its own newest reading stands, not a fill.
    expect(latest.get('B')).toEqual({ value: 20, time: 2000 })
  })

  it('has no entry for a sensor that never reported', () => {
    expect(latestFromRows([{ t: 1, values: { A: 1 } }]).has('B')).toBe(false)
    expect(latestFromRows([]).size).toBe(0)
  })
})

describe('thinRows', () => {
  it('keeps one row per bucket and merges the values inside it', () => {
    const rows: TimestampRow[] = [
      { t: 0, values: { A: 1 } },
      { t: 60_000, values: { B: 2 } },
      { t: 120_000, values: { A: 3 } },
      { t: 300_000, values: { A: 9 } },
    ]
    const out = thinRows(rows, 300_000)
    expect(out).toHaveLength(2)
    expect(out[0].values).toEqual({ A: 3, B: 2 }) // later reading wins; absent B is kept
    expect(out[0].t).toBe(120_000)
    expect(out[1].values).toEqual({ A: 9 })
  })

  it('is order-independent and does not mutate its input', () => {
    const rows: TimestampRow[] = [
      { t: 120_000, values: { A: 3 } },
      { t: 0, values: { A: 1 } },
    ]
    const copy = JSON.parse(JSON.stringify(rows))
    expect(thinRows(rows, 300_000)[0].values.A).toBe(3)
    expect(rows).toEqual(copy)
  })
})

describe('breakAtGaps', () => {
  const pts = (...ts: number[]): Point[] => ts.map((t, i) => ({ t, v: 40 + i }))

  it('returns the points unchanged when no gap exceeds the limit', () => {
    expect(breakAtGaps(pts(0, 10, 20), 15)).toEqual([[0, 40], [10, 41], [20, 42]])
  })

  it('inserts a null midway across a gap longer than the limit', () => {
    expect(breakAtGaps(pts(0, 10, 100, 110), 25)).toEqual([
      [0, 40],
      [10, 41],
      [55, null],
      [100, 42],
      [110, 43],
    ])
  })

  it('does not break exactly at the limit', () => {
    expect(breakAtGaps(pts(0, 25), 25)).toEqual([[0, 40], [25, 41]])
  })

  it('never interpolates: every value in the output is an original sample or null', () => {
    const out = breakAtGaps(pts(0, 100, 200, 1000), 150)
    const values = out.map((p) => p[1]).filter((v) => v != null)
    expect(values).toEqual([40, 41, 42, 43])
  })

  it('leaves the series unbroken when there is no limit', () => {
    expect(breakAtGaps(pts(0, 1_000_000), null).some((p) => p[1] === null)).toBe(false)
  })

  it('handles empty and single-point series', () => {
    expect(breakAtGaps([], 10)).toEqual([])
    expect(breakAtGaps(pts(5), 10)).toEqual([[5, 40]])
  })
})
