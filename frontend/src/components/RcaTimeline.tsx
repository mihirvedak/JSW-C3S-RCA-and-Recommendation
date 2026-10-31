/**
 * Last 48 hours of C3S predictions as one continuous bar of 15-minute intervals, each in its
 * classification colour (`lib/zones.ts`). How each interval was classified is in
 * `lib/timeline.ts`; the tooltip always says which source applied.
 *
 * Intervals holding an RCA event carry a tick above the bar and are buttons: selecting one
 * selects that event for the RCA panel, the trend and Trend Analysis. Any interval can be
 * pinned to read its details below the bar.
 */

import { useMemo, useRef, useState } from 'react'
import type { RcaFinding } from '../services/rcaService'
import { INTERVAL_COUNT, countZones } from '../lib/timeline'
import type { TimelineInterval } from '../lib/timeline'
import { NOT_CLASSIFIED, ZONE_ORDER, ZONE_STYLE, zoneDetail } from '../lib/zones'
import type { ZoneKey } from '../lib/zones'
import { DISPLAY_TIMEZONE, HOUR_MS, formatDateTime, formatTime } from '../lib/time'
import { ZoneBadge } from './ZoneBadge'

const SOURCE_TEXT: Record<TimelineInterval['source'], string> = {
  insight: 'RCA event: classification from the insight',
  computed: 'No RCA event: classified from the prediction and lab free lime with the insight targets',
  unclassified: 'No RCA event: prediction could not be classified',
  none: 'No predicted C3S in this interval',
}

function IntervalDetail({ iv }: { iv: TimelineInterval }) {
  return (
    <>
      <div className="rtl__tip-head">
        {formatDateTime(iv.start)} – {formatTime(iv.end)}
      </div>
      <div className="rtl__tip-row">
        <ZoneBadge zone={iv.zone} title={iv.event ? zoneDetail(iv.event) : undefined} />
      </div>
      <dl className="rtl__tip-dl">
        <div>
          <dt>Predicted C3S</dt>
          <dd>
            {iv.prediction ? `${iv.prediction.v.toFixed(2)}% at ${formatTime(iv.prediction.t)}` : '—'}
          </dd>
        </div>
        <div>
          <dt>Free lime (last lab)</dt>
          <dd>{iv.freeLime ? `${iv.freeLime.v.toFixed(2)}% at ${formatDateTime(iv.freeLime.t)}` : '—'}</dd>
        </div>
        {iv.limeLevel != null ? (
          <div>
            <dt>Lime level</dt>
            <dd>{iv.limeLevel.toFixed(1)}</dd>
          </div>
        ) : null}
        <div>
          <dt>RCA status</dt>
          <dd>
            {iv.event
              ? `RCA run at ${formatTime(iv.event.eventTime)}${iv.event.primaryCause ? ` · ${iv.event.primaryCause}` : ''}`
              : 'No RCA event'}
          </dd>
        </div>
      </dl>
      <p className="rtl__tip-src">{iv.reason ?? SOURCE_TEXT[iv.source]}</p>
    </>
  )
}

