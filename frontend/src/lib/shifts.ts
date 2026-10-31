/**
 * Shift windows.
 *
 * A shift is a daily repeating window defined by plant wall-clock start and end times
 * ("22:00" to "06:00" runs overnight). Everything is resolved in DISPLAY_TIMEZONE through
 * the calendar helpers, so a shift boundary is the same instant as the 06:00 on the chart.
 *
 * "Completed" means the shift's end is at or before the reference time. A shift still in
 * progress at the reference time is never returned, so current-shift data is never mixed
 * with finished shifts.
 */

import { addDays, formatCompact, fromEpoch, toEpoch, today } from './calendar'
import type { Ymd } from './calendar'

export interface ShiftDef {
  /** Identifier shown to operators, e.g. "A". */
  id: string
  /** Plant wall-clock start, "HH:mm". */
  start: string
  /** Plant wall-clock end, "HH:mm". An end at or before the start means the next day. */
  end: string
}

export interface ShiftWindow {
  id: string
  /** Epoch ms of the first instant of the shift. */
  start: number
  /** Epoch ms of the end of the shift (exclusive). */
  end: number
  /** The plant calendar day the shift started on. */
  day: Ymd
}

/** Every instance of every shift that starts on `day`. */
function instancesOn(defs: readonly ShiftDef[], day: Ymd): ShiftWindow[] {
  const out: ShiftWindow[] = []
  for (const def of defs) {
    const start = toEpoch(day, def.start)
    const endsNextDay = def.end <= def.start
    const end = toEpoch(endsNextDay ? addDays(day, 1) : day, def.end)
    if (start == null || end == null) continue
    out.push({ id: def.id, start, end, day })
  }
  return out
}

/** The shifts that start on `day`, in start order. */
export function shiftsOnDay(defs: readonly ShiftDef[], day: Ymd): ShiftWindow[] {
  return instancesOn(defs, day).sort((a, b) => a.start - b.start)
}

/** The shift instance a moment falls in (an overnight shift belongs to the day it started). */
export function shiftAt(defs: readonly ShiftDef[], ms: number): ShiftWindow | null {
  const base = fromEpoch(ms).day
  for (const day of [base, addDays(base, -1)]) {
    const hit = instancesOn(defs, day).find((w) => ms >= w.start && ms < w.end)
    if (hit) return hit
  }
  return null
}

/** "2026-08-18": a stable key for a plant calendar day. */
export const dayKey = (d: Ymd) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`

/**
 * The most recent `count` shifts that had completed by `referenceMs`, newest first.
 *
 * The search covers the reference day and the three before it, which is enough for any
 * pattern of shifts no longer than 24 hours.
 */
export function completedShifts(
  defs: readonly ShiftDef[],
  referenceMs: number,
  count = 2,
): ShiftWindow[] {
  const base = today(referenceMs)
  const candidates: ShiftWindow[] = []
  for (let back = 0; back <= 3; back++) {
    candidates.push(...instancesOn(defs, addDays(base, -back)))
  }
  return candidates
    .filter((w) => w.end <= referenceMs)
    .sort((a, b) => b.end - a.end)
    .slice(0, count)
}

/** "22 Aug 22:00 – 23 Aug 06:00", or "22 Aug 06:00 – 14:00" within one day. */
export function formatShiftRange(w: ShiftWindow): string {
  const s = fromEpoch(w.start)
  const e = fromEpoch(w.end - 1) // the last minute inside the shift, for the end's date
  const sameDay = s.day.y === e.day.y && s.day.m === e.day.m && s.day.d === e.day.d
  const endClock = fromEpoch(w.end).time
  return sameDay
    ? `${formatCompact(w.start)} – ${endClock}`
    : `${formatCompact(w.start)} – ${formatCompact(w.end)}`
}
