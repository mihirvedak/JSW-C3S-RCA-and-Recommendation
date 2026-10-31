/**
 * Global time range control.
 *
 * A "Time Range" dropdown that opens a panel with preset ranges on the left and, on the
 * right, editable start/end date and time fields with a month calendar for picking a range
 * by clicking.
 *
 * Two kinds of preset:
 *   - "Last 1 Hour … Last 7 Days" are relative to the newest sample on the device, not to
 *     the current time, so a lagging feed still shows data (the panel states the newest
 *     sample so this is never hidden).
 *   - "Today / Yesterday / This Week / This Month" are calendar ranges in the plant's time
 *     zone, taken literally from the current date.
 *
 * Choosing a preset applies it at once; the fields then show the range it resolved to and
 * can be edited, and Apply commits an edited range. Every date and time here is plant
 * wall-clock time in DISPLAY_TIMEZONE — the zone of every axis label — shown in the GMT
 * badge beside the control.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { RANGE_OPTIONS } from '../hooks/useDashboardData'
import type { RangeId, TimeSelection } from '../hooks/useDashboardData'
import {
  CALENDAR_PRESETS,
  MONTH_NAMES,
  addMonths,
  calendarPresetRange,
  compareDays,
  formatCompact,
  formatMdy,
  fromEpoch,
  gmtOffsetLabel,
  monthGrid,
  parseMdy,
  parseTime,
  sameDay,
  toEpoch,
  today,
} from '../lib/calendar'
import type { Ymd } from '../lib/calendar'
import { DISPLAY_TIMEZONE, formatFull } from '../lib/time'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

interface Draft {
  start: Ymd
  end: Ymd
  startText: string
  endText: string
  startTime: string
  endTime: string
  /** The plant's current day, for the calendar's today marker. */
  today: Ymd
  /** Which end the next calendar click sets. */
  picking: 'start' | 'end'
  view: { y: number; m: number }
  dirty: boolean
  error: string | null
}

