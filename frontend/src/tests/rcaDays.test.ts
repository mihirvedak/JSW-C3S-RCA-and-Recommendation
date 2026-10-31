import { describe, expect, it } from 'vitest'
import { SHIFTS } from '../config/shifts'
import { formatDay, rcaDays } from '../lib/rcaDays'
import { shiftAt, shiftsOnDay } from '../lib/shifts'
import { MINUTE_MS } from '../lib/time'
import type { RcaFinding, ShiftSummary } from '../services/rcaService'

const ist = (s: string) => Date.parse(`${s}+05:30`)
const event = (id: string, time: string) => ({ id, eventTime: ist(time) }) as RcaFinding
const summary = (over: Partial<ShiftSummary>) =>
  ({ id: 's', invocationTime: null, start: null, end: null, time: null, ...over }) as ShiftSummary

describe('shift days', () => {
  it('puts a night-shift moment on the day the shift started', () => {
    const w = shiftAt(SHIFTS, ist('2026-08-19T02:00:00'))
    expect([w?.id, w?.day]).toEqual(['C', { y: 2026, m: 8, d: 18 }])
    expect(shiftsOnDay(SHIFTS, { y: 2026, m: 8, d: 18 }).map((x) => x.id)).toEqual(['A', 'B', 'C'])
  })

  it('lists only days with RCA content, newest first, with their shifts', () => {
    const days = rcaDays(
      SHIFTS,
      [event('e1', '2026-08-18T13:01:00'), event('e2', '2026-08-18T19:30:00'), event('e3', '2026-08-19T02:00:00'), event('e4', '2026-08-16T09:00:00')],
      // Written 10 min after shift B of 17 Aug ended, stating nothing else.
      [summary({ invocationTime: ist('2026-08-17T22:10:00') })],
    )
    expect(days.map((d) => [d.key, d.events, d.summaries])).toEqual([
      ['2026-08-18', 3, 0],
      ['2026-08-17', 0, 1],
      ['2026-08-16', 1, 0],
    ])
    expect([...days[0].shifts.values()].map((w) => w.id).sort()).toEqual(['A', 'B', 'C'])
    expect([...days[1].shifts.values()].map((w) => w.id)).toEqual(['B'])
  })

  it('places a summary by the window or end it states', () => {
    const byEnd = rcaDays(SHIFTS, [], [summary({ end: ist('2026-08-18T14:00:00') })])
    expect([...byEnd[0].shifts.values()][0].id).toBe('A')
    const byStart = rcaDays(SHIFTS, [], [summary({ start: ist('2026-08-18T22:00:00'), invocationTime: ist('2026-08-19T06:00:00') + MINUTE_MS })])
    expect([byStart[0].key, [...byStart[0].shifts.values()][0].id]).toEqual(['2026-08-18', 'C'])
  })

  it('formats a day for the dropdown', () => {
    expect(formatDay({ y: 2026, m: 8, d: 18 })).toBe('18 Aug 2026')
  })
})
