/**
 * Process monitoring — ADANI_RAW.
 *
 * Signals are listed under the equipment section the process tag map gives them
 * (Preheater, Calciner, Kiln, Cooler, Other). Selecting one plots its real trend over the
 * selected window, with the x axis fixed to that window so it lines up with the C3S trend.
 */

import { useMemo, useState } from 'react'
import {
  PROCESS_DEVICE,
  PROCESS_GROUP_LABELS,
  PROCESS_GROUP_ORDER,
  PROCESS_SENSORS,
  getSensor,
} from '../config/deviceMappings'
import type { ProcessSensorDef } from '../config/deviceMappings'
import type { LastReading } from '../services/deviceDataService'
import { extractSeries } from '../lib/series'
import type { Point, TimestampRow } from '../lib/series'
import { NoData, UnverifiedName } from './primitives'
import { formatAge, formatAxisTick, formatFull } from '../lib/time'

const W = 720
const H = 150
const PAD = { top: 12, right: 12, bottom: 22, left: 48 }

/** Natural order, so "Cooler Fan 2" sorts before "Cooler Fan 10". */
const byLabel = (a: ProcessSensorDef, b: ProcessSensorDef) =>
  a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })

/** Sensors under their section heading, in the tag map's section order. */
function groupSensors(
  sensors: readonly ProcessSensorDef[],
): Array<{ group: ProcessSensorDef['group']; items: ProcessSensorDef[] }> {
  return PROCESS_GROUP_ORDER.map((group) => ({
    group,
    items: sensors.filter((s) => s.group === group).sort(byLabel),
  })).filter((g) => g.items.length > 0)
}

function Sparkline({
  points,
  markerMs,
  windowStart,
  windowEnd,
}: {
  points: readonly Point[]
  markerMs: number | null
  windowStart: number | null
  windowEnd: number | null
}) {
  if (points.length < 2) {
    return <p className="trend__empty">Not enough samples in this range to plot a trend.</p>
  }

  // The axis is the selected window, not just the span of the points, so a sensor that
  // reported for only part of the window is not stretched across all of it.
  const t0 = windowStart ?? points[0].t
  const t1 = windowEnd ?? points[points.length - 1].t
  const span = Math.max(1, t1 - t0)
  const vals = points.map((p) => p.v)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = Math.max(0.0001, (max - min) * 0.12)
  const vMin = min - pad
  const vMax = max + pad
  const vSpan = Math.max(0.0001, vMax - vMin)

  const x = (t: number) => PAD.left + ((t - t0) / span) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - vMin) / vSpan) * (H - PAD.top - PAD.bottom)

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')

  return (
    <svg className="trend__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      {[vMin, (vMin + vMax) / 2, vMax].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="trend__grid" />
          <text x={PAD.left - 6} y={y(v) + 4} className="trend__ytick">
            {v.toFixed(Math.abs(v) >= 100 ? 0 : 2)}
          </text>
        </g>
      ))}
      {[t0, (t0 + t1) / 2, t1].map((t, i) => (
        <text
          key={t}
          x={x(t)}
          y={H - 6}
          className="trend__xtick"
          textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
        >
          {formatAxisTick(t, span)}
        </text>
      ))}
      <path d={d} className="trend__line" />
      {markerMs != null && markerMs >= t0 && markerMs <= t1 ? (
        <line
          x1={x(markerMs)}
          x2={x(markerMs)}
          y1={PAD.top}
          y2={H - PAD.bottom}
          className="trend__marker"
        />
      ) : null}
    </svg>
  )
}

export function ProcessMonitor({
  rows,
  latest,
  now,
  eventMarkerMs,
  windowStart,
  windowEnd,
}: {
  rows: readonly TimestampRow[]
  latest: Map<string, LastReading>
  now: number
  /** Selected quality event, drawn on the trend so operating changes line up with it. */
  eventMarkerMs: number | null
  /** The window the rows cover; fixes the trend's x axis. */
  windowStart: number | null
  windowEnd: number | null
}) {
  const reporting = useMemo(
    () => PROCESS_SENSORS.filter((s) => latest.get(s.sensorId)?.value != null),
    [latest],
  )

  const [picked, setPicked] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // A pick only counts while that sensor still reports in the selected window; otherwise the
  // first signal in the list is shown.
  const firstListed = groupSensors(reporting)[0]?.items[0]?.sensorId ?? 'D0'
  const selected =
    picked != null && reporting.some((s) => s.sensorId === picked) ? picked : firstListed
  const setSelected = setPicked

  // Searchable by label, section or sensor id, so an engineer who knows the tag can still find it.
  const filtered = reporting.filter((s) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (
      s.sensorId.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      PROCESS_GROUP_LABELS[s.group].toLowerCase().includes(q)
    )
  })
  const grouped = groupSensors(filtered)

  const series = useMemo(() => extractSeries(rows, selected), [rows, selected])
  const def = getSensor(PROCESS_DEVICE, selected)
  const reading = latest.get(selected)

  return (
    <div className="process">
      <div className="process__list">
        <input
          type="search"
          className="process__search"
          placeholder="Filter process sensors…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter process sensors"
        />
        <p className="process__count">
          {reporting.length} of {PROCESS_SENSORS.length} sensors reporting in the selected range
        </p>
        <ul className="process__items">
          {grouped.length === 0 ? (
            <li className="process__none">No sensors match.</li>
          ) : null}
          {grouped.map(({ group, items }) => (
            <li key={group} className="process__section">
              <h4 className="process__group">
                {PROCESS_GROUP_LABELS[group]}
                <span className="process__group-count">{items.length}</span>
              </h4>
              <ul>
                {items.map((s) => {
                  const r = latest.get(s.sensorId)
                  return (
                    <li key={s.sensorId}>
                      <button
                        type="button"
                        className={`process__item ${selected === s.sensorId ? 'is-active' : ''}`}
                        onClick={() => setSelected(s.sensorId)}
                        title={`${PROCESS_DEVICE}:${s.sensorId}`}
                      >
                        <span className="process__item-name">{s.label}</span>
                        <span className="process__item-val">
                          {r?.value == null ? '—' : r.value.toFixed(2)}
                          {s.unit ? <span className="process__item-unit"> {s.unit}</span> : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="process__detail">
        <header className="process__detail-head">
          <div>
            <h3>
              {def?.label ?? selected}
              {def?.name == null ? <UnverifiedName /> : null}
            </h3>
            {def?.unit ? <span className="process__detail-ref">{def.unit}</span> : null}
          </div>
          <div className="process__detail-value">
            {reading?.value == null ? (
              <NoData />
            ) : (
              <>
                <strong>{reading.value.toFixed(3)}</strong>
                {def?.unit ? <span className="process__unit">{def.unit}</span> : null}
              </>
            )}
            {reading?.time != null ? (
              <span className="process__detail-time" title={formatFull(reading.time)}>
                {formatAge(reading.time, now)}
              </span>
            ) : null}
          </div>
        </header>

        <Sparkline
          points={series}
          markerMs={eventMarkerMs}
          windowStart={windowStart}
          windowEnd={windowEnd}
        />
      </div>
    </div>
  )
}
