/**
 * Laboratory quality intelligence — the line's laboratory-type devices, organised by material
 * group (the groups the client spec gives its sensors: raw mix, kiln feed, clinker, fuel, model
 * outputs …).
 *
 * Each parameter shows its latest value against the previous sample (last vs previous), the
 * original laboratory sample timestamp and a data-quality state. Sampling cadence differs sharply
 * between groups (oxides every ~2 h, hot meal twice a day, AFR about once a day) and that is
 * surfaced rather than smoothed away. Nothing is forward-filled.
 */

import { useMemo, useState } from 'react'
import { useLine } from '../config/LineContext'
import type { SensorDef, SensorGroup } from '../config/lineModel'
import type { LastReading } from '../services/deviceDataService'
import type { Point, TimestampRow } from '../lib/series'
import { NoData, UnverifiedName } from './primitives'
import { formatAge, formatFull, HOUR_MS } from '../lib/time'

/** A reading older than this relative to the newest lab sample is flagged stale. */
const STALE_FACTOR_MS = 6 * HOUR_MS

/** The sample before the latest one, per sensor key, within the loaded rows. */
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
  sensor: SensorDef
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
    <article className={`lab-cell ${stale ? 'is-stale' : ''}`} title={sensor.key}>
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
  const line = useLine()
  const groups: SensorGroup[] = useMemo(() => line.groups('lab'), [line])
  const [picked, setPicked] = useState<string | null>(null)
  const active = groups.find((g) => g.id === picked) ?? groups[0]
  const previous = useMemo(() => previousSamples(rows), [rows])

  const newestLabSample = useMemo(() => {
    let newest: number | null = null
    for (const r of latest.values()) {
      if (r.time != null && (newest == null || r.time > newest)) newest = r.time
    }
    return newest
  }, [latest])

  if (!active) return <p className="lab__empty">This line lists no laboratory parameters.</p>

  return (
    <div className="lab">
      <div className="lab__tabs" role="tablist" aria-label="Material category">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={active.id === g.id}
            className={`lab__tab ${active.id === g.id ? 'is-active' : ''}`}
            onClick={() => setPicked(g.id)}
          >
            <span className="lab__tab-name">{g.label}</span>
            <span className="lab__tab-range">{g.sensors.length} parameters</span>
          </button>
        ))}
      </div>

      <div className="lab__grid">
        {active.sensors.map((s) => (
          <Cell
            key={s.key}
            sensor={s}
            reading={latest.get(s.key)}
            previous={previous.get(s.key)}
            newestLabSample={newestLabSample}
            now={now}
          />
        ))}
      </div>
    </div>
  )
}
