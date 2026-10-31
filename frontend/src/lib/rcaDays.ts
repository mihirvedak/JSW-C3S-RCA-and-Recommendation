/**
 * Plant days on which the RCA insight produced something to read: deviation events (each with
 * its root causes and recommendations) or shift summaries. They feed the date dropdown on the
 * Executive View's shift section, so only days with RCA content are offered.
 *
 * A day is a shift day: an event at 02:00 in the 22:00–06:00 shift belongs to the day that shift
 * started, as an operator reads the logbook.
 */

import type { RcaFinding, ShiftSummary } from '../services/rcaService'
import type { Ymd } from './calendar'
import { toEpoch } from './calendar'
import { dayKey, shiftAt } from './shifts'
import { DISPLAY_TIMEZONE } from './time'
import { RUN_AFTER_END_MS } from './shiftSummaries'
import type { ShiftDef, ShiftWindow } from './shifts'

export interface RcaDay {
  key: string
  day: Ymd
  events: number
  summaries: number
  /** The shifts of the day that hold an event or a summary, keyed by shift id + start. */
  shifts: Map<string, ShiftWindow>
}

const shiftKey = (w: ShiftWindow) => `${w.id}@${w.start}`

/**
 * A moment inside the shift a summary describes: its stated start; else just before its stated
 * end; else its stated time; else its run time, stepped back by the slack the matching rule
 * allows after a shift ends (`RUN_AFTER_END_MS`).
 */
function summaryMoment(s: ShiftSummary): number | null {
  if (s.start != null) return s.start
  if (s.end != null) return s.end - 1
  if (s.time != null) return s.time
  return s.invocationTime == null ? null : s.invocationTime - RUN_AFTER_END_MS
}

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: DISPLAY_TIMEZONE,
})

/** "18 Aug 2026" for a plant calendar day. */
export function formatDay(day: Ymd): string {
  const noon = toEpoch(day, '12:00')
  return noon == null ? dayKey(day) : dayFmt.format(noon)
}

/** Every day with RCA content, newest first. */
export function rcaDays(
  defs: readonly ShiftDef[],
  findings: readonly RcaFinding[],
  summaries: readonly ShiftSummary[],
): RcaDay[] {
  const days = new Map<string, RcaDay>()
  const add = (ms: number | null, kind: 'events' | 'summaries') => {
    if (ms == null) return
    const w = shiftAt(defs, ms)
    if (!w) return
    const key = dayKey(w.day)
    const entry = days.get(key) ?? { key, day: w.day, events: 0, summaries: 0, shifts: new Map() }
    entry[kind]++
    entry.shifts.set(shiftKey(w), w)
    days.set(key, entry)
  }
  for (const f of findings) add(f.eventTime, 'events')
  for (const s of summaries) add(summaryMoment(s), 'summaries')
  return [...days.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
}
