/**
 * Laboratory quality intelligence — ADANI_LAB, organised by material category.
 *
 * Each parameter shows its latest value against the previous sample (last vs previous), the
 * original laboratory sample timestamp and a data-quality state. Sampling cadence differs sharply between categories (oxides every
 * ~2 h, hot meal twice a day, AFR about once a day) and that is surfaced rather than
 * smoothed away. Nothing is forward-filled.
 */

import { useMemo, useState } from 'react'
import {
  HIDDEN_LAB_SENSORS,
  LAB_CATEGORY_LABELS,
  LAB_DEVICE,
  LAB_SENSORS_BY_CATEGORY,
} from '../config/deviceMappings'
import type { LabCategory, LabSensorDef } from '../config/deviceMappings'
import type { LastReading } from '../services/deviceDataService'
import type { Point, TimestampRow } from '../lib/series'
import { NoData, UnverifiedName } from './primitives'
import { formatAge, formatFull, HOUR_MS } from '../lib/time'

/** A category's parameters, without the ones the dashboard does not show. */
const shown = (cat: LabCategory) =>
  (LAB_SENSORS_BY_CATEGORY[cat] ?? []).filter((s) => !HIDDEN_LAB_SENSORS.has(s.sensorId))

const CATEGORY_ORDER: LabCategory[] = [
  'raw_mix',
  'kiln_feed',
  'hot_meal_1',
  'hot_meal_2',
  'clinker',
  'coal',
  'afr',
  'model_output',
]

/** A reading older than this relative to the newest lab sample is flagged stale. */
const STALE_FACTOR_MS = 6 * HOUR_MS

/** The sample before the latest one, per sensor, within the loaded rows. */
function previousSamples(rows: readonly TimestampRow[]): Map<string, Point> {
  const last = new Map<string, Point>()
  const prev = new Map<string, Point>()
  for (const r of rows) {
    for (const [id, v] of Object.entries(r.values)) {
      const cur = last.get(id)
      if (cur) prev.set(id, cur)
      last.set(id, { t: r.t, v })
    }
  }
  return prev
}

const fmtValue = (v: number) => v.toFixed(Math.abs(v) >= 100 ? 1 : 2)

function Cell({
  sensor,
  reading,
  previous,
  newestLabSample,
  now,
}: {
  sensor: LabSensorDef
  reading: LastReading | undefined
  previous: Point | undefined
  newestLabSample: number | null
  now: number
}) {
  const value = reading?.value ?? null
  const time = reading?.time ?? null
  const stale =
    time != null && newestLabSample != null && newestLabSample - time > STALE_FACTOR_MS

  return (
    <article className={`lab-cell ${stale ? 'is-stale' : ''}`} title={`${LAB_DEVICE}:${sensor.sensorId}`}>
      <header className="lab-cell__head">
        <span className="lab-cell__name">
          {sensor.label}
          {sensor.name == null ? <UnverifiedName compact /> : null}
        </span>
      </header>

      <div className="lab-cell__value">
        {value == null ? (
          <NoData reason="No laboratory measurement recorded for this sensor" />
        ) : (
          <>
            <strong>{fmtValue(value)}</strong>
            {sensor.unit ? <span className="lab-cell__unit">{sensor.unit}</span> : null}
          </>
        )}
      </div>

      {value != null && previous ? (
        <div className="lab-cell__prev" title={`Previous sample ${formatFull(previous.t)}`}>
          prev {fmtValue(previous.v)}
          {value !== previous.v ? (
            <span className={value > previous.v ? 'lab-cell__delta is-up' : 'lab-cell__delta is-down'}>
              {value > previous.v ? '▲' : '▼'} {fmtValue(Math.abs(value - previous.v))}
            </span>
          ) : (
            <span className="lab-cell__delta">= unchanged</span>
          )}
        </div>
      ) : null}

      <footer className="lab-cell__foot">
        {time == null ? (
          <span className="lab-cell__time lab-cell__time--none">no sample</span>
        ) : (
          <span className="lab-cell__time" title={`Sampled ${formatFull(time)}`}>
            {formatAge(time, now)}
            {stale ? <span className="lab-cell__stale-flag"> · stale</span> : null}
          </span>
        )}
      </footer>
    </article>
  )
}

export function LabQuality({
  latest,
  rows,
  now,
}: {
  latest: Map<string, LastReading>
  /** The selected range's laboratory rows, for the previous sample of each parameter. */
  rows: readonly TimestampRow[]
  now: number
}) {
  const [active, setActive] = useState<LabCategory>('raw_mix')
  const previous = useMemo(() => previousSamples(rows), [rows])

  const newestLabSample = useMemo(() => {
    let newest: number | null = null
    for (const r of latest.values()) {
      if (r.time != null && (newest == null || r.time > newest)) newest = r.time
    }
    return newest
  }, [latest])

  const sensors = shown(active)
  const visible = sensors

  return (
    <div className="lab">
      <div className="lab__tabs" role="tablist" aria-label="Material category">
        {CATEGORY_ORDER.map((cat) => {
          const list = shown(cat)
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active === cat}
              className={`lab__tab ${active === cat ? 'is-active' : ''}`}
              onClick={() => setActive(cat)}
            >
              <span className="lab__tab-name">{LAB_CATEGORY_LABELS[cat]}</span>
              <span className="lab__tab-range">{list.length} parameters</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="lab__empty">No parameters to show in this category.</p>
      ) : (
        <div className="lab__grid">
          {visible.map((s) => (
            <Cell
              key={s.sensorId}
              sensor={s}
              reading={latest.get(s.sensorId)}
              previous={previous.get(s.sensorId)}
              newestLabSample={newestLabSample}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  )
}