function seedDraft(windowStart: number | null, windowEnd: number | null): Draft {
  const now = Date.now()
  const s = fromEpoch(windowStart ?? now)
  const e = fromEpoch(windowEnd ?? now)
  return {
    start: s.day,
    end: e.day,
    startText: formatMdy(s.day),
    endText: formatMdy(e.day),
    startTime: s.time,
    endTime: e.time,
    today: today(now),
    picking: 'start',
    view: { y: e.day.y, m: e.day.m },
    dirty: false,
    error: null,
  }
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}
const CalendarIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
)
const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
const Chevron = ({ dir }: { dir: 'down' | 'left' | 'right' }) => (
  <Icon>
    <path d={dir === 'down' ? 'M6 9l6 6 6-6' : dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </Icon>
)

export function TimeRangePicker({
  selection,
  onChange,
  windowStart,
  windowEnd,
  /** Newest sample available on the device; the "Last …" presets end here. */
  anchorMs,
}: {
  selection: TimeSelection
  onChange: (s: TimeSelection) => void
  windowStart: number | null
  windowEnd: number | null
  anchorMs: number | null
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => seedDraft(windowStart, windowEnd))
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const uid = useId()

  // Keep the fields in step with the window on screen: opening the panel, or choosing a
  // preset, changes that window, and fields holding an earlier value would apply a range
  // the user is no longer looking at.
  useEffect(() => {
    if (open) setDraft(seedDraft(windowStart, windowEnd))
  }, [open, windowStart, windowEnd])

  // Close on a click outside, or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerText =
    selection.kind === 'preset'
      ? (RANGE_OPTIONS.find((r) => r.id === selection.rangeId)?.label ?? 'Time range')
      : (selection.label ?? `${formatCompact(selection.start)} – ${formatCompact(selection.end)}`)

  /* ---------------- presets ---------------- */

  function chooseRelative(rangeId: RangeId) {
    onChange({ kind: 'preset', rangeId })
  }

  function chooseCalendar(id: (typeof CALENDAR_PRESETS)[number]['id'], label: string) {
    const r = calendarPresetRange(id, Date.now())
    onChange({ kind: 'custom', start: r.start, end: r.end, label })
  }

  /* ---------------- draft edits ---------------- */

  const edit = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch, dirty: true, error: null }))

  function pickDay(day: Ymd) {
    setDraft((d) => {
      if (d.picking === 'start') {
        return {
          ...d,
          start: day,
          end: day,
          startText: formatMdy(day),
          endText: formatMdy(day),
          picking: 'end',
          dirty: true,
          error: null,
        }
      }
      const [s, e] = compareDays(day, d.start) < 0 ? [day, d.start] : [d.start, day]
      return {
        ...d,
        start: s,
        end: e,
        startText: formatMdy(s),
        endText: formatMdy(e),
        picking: 'start',
        dirty: true,
        error: null,
      }
    })
  }

  function typeDate(which: 'start' | 'end', text: string) {
    const parsed = parseMdy(text)
    if (which === 'start') {
      edit({ startText: text, ...(parsed ? { start: parsed, view: { y: parsed.y, m: parsed.m } } : {}) })
    } else {
      edit({ endText: text, ...(parsed ? { end: parsed, view: { y: parsed.y, m: parsed.m } } : {}) })
    }
  }

  /** A half-typed or impossible date reverts to the last valid one when the field loses focus. */
  function settleDate(which: 'start' | 'end') {
    setDraft((d) =>
      which === 'start' ? { ...d, startText: formatMdy(d.start) } : { ...d, endText: formatMdy(d.end) },
    )
  }

  /** Tidy a valid time ("9:05" becomes "09:05") on blur; a bad one is reported when Apply is pressed. */
  function settleTime(which: 'start' | 'end') {
    setDraft((d) => {
      const raw = which === 'start' ? d.startTime : d.endTime
      const t = parseTime(raw)
      if (!t) return d
      const tidy = `${String(t.h).padStart(2, '0')}:${String(t.min).padStart(2, '0')}`
      return which === 'start' ? { ...d, startTime: tidy } : { ...d, endTime: tidy }
    })
  }

  function endNow() {
    const n = fromEpoch(Date.now())
    edit({ end: n.day, endText: formatMdy(n.day), endTime: n.time, view: { y: n.day.y, m: n.day.m } })
  }

  function apply() {
    const s = toEpoch(draft.start, draft.startTime)
    const e = toEpoch(draft.end, draft.endTime)
    if (s == null || e == null) {
      setDraft((d) => ({
        ...d,
        error: 'Enter a valid date and a 24-hour time (HH:mm) for both start and end.',
      }))
      return
    }
    if (e <= s) {
      setDraft((d) => ({ ...d, error: 'The end must be after the start.' }))
      return
    }
    onChange({ kind: 'custom', start: s, end: e })
    setOpen(false)
  }

  const weeks = monthGrid(draft.view.y, draft.view.m)
  const inRange = (day: Ymd) =>
    compareDays(day, draft.start) >= 0 && compareDays(day, draft.end) <= 0

  return (
    <div className="trp" ref={rootRef}>
      <span className="trp__label" id="trp-label">
        Time Range:
      </span>

      <button
        ref={triggerRef}
        type="button"
        className="trp__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby="trp-label trp-value"
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarIcon />
        <span id="trp-value" className="trp__value">
          {triggerText}
        </span>
        <Chevron dir="down" />
      </button>

      <span className="trp__tz" title={`All times are ${DISPLAY_TIMEZONE}`}>
        <ClockIcon />
        {gmtOffsetLabel()}
      </span>

      {open ? (
        <div className="trp__pop" role="dialog" aria-label="Time range">
          <div className="trp__presets">
            <ul>
              {RANGE_OPTIONS.map((r) => {
                const active = selection.kind === 'preset' && selection.rangeId === r.id
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`trp__preset ${active ? 'is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => chooseRelative(r.id)}
                    >
                      {r.label}
                    </button>
                  </li>
                )
              })}
            </ul>
            <ul>
              {CALENDAR_PRESETS.map((c) => {
                const active = selection.kind === 'custom' && selection.label === c.label
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`trp__preset ${active ? 'is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => chooseCalendar(c.id, c.label)}
                    >
                      {c.label}
                    </button>
                  </li>
                )
              })}
            </ul>
            {anchorMs != null ? (
              <p className="trp__anchor">
                &ldquo;Last&rdquo; ranges end at the newest data:
                <strong>{formatFull(anchorMs)}</strong>
              </p>
            ) : null}
          </div>

          <div className="trp__main">
            <div className="trp__row">
              <div className="trp__field trp__field--date">
                <label className="trp__field-label" htmlFor={`${uid}-sd`}>
                  Start
                </label>
                <input
                  id={`${uid}-sd`}
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/DD/YYYY"
                  value={draft.startText}
                  onChange={(e) => typeDate('start', e.target.value)}
                  onBlur={() => settleDate('start')}
                  aria-label="Start date"
                />
              </div>
              <div className="trp__field trp__field--time">
                <label className="trp__field-label" htmlFor={`${uid}-st`}>
                  Time
                </label>
                <div className="trp__time">
                  <input
                    id={`${uid}-st`}
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:mm"
                    value={draft.startTime}
                    onChange={(e) => edit({ startTime: e.target.value })}
                    onBlur={() => settleTime('start')}
                    aria-label="Start time"
                  />
                  <ClockIcon />
                </div>
              </div>
            </div>

            <div className="trp__row">
              <div className="trp__field trp__field--date">
                <div className="trp__field-label">
                  <label htmlFor={`${uid}-ed`}>End</label>
                  <button type="button" className="trp__now" onClick={endNow}>
                    Now
                  </button>
                </div>
                <input
                  id={`${uid}-ed`}
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/DD/YYYY"
                  value={draft.endText}
                  onChange={(e) => typeDate('end', e.target.value)}
                  onBlur={() => settleDate('end')}
                  aria-label="End date"
                />
              </div>
              <div className="trp__field trp__field--time">
                <label className="trp__field-label" htmlFor={`${uid}-et`}>
                  Time
                </label>
                <div className="trp__time">
                  <input
                    id={`${uid}-et`}
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:mm"
                    value={draft.endTime}
                    onChange={(e) => edit({ endTime: e.target.value })}
                    onBlur={() => settleTime('end')}
                    aria-label="End time"
                  />
                  <ClockIcon />
                </div>
              </div>
            </div>

            <div className="trp__cal" role="group" aria-label="Calendar">
              <div className="trp__cal-head">
                <button
                  type="button"
                  className="trp__nav"
                  aria-label="Previous month"
                  onClick={() => setDraft((d) => ({ ...d, view: addMonths(d.view, -1) }))}
                >
                  <Chevron dir="left" />
                </button>
                <span className="trp__cal-title">
                  {MONTH_NAMES[draft.view.m - 1].slice(0, 3)} {draft.view.y}
                </span>
                <button
                  type="button"
                  className="trp__nav"
                  aria-label="Next month"
                  onClick={() => setDraft((d) => ({ ...d, view: addMonths(d.view, 1) }))}
                >
                  <Chevron dir="right" />
                </button>
              </div>

              <div className="trp__grid" role="grid">
                {WEEKDAYS.map((w, i) => (
                  <span key={i} className="trp__dow" role="columnheader">
                    {w}
                  </span>
                ))}
                {weeks.flat().map((day, i) =>
                  day == null ? (
                    <span key={i} className="trp__blank" />
                  ) : (
                    <button
                      key={i}
                      type="button"
                      className={[
                        'trp__day',
                        inRange(day) ? 'is-in-range' : '',
                        sameDay(day, draft.start) ? 'is-start' : '',
                        sameDay(day, draft.end) ? 'is-end' : '',
                        sameDay(day, draft.today) ? 'is-today' : '',
                      ].join(' ')}
                      aria-pressed={sameDay(day, draft.start) || sameDay(day, draft.end)}
                      aria-label={formatMdy(day)}
                      onClick={() => pickDay(day)}
                    >
                      {day.d}
                    </button>
                  ),
                )}
              </div>
            </div>

            {draft.error ? (
              <p className="trp__error" role="alert">
                {draft.error}
              </p>
            ) : (
              <p className="trp__hint">
                {draft.picking === 'start' ? 'Click to select start date' : 'Click to select end date'}
              </p>
            )}

            <div className="trp__foot">
              <button type="button" className="btn btn--sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!draft.dirty}
                onClick={apply}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
