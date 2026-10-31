/**
 * Timestamp normalisation.
 *
 * The platform returns times in two shapes depending on route:
 *   - ISO-8601 strings ("2026-08-27T17:30:00.000Z")
 *   - epoch numbers, in seconds or milliseconds
 *
 * Everything inside the app is epoch milliseconds. Conversion happens once, here.
 */

/** Anything older than this as an epoch value must have been seconds, not ms. */
const SECONDS_CUTOFF = 1e11

export function toEpochMs(raw: unknown): number | null {
  if (raw == null) return null

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null
    // A 10-digit epoch is seconds; a 13-digit one is already milliseconds.
    return raw < SECONDS_CUTOFF ? Math.round(raw * 1000) : Math.round(raw)
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    // A purely numeric string is an epoch, not a date string.
    if (/^\d+$/.test(trimmed)) return toEpochMs(Number(trimmed))
    const parsed = Date.parse(trimmed)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

export interface TimeWindow {
  start: number
  end: number
}

export function windowEndingAt(end: number, spanMs: number): TimeWindow {
  return { start: end - spanMs, end }
}

/* ---------------------------------------------------------------- *
 * Formatting. A single timezone convention is applied everywhere so
 * lab sample times and process times are directly comparable.
 * ---------------------------------------------------------------- */

/** IANA zone used for every rendered timestamp. Plant-local by default. */
export const DISPLAY_TIMEZONE =
  (import.meta.env.VITE_DISPLAY_TIMEZONE as string | undefined) ?? 'Asia/Kolkata'

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: DISPLAY_TIMEZONE,
})

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: DISPLAY_TIMEZONE,
})

const fullFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: DISPLAY_TIMEZONE,
})

export function formatTime(ms: number | null): string {
  return ms == null ? '—' : timeFmt.format(ms)
}

export function formatDateTime(ms: number | null): string {
  return ms == null ? '—' : dateTimeFmt.format(ms)
}

/** "28 Aug 2026, 12:15" — the full stamp without the zone, for places that show the zone once. */
export function formatStamp(ms: number | null): string {
  return ms == null ? '—' : fullFmt.format(ms)
}

export function formatFull(ms: number | null): string {
  return ms == null ? '—' : `${fullFmt.format(ms)} (${DISPLAY_TIMEZONE})`
}

/* ---------------------------------------------------------------- *
 * Wall-clock conversion for the date/time picker.
 *
 * `<input type="datetime-local">` has no timezone: it yields a bare
 * "YYYY-MM-DDTHH:mm" that the browser treats as the *viewer's* local
 * time. Every timestamp on screen is rendered in DISPLAY_TIMEZONE, so
 * the picker is interpreted in that zone too — otherwise typing 14:00
 * would select a different instant than the 14:00 on the chart axis.
 * ---------------------------------------------------------------- */

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Offset of DISPLAY_TIMEZONE from UTC at a given instant, in ms. */
function zoneOffsetMs(instantMs: number): number {
  const parts = partsFmt.formatToParts(instantMs)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asIfUtc - instantMs
}

/**
 * Turn a picker value ("2026-08-28T06:45") into an epoch, reading it as a wall-clock
 * time in DISPLAY_TIMEZONE. Resolved twice so a zone with DST lands on the right side
 * of a transition; zones without DST converge on the first pass.
 */
export function wallClockToEpoch(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[]

  const naive = Date.UTC(y, mo - 1, d, h, mi)
  let epoch = naive - zoneOffsetMs(naive)
  epoch = naive - zoneOffsetMs(epoch)
  return Number.isFinite(epoch) ? epoch : null
}

/**
 * Parse a zone-less plant timestamp ("2026-08-27 15:01:00") as wall-clock time in
 * DISPLAY_TIMEZONE.
 *
 * The RCA insight reports its times this way, in plant-local time: for every result,
 * `batch_end` equals `invocationTime` (UTC) plus the plant's UTC offset. `Date.parse` would
 * read the string in the *browser's* zone instead and shift every event by that offset
 * relative to the lab samples, which carry explicit UTC instants.
 */
export function parsePlantTime(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  return wallClockToEpoch(raw)
}

/** Inverse: format an epoch as a picker value in DISPLAY_TIMEZONE. */
export function epochToWallClock(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return ''
  const parts = partsFmt.formatToParts(ms)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00'
  const hour = String(Number(get('hour')) % 24).padStart(2, '0')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  timeZone: DISPLAY_TIMEZONE,
})

/**
 * Axis tick label for a window of `spanMs`. A bare "14:00" is only unambiguous inside a
 * day; once the window is longer the date has to be on the label or two ticks read alike.
 */
export function formatAxisTick(ms: number, spanMs: number): string {
  if (spanMs <= 30 * HOUR_MS) return timeFmt.format(ms)
  if (spanMs <= 4 * DAY_MS) return `${dayFmt.format(ms)} ${timeFmt.format(ms)}`
  return dayFmt.format(ms)
}

/** Slack allowed for the UI clock's tick interval when comparing against `now`. */
const CLOCK_TOLERANCE_MS = 90_000

/** Human-readable age, used to mark stale readings rather than hiding them. */
export function formatAge(ms: number | null, now: number): string {
  if (ms == null) return 'no data'
  const delta = now - ms
  // The clock that supplies `now` ticks on an interval, so it can lag a timestamp taken
  // between ticks by up to that interval. Treat a small negative delta as "just now"
  // rather than claiming the reading is in the future.
  if (delta < 0) return delta > -CLOCK_TOLERANCE_MS ? 'just now' : 'in the future'
  if (delta < MINUTE_MS) return 'just now'
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)} min ago`
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)} h ago`
  return `${Math.floor(delta / DAY_MS)} d ago`
}
