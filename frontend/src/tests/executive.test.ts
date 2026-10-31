import { describe, expect, it } from 'vitest'
import { binLabel, histogram, histogramSet } from '../lib/histogram'
import { compliance, limitsAreOrdered } from '../lib/compliance'
import { completedShifts, formatShiftRange } from '../lib/shifts'
import type { ShiftDef } from '../lib/shifts'

describe('histogram', () => {
  it('bins into round-number, fixed-width bins', () => {
    const h = histogram([38.2, 38.9, 39.0, 39.5, 41.99], 1)
    expect(h.bins.map(binLabel)).toEqual(['38–39', '39–40', '40–41', '41–42'])
    expect(h.bins.map((b) => b.count)).toEqual([2, 2, 0, 1])
    expect(h.total).toBe(5)
  })

  it('puts a value on a bin edge in the bin that starts there', () => {
    const h = histogram([39.0], 1)
    expect(h.bins).toHaveLength(1)
    expect(h.bins[0]).toMatchObject({ from: 39, to: 40, count: 1 })
  })

  it('never drops the maximum when it sits exactly on an edge', () => {
    const h = histogram([38, 40], 1)
    expect(h.total).toBe(2)
    expect(h.bins.map((b) => b.count)).toEqual([1, 0, 1])
  })

  it('reports each bin as a share of all samples and the shares sum to 100', () => {
    const h = histogram([38.1, 38.2, 38.3, 39.1], 1)
    expect(h.bins[0].pct).toBeCloseTo(75, 6)
    expect(h.bins[1].pct).toBeCloseTo(25, 6)
    expect(h.bins.reduce((s, b) => s + b.pct, 0)).toBeCloseTo(100, 6)
  })

  it('supports other bin widths without float noise in the labels', () => {
    const h = histogram([39.1, 39.6, 40.2], 0.5)
    expect(h.bins.map(binLabel)).toEqual(['39–39.5', '39.5–40', '40–40.5'])
  })

  it('handles negatives and ignores non-finite values', () => {
    const h = histogram([-1.5, -0.2, Number.NaN, Infinity], 1)
    expect(h.total).toBe(2)
    expect(h.bins.map(binLabel)).toEqual(['-2–-1', '-1–0'])
  })

  it('has no bins for an empty dataset', () => {
    expect(histogram([], 1)).toEqual({ bins: [], total: 0 })
  })

  it('bins several datasets over one shared axis', () => {
    const { actual, predicted } = histogramSet({ actual: [38.5], predicted: [38.5, 41.5, 41.6] }, 1)
    expect(actual.bins.map(binLabel)).toEqual(predicted.bins.map(binLabel))
    expect(actual.bins.map((b) => b.count)).toEqual([1, 0, 0, 0])
    expect(predicted.bins.map((b) => b.count)).toEqual([1, 0, 0, 2])
    expect(actual.total).toBe(1)
    expect(predicted.total).toBe(3)
  })

  it('keeps an empty dataset empty while the other still has bins', () => {
    const { actual, predicted } = histogramSet({ actual: [] as number[], predicted: [39.2] }, 1)
    expect(actual.total).toBe(0)
    expect(actual.bins.every((b) => b.count === 0 && b.pct === 0)).toBe(true)
    expect(predicted.total).toBe(1)
  })
})

describe('compliance', () => {
  const limits = { lsl: 38, usl: 42 }

  it('splits samples into below, within and above', () => {
    const c = compliance([37, 38, 40, 42, 43, 44], limits)
    expect(c.n).toBe(6)
    expect(c.status).toBe('ok')
    expect(c.below).toBeCloseTo((1 / 6) * 100, 6)
    expect(c.within).toBeCloseTo((3 / 6) * 100, 6) // 38, 40 and 42 are within
    expect(c.above).toBeCloseTo((2 / 6) * 100, 6)
  })

  it('treats a value exactly on a limit as within specification', () => {
    const c = compliance([38, 42], limits)
    expect(c.within).toBe(100)
    expect(c.below).toBe(0)
    expect(c.above).toBe(0)
  })

  it('percentages sum to 100 over the valid samples', () => {
    const values = Array.from({ length: 37 }, (_, i) => 36 + i * 0.19)
    const c = compliance(values, limits)
    expect((c.below ?? 0) + (c.within ?? 0) + (c.above ?? 0)).toBeCloseTo(100, 6)
  })

  it('uses only valid samples as the denominator', () => {
    const c = compliance([40, Number.NaN, 39, Infinity], limits)
    expect(c.n).toBe(2)
    expect(c.within).toBe(100)
  })

  it('does not classify anything when no limit is configured', () => {
    const c = compliance([37, 40, 45], { lsl: null, usl: null })
    expect(c.status).toBe('no-limits')
    expect([c.below, c.within, c.above]).toEqual([null, null, null])
    expect(c.missing).toEqual(['lsl', 'usl'])
    expect(c.n).toBe(3)
  })

  it('reports the side that depends on a missing limit as unavailable', () => {
    const onlyUsl = compliance([40, 41, 43, 44], { lsl: null, usl: 42 })
    expect(onlyUsl.below).toBeNull()
    expect(onlyUsl.within).toBe(50) // "within" means not above the one limit that exists
    expect(onlyUsl.above).toBe(50)
    expect(onlyUsl.missing).toEqual(['lsl'])

    const onlyLsl = compliance([36, 37, 39, 40], { lsl: 38, usl: null })
    expect(onlyLsl.above).toBeNull()
    expect(onlyLsl.below).toBe(50)
    expect(onlyLsl.within).toBe(50)
    expect(onlyLsl.missing).toEqual(['usl'])
  })

  it('reports no data when limits exist but there are no samples', () => {
    const c = compliance([], limits)
    expect(c.status).toBe('no-data')
    expect(c.n).toBe(0)
    expect(c.within).toBeNull()
  })

  it('flags limits that are the wrong way round', () => {
    expect(limitsAreOrdered({ lsl: 38, usl: 42 })).toBe(true)
    expect(limitsAreOrdered({ lsl: 42, usl: 38 })).toBe(false)
    expect(limitsAreOrdered({ lsl: null, usl: 38 })).toBe(true)
  })
})

