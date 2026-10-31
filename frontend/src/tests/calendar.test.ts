import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  calendarPresetRange,
  compareDays,
  daysInMonth,
  formatCompact,
  formatMdy,
  fromEpoch,
  gmtOffsetLabel,
  monthGrid,
  parseMdy,
  parseTime,
  toEpoch,
  today,
  weekday,
} from '../lib/calendar'

describe('month arithmetic', () => {
  it('knows month lengths, including leap years', () => {
    expect(daysInMonth(2026, 10)).toBe(31)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
  })

  it('shifts days across month and year boundaries', () => {
    expect(addDays({ y: 2026, m: 10, d: 31 }, 1)).toEqual({ y: 2026, m: 11, d: 1 })
    expect(addDays({ y: 2026, m: 1, d: 1 }, -1)).toEqual({ y: 2025, m: 12, d: 31 })
  })

  it('shifts months and keeps the month in 1–12', () => {
    expect(addMonths({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 })
    expect(addMonths({ y: 2026, m: 1 }, -1)).toEqual({ y: 2025, m: 12 })
  })

  it('orders days', () => {
    expect(compareDays({ y: 2026, m: 10, d: 22 }, { y: 2026, m: 10, d: 23 })).toBeLessThan(0)
    expect(compareDays({ y: 2026, m: 11, d: 1 }, { y: 2026, m: 10, d: 31 })).toBeGreaterThan(0)
    expect(compareDays({ y: 2026, m: 10, d: 22 }, { y: 2026, m: 10, d: 22 })).toBe(0)
  })
})

describe('monthGrid', () => {
  // October 2026 starts on a Thursday and has 31 days: the reference layout.
  const grid = monthGrid(2026, 10)

  it('lays the month out Sunday-first in rows of seven', () => {
    expect(weekday({ y: 2026, m: 10, d: 1 })).toBe(4) // Thursday
    expect(grid.every((w) => w.length === 7)).toBe(true)
    expect(grid[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(grid[0][4]).toEqual({ y: 2026, m: 10, d: 1 })
  })

  it('contains every day exactly once', () => {
    const days = grid.flat().filter((c) => c != null)
    expect(days).toHaveLength(31)
    expect(days.map((d) => d!.d)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
  })

  it('has 5 weeks for October 2026', () => {
    expect(grid).toHaveLength(5)
  })
})

describe('text forms', () => {
  it('formats and parses MM/DD/YYYY', () => {
    expect(formatMdy({ y: 2026, m: 10, d: 22 })).toBe('10/22/2026')
    expect(formatMdy({ y: 2026, m: 3, d: 5 })).toBe('03/05/2026')
    expect(parseMdy('10/22/2026')).toEqual({ y: 2026, m: 10, d: 22 })
    expect(parseMdy(' 3/5/2026 ')).toEqual({ y: 2026, m: 3, d: 5 })
  })

  it('rejects dates that do not exist', () => {
    expect(parseMdy('02/30/2026')).toBeNull()
    expect(parseMdy('13/01/2026')).toBeNull()
    expect(parseMdy('00/10/2026')).toBeNull()
    expect(parseMdy('10-22-2026')).toBeNull()
    expect(parseMdy('')).toBeNull()
    expect(parseMdy('2/29/2028')).not.toBeNull() // leap day
    expect(parseMdy('2/29/2026')).toBeNull()
  })

  it('parses 24-hour times only when real', () => {
    expect(parseTime('10:44')).toEqual({ h: 10, min: 44 })
    expect(parseTime('0:05')).toEqual({ h: 0, min: 5 })
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('10:60')).toBeNull()
    expect(parseTime('1044')).toBeNull()
  })
})

describe('day + time <-> instant, in plant time', () => {
  it('reads a picked day and time as plant wall-clock', () => {
    // 10:44 on 22 Oct 2026 in Asia/Kolkata (+05:30) is 05:14 UTC.
    expect(toEpoch({ y: 2026, m: 10, d: 22 }, '10:44')).toBe(Date.parse('2026-10-22T05:14:00Z'))
  })

  it('round-trips', () => {
    const ms = Date.parse('2026-08-28T06:45:00Z')
    const { day, time } = fromEpoch(ms)
    expect(day).toEqual({ y: 2026, m: 8, d: 28 })
    expect(time).toBe('12:15')
    expect(toEpoch(day, time)).toBe(ms)
  })

  it('puts an instant near midnight UTC on the plant\'s next day', () => {
    // 20:00 UTC on 22 Oct is 01:30 on 23 Oct in IST.
    expect(today(Date.parse('2026-10-22T20:00:00Z'))).toEqual({ y: 2026, m: 10, d: 23 })
  })

  it('returns null for an invalid time', () => {
    expect(toEpoch({ y: 2026, m: 10, d: 22 }, '25:00')).toBeNull()
  })
})

describe('calendarPresetRange', () => {
  // Fri 23 Oct 2026, 10:44 IST.
  const now = Date.parse('2026-10-23T05:14:00Z')
  const at = (iso: string) => Date.parse(iso)

  it('Today covers the plant\'s whole current day', () => {
    const r = calendarPresetRange('today', now)
    expect(r.start).toBe(at('2026-10-22T18:30:00Z')) // 00:00 IST 23 Oct
    expect(r.end).toBe(at('2026-10-23T18:29:59.999Z')) // 23:59:59.999 IST
  })

  it('Yesterday is the whole previous day', () => {
    const r = calendarPresetRange('yesterday', now)
    expect(r.start).toBe(at('2026-10-21T18:30:00Z'))
    expect(r.end).toBe(at('2026-10-22T18:29:59.999Z'))
  })

  it('This Week starts on the Sunday and runs to the end of today', () => {
    // 23 Oct 2026 is a Friday, so the week began Sunday 18 Oct.
    expect(weekday({ y: 2026, m: 10, d: 23 })).toBe(5)
    const r = calendarPresetRange('this_week', now)
    expect(r.start).toBe(at('2026-10-17T18:30:00Z')) // 00:00 IST 18 Oct
    expect(r.end).toBe(at('2026-10-23T18:29:59.999Z'))
  })

  it('This Month starts on the 1st and runs to the end of today', () => {
    const r = calendarPresetRange('this_month', now)
    expect(r.start).toBe(at('2026-09-30T18:30:00Z')) // 00:00 IST 1 Oct
    expect(r.end).toBe(at('2026-10-23T18:29:59.999Z'))
  })

  it('follows the plant\'s date, not the browser\'s, around midnight UTC', () => {
    // 20:00 UTC on 22 Oct is already 23 Oct in the plant.
    const r = calendarPresetRange('today', at('2026-10-22T20:00:00Z'))
    expect(r.start).toBe(at('2026-10-22T18:30:00Z'))
  })

  it('every range is forward in time', () => {
    for (const id of ['today', 'yesterday', 'this_week', 'this_month'] as const) {
      const r = calendarPresetRange(id, now)
      expect(r.end).toBeGreaterThan(r.start)
    }
  })
})

describe('labels', () => {
  it('shows the offset of the display zone', () => {
    expect(gmtOffsetLabel(Date.parse('2026-10-22T00:00:00Z'))).toBe('GMT+5:30')
  })

  it('formats a compact range end', () => {
    expect(formatCompact(Date.parse('2026-10-22T05:14:00Z'))).toBe('22 Oct, 10:44')
  })
})
