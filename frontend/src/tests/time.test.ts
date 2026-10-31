import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  HOUR_MS,
  formatAxisTick,
  parsePlantTime,
  wallClockToEpoch,
} from '../lib/time'

describe('parsePlantTime', () => {
  it('reads a zone-less insight timestamp as plant-local time', () => {
    // 15:01 in Asia/Kolkata (+05:30) is 09:31 UTC.
    expect(parsePlantTime('2026-08-27 15:01:00')).toBe(Date.parse('2026-08-27T09:31:00Z'))
  })

  it('agrees with the picker conversion, so events and the axis share one zone', () => {
    expect(parsePlantTime('2026-08-27 15:01:00')).toBe(wallClockToEpoch('2026-08-27T15:01'))
  })

  it('accepts the date-time forms the platform emits', () => {
    const want = Date.parse('2025-08-01T11:22:00Z')
    expect(parsePlantTime('2025-08-01 16:52:00')).toBe(want)
    expect(parsePlantTime('2025-08-01 16:52')).toBe(want)
    expect(parsePlantTime('2025-08-01T16:52:00')).toBe(want)
  })

  it('returns null for anything that is not a timestamp', () => {
    expect(parsePlantTime(null)).toBeNull()
    expect(parsePlantTime('')).toBeNull()
    expect(parsePlantTime('not a time')).toBeNull()
    expect(parsePlantTime(12345)).toBeNull()
  })
})

describe('formatAxisTick', () => {
  const t = Date.parse('2026-08-27T09:31:00Z') // 15:01 IST

  it('shows the time alone inside a day', () => {
    expect(formatAxisTick(t, 6 * HOUR_MS)).toBe('15:01')
    expect(formatAxisTick(t, 24 * HOUR_MS)).toBe('15:01')
  })

  it('adds the date once the window is longer than a day, so ticks are not ambiguous', () => {
    expect(formatAxisTick(t, 3 * DAY_MS)).toBe('27 Aug 15:01')
  })

  it('shows the date alone for long windows', () => {
    expect(formatAxisTick(t, 30 * DAY_MS)).toBe('27 Aug')
  })
})
