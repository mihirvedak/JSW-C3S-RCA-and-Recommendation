/**
 * Calendar and range logic for the time-range picker.
 *
 * Everything here works on plant wall-clock dates ({@link Ymd}) in DISPLAY_TIMEZONE, the
 * same zone as every axis label and timestamp, so "Today" means the plant's today and a
 * picked 14:00 is the 14:00 on the chart. A calendar date has no time zone of its own; the
 * conversion to an instant happens once, through `wallClockToEpoch`.
 */

import { DISPLAY_TIMEZONE, epochToWallClock, wallClockToEpoch } from './time'

/** A calendar day, month 1–12. */
export interface Ymd {
  y: number
  m: number
  d: number
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function sameDay(a: Ymd | null, b: Ymd | null): boolean {
  return a != null && b != null && a.y === b.y && a.m === b.m && a.d === b.d
}

/** Orders two days: negative when `a` is earlier. */
export function compareDays(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Day of week of a calendar day, 0 = Sunday. Independent of any time zone. */
export function weekday(day: Ymd): number {
  return new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()
}

/** A day shifted by whole days (negative goes back). */
export function addDays(day: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** A month shifted by whole months, normalised so m stays within 1–12. */
export function addMonths(view: { y: number; m: number }, n: number): { y: number; m: number } {
  const t = new Date(Date.UTC(view.y, view.m - 1 + n, 1))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 }
}

/**
 * The weeks of a month, Sunday first, as rows of seven cells. Cells outside the month are
 * null so the grid stays aligned without showing neighbouring months' days.
 */
export function monthGrid(y: number, m: number): Array<Array<Ymd | null>> {
  const lead = weekday({ y, m, d: 1 })
  const total = daysInMonth(y, m)
  const cells: Array<Ymd | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => ({ y, m, d: i + 1 })),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/* ---------------------------------------------------------------- *
 * Text forms
 * ---------------------------------------------------------------- */

/** "10/22/2026" — month first, as in the picker's date fields. */
export function formatMdy(day: Ymd): string {
  return `${pad(day.m)}/${pad(day.d)}/${pad(day.y, 4)}`
}

/** Parse "MM/DD/YYYY" (single-digit month/day allowed). Null unless it is a real date. */
export function parseMdy(text: string): Ymd | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text)
  if (!m) return null
  const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  return { y, m: mo, d }
}

/** Parse "HH:mm" (24-hour). Null unless it is a real time of day. */
export function parseTime(text: string): { h: number; min: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text)
  if (!m) return null
  const [h, min] = [Number(m[1]), Number(m[2])]
  return h > 23 || min > 59 ? null : { h, min }
}

/* ---------------------------------------------------------------- *
 * Day + time  <->  instant
 * ---------------------------------------------------------------- */

/** The instant for a plant wall-clock day and "HH:mm". Null when either is invalid. */
export function toEpoch(day: Ymd, time: string): number | null {
  const t = parseTime(time)
  if (!t) return null
  return wallClockToEpoch(`${pad(day.y, 4)}-${pad(day.m)}-${pad(day.d)}T${pad(t.h)}:${pad(t.min)}`)
}

/** The plant wall-clock day and "HH:mm" of an instant. */
export function fromEpoch(ms: number): { day: Ymd; time: string } {
  const wall = epochToWallClock(ms) // "YYYY-MM-DDTHH:mm"
  const [date, time] = wall.split('T')
  const [y, m, d] = date.split('-').map(Number)
  return { day: { y, m, d }, time }
}

/** The plant's current calendar day. */
export function today(nowMs: number): Ymd {
  return fromEpoch(nowMs).day
}

/* ---------------------------------------------------------------- *
 * Calendar presets (absolute, plant-local)
 * ---------------------------------------------------------------- */

export type CalendarPresetId = 'today' | 'yesterday' | 'this_week' | 'this_month'

export const CALENDAR_PRESETS: ReadonlyArray<{ id: CalendarPresetId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
]

/** Last millisecond of a minute: ranges end at "23:59" meaning the whole of that minute. */
const END_OF_MINUTE = 59_999

/**
 * The instants a calendar preset covers, from the start of its first day to the end of
 * its last, in plant time. A week runs Sunday to Saturday, matching the calendar grid; a
 * week or month ends at the end of today rather than in the future.
 */
export function calendarPresetRange(
  id: CalendarPresetId,
  nowMs: number,
): { start: number; end: number } {
  const t = today(nowMs)
  let first: Ymd
  let last: Ymd = t

  switch (id) {
    case 'today':
      first = t
      break
    case 'yesterday':
      first = addDays(t, -1)
      last = first
      break
    case 'this_week':
      first = addDays(t, -weekday(t))
      break
    case 'this_month':
      first = { y: t.y, m: t.m, d: 1 }
      break
  }

  // "00:00" and "23:59" are always valid, so these cannot be null.
  return {
    start: toEpoch(first, '00:00') as number,
    end: (toEpoch(last, '23:59') as number) + END_OF_MINUTE,
  }
}

/* ---------------------------------------------------------------- *
 * Labels
 * ---------------------------------------------------------------- */

/** "GMT+5:30" for DISPLAY_TIMEZONE at the given instant. */
export function gmtOffsetLabel(atMs: number = Date.now()): string {
  const part = new Intl.DateTimeFormat('en', {
    timeZone: DISPLAY_TIMEZONE,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(atMs)
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? DISPLAY_TIMEZONE
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** "22 Oct, 10:44" — the compact form shown on the picker button for a custom range. */
export function formatCompact(ms: number): string {
  const { day, time } = fromEpoch(ms)
  return `${day.d} ${SHORT_MONTHS[day.m - 1]}, ${time}`
}