export function RcaTimeline({
  intervals,
  selectedEventId,
  onSelectEvent,
}: {
  intervals: readonly TimelineInterval[]
  selectedEventId: string | null
  onSelectEvent: (f: RcaFinding) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)

  const counts = useMemo(() => countZones(intervals), [intervals])
  const start = intervals[0]?.start ?? 0
  const end = intervals[intervals.length - 1]?.end ?? 0

  // Labels every 6 h of plant time, with the date at midnight. Plant hours fall on UTC
  // half-hours (UTC+5:30), so candidates are stepped every 30 minutes.
  const ticks = useMemo(() => {
    const out: Array<{ t: number; label: string; minor: boolean }> = []
    const half = HOUR_MS / 2
    for (let t = Math.ceil(start / half) * half; t <= end; t += half) {
      const clock = formatTime(t)
      if (['00:00', '06:00', '12:00', '18:00'].includes(clock)) {
        // 06:00 and 18:00 are minor: on a narrow bar only midnight and noon keep their labels.
        out.push({ t, label: clock === '00:00' ? formatDateTime(t).split(',')[0] : clock, minor: clock === '06:00' || clock === '18:00' })
      }
    }
    return out
  }, [start, end])

  const indexAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    const i = Math.floor(((clientX - rect.left) / rect.width) * INTERVAL_COUNT)
    return i >= 0 && i < INTERVAL_COUNT ? i : null
  }

  const shown = hover ?? pinned
  const shownIv = shown == null ? null : intervals[shown]
  const pct = (i: number) => (i / INTERVAL_COUNT) * 100

  const legend: ZoneKey[] = [...ZONE_ORDER, NOT_CLASSIFIED]

  return (
    <div className="rtl">
      <div className="rtl__frame">
        <div className="rtl__events" aria-hidden="true">
          {intervals.map((iv, i) =>
            iv.event ? (
              <span
                key={iv.start}
                className={`rtl__tick ${iv.event.id === selectedEventId ? 'is-selected' : ''}`}
                style={{ left: `${pct(i + 0.5)}%`, backgroundColor: ZONE_STYLE[iv.zone].fill }}
              />
            ) : null,
          )}
        </div>
        <div
          ref={barRef}
          className="rtl__bar"
          role="group"
          aria-label={`C3S classification, ${formatDateTime(start)} to ${formatDateTime(end)}, 15-minute intervals`}
          onMouseMove={(e) => setHover(indexAt(e.clientX))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const i = indexAt(e.clientX)
            if (i == null) return
            setPinned(i === pinned ? null : i)
            const ev = intervals[i].event
            if (ev) onSelectEvent(ev)
          }}
        >
          {intervals.map((iv, i) => {
            const style = { backgroundColor: ZONE_STYLE[iv.zone].fill }
            const cls = `rtl__seg ${iv.zone === NOT_CLASSIFIED ? 'is-empty' : ''} ${
              iv.event?.id === selectedEventId ? 'is-selected' : ''
            } ${i === pinned ? 'is-pinned' : ''}`
            // Only intervals with an RCA event are focusable: 192 tab stops would be unusable.
            return iv.event ? (
              <button
                key={iv.start}
                type="button"
                className={cls}
                style={style}
                data-zone={iv.zone}
                aria-label={`${formatDateTime(iv.start)}: ${iv.zone}, RCA event`}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ) : (
              <span key={iv.start} className={cls} style={style} data-zone={iv.zone} />
            )
          })}
        </div>
        {shownIv ? (
          <div
            className="rtl__tip"
            role="status"
            style={{ left: `clamp(110px, ${pct(shown! + 0.5)}%, calc(100% - 110px))` }}
          >
            <IntervalDetail iv={shownIv} />
          </div>
        ) : null}
        <div className="rtl__axis" aria-hidden="true">
          {ticks.map((tk) => {
            const pct = ((tk.t - start) / (end - start)) * 100
            // A label centred on a tick at either end would hang past the bar on a narrow screen.
            const edge = pct < 8 ? ' is-start' : pct > 92 ? ' is-end' : ''
            return (
              <span key={tk.t} className={`rtl__axis-tick${edge}${tk.minor ? ' is-minor' : ''}`} style={{ left: `${pct}%` }}>
                {tk.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="rtl__foot">
        <ul className="zone-legend" aria-label="Classification colours and intervals per class">
          {legend.map((z) => (
            <li key={z} title={ZONE_STYLE[z].meaning}>
              <span
                className={`zone-legend__swatch ${z === NOT_CLASSIFIED ? 'is-empty' : ''}`}
                style={{ backgroundColor: ZONE_STYLE[z].fill }}
              />
              {z} <strong>{counts.get(z) ?? 0}</strong>
            </li>
          ))}
        </ul>
        <span className="rtl__range">
          {formatDateTime(start)} – {formatDateTime(end)} · {INTERVAL_COUNT} × 15 min · {DISPLAY_TIMEZONE}
        </span>
      </div>
    </div>
  )
}