describe('completedShifts', () => {
  // The common three-shift pattern; the real definitions live in config/shifts.ts.
  const defs: ShiftDef[] = [
    { id: 'A', start: '06:00', end: '14:00' },
    { id: 'B', start: '14:00', end: '22:00' },
    { id: 'C', start: '22:00', end: '06:00' },
  ]
  const ist = (s: string) => Date.parse(`${s}+05:30`)

  it('returns the last two shifts that had finished, newest first', () => {
    // 15:30 on 28 Aug: B is in progress, so A (06–14) and C (22:00 27 Aug – 06:00) are the last two.
    const w = completedShifts(defs, ist('2026-08-28T15:30:00'))
    expect(w.map((x) => x.id)).toEqual(['A', 'C'])
    expect(w[0].start).toBe(ist('2026-08-28T06:00:00'))
    expect(w[0].end).toBe(ist('2026-08-28T14:00:00'))
    expect(w[1].start).toBe(ist('2026-08-27T22:00:00'))
    expect(w[1].end).toBe(ist('2026-08-28T06:00:00'))
  })

  it('never returns the shift that is still in progress', () => {
    const ref = ist('2026-08-28T15:30:00')
    for (const w of completedShifts(defs, ref, 3)) expect(w.end).toBeLessThanOrEqual(ref)
  })

  it('counts a shift as complete at its exact end', () => {
    const w = completedShifts(defs, ist('2026-08-28T14:00:00'))
    expect(w[0].id).toBe('A')
  })

  it('handles an overnight shift that ended earlier the same morning', () => {
    const w = completedShifts(defs, ist('2026-08-28T07:00:00'))
    expect(w.map((x) => x.id)).toEqual(['C', 'B'])
    expect(w[0].start).toBe(ist('2026-08-27T22:00:00'))
    expect(w[0].end).toBe(ist('2026-08-28T06:00:00'))
    expect(w[1].start).toBe(ist('2026-08-27T14:00:00'))
  })

  it('works across a month boundary', () => {
    const w = completedShifts(defs, ist('2026-09-01T07:00:00'))
    expect(w[0].start).toBe(ist('2026-08-31T22:00:00'))
    expect(w[0].end).toBe(ist('2026-09-01T06:00:00'))
  })

  it('uses the plant day, not the browser\'s, around midnight UTC', () => {
    // 20:00 UTC on 27 Aug is 01:30 on 28 Aug in the plant, during shift C.
    const w = completedShifts(defs, Date.parse('2026-08-27T20:00:00Z'))
    expect(w.map((x) => x.id)).toEqual(['B', 'A'])
    expect(w[0].end).toBe(ist('2026-08-27T22:00:00'))
  })

  it('gives contiguous shifts with no gap or overlap', () => {
    const w = completedShifts(defs, ist('2026-08-28T23:00:00'), 3)
    expect(w[0].start).toBe(w[1].end)
    expect(w[1].start).toBe(w[2].end)
  })

  it('follows other shift patterns', () => {
    const two: ShiftDef[] = [
      { id: 'Day', start: '08:00', end: '20:00' },
      { id: 'Night', start: '20:00', end: '08:00' },
    ]
    const w = completedShifts(two, ist('2026-08-28T10:00:00'))
    expect(w.map((x) => x.id)).toEqual(['Night', 'Day'])
  })

  it('formats the range in plant time, with both dates for an overnight shift', () => {
    const [a, c] = completedShifts(defs, ist('2026-08-28T15:30:00'))
    expect(formatShiftRange(a)).toBe('28 Aug, 06:00 – 14:00')
    expect(formatShiftRange(c)).toBe('27 Aug, 22:00 – 28 Aug, 06:00')
  })
})
