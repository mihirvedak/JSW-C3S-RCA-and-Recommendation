/**
 * Trend Analysis: the process data for the selected time range, and the RCA analysis of one event
 * when the user opens one.
 *
 * Opened from its tab, it shows the range chosen in the time picker with nothing tied to an RCA
 * event: predicted and actual C3S against free lime over the clinker zones (the insight's newest
 * targets), and the kiln-operation trends (`config/kilnTrends.ts`).
 *
 * An event is opened from the RCA panel's "View process trends" link or the event picker here.
 * The charts still cover the whole selected range, with the event marked and every minute reading
 * spliced in around it, and add:
 *   - any other process tag the RCA names (`config/rcaParameters.ts`), labelled with its wording,
 *   - predicted and actual C3S against free lime over the clinker zones, for the days up to the
 *     event, with the event on the predicted plot (events are triggered on predicted C3S),
 *   - the last four laboratory samples at or before the event, for the lab tags the RCA names.
 * "Event window" narrows the charts to 1 h before to 30 min after the event.
 *
 * The charts cover the process data actually loaded: at most the newest 7 days of a longer range.
 * An event further back than that is charted over its own 7 days of the range instead
 * (`useEventContext`), so it never sits on an empty stretch of axis.
 */

import { useMemo, useState } from 'react'
import type { ClinkerTargets, RcaFinding } from '../services/rcaService'
import type { EventTrends } from '../hooks/useEventTrends'
import type { EventContext } from '../hooks/useEventContext'
import { clampEnd } from '../config/dataWindow'
import { relevantParameters } from '../config/rcaParameters'
import type { RelevantParameter } from '../config/rcaParameters'
import { useLine } from '../config/LineContext'
import type { LineModel } from '../config/lineModel'
import { FILL_KEY, fillingStats, kilnOperationTrends, rpmForFilling, tagTrend } from '../config/kilnTrends'
import type { TrendDef } from '../config/kilnTrends'
import { extractSeries } from '../lib/series'
import type { Point, TimestampRow } from '../lib/series'
import { LAB_LOOKBACK_MS, SAMPLE_COUNT, lastSamples, spliceRows, trendWindow, valueAt } from '../lib/eventTrends'
import type { EventWindow } from '../lib/eventTrends'
import { DISPLAY_TIMEZONE, HOUR_MS, MINUTE_MS, formatDateTime, formatFull, formatStamp, formatTime } from '../lib/time'
import { zoneDetail, zoneLabel, zoneOf } from '../lib/zones'
import { ZoneBadge } from './ZoneBadge'
import { ClinkerZones } from './ClinkerZones'
import { EventTrendChart } from './EventTrendChart'
import { Badge, EmptyState, ErrorState, LoadingState, NoData, Panel } from './primitives'

const fmt = (v: number) => v.toFixed(Math.abs(v) >= 100 ? 1 : 2)

/** The dashboard's process load for the selected range. */
export interface RangeProcess {
  start: number
  end: number
  rows: readonly TimestampRow[]
  loading: boolean
  error: { message: string } | null
  /** True when the range is long enough that its rows are one reading per 5 minutes. */
  thinned: boolean
  /** Set when only the most recent part of a long range was fetched. */
  fetchedStart: number | null
  reload: () => void
}

/** The dashboard's laboratory load for the selected range. */
export interface RangeLab {
  rows: readonly TimestampRow[]
  loading: boolean
  error: { message: string } | null
  reload: () => void
}

type View = 'range' | 'event'

function Sources({ sources }: { sources: readonly string[] }) {
  return (
    <ul className="etrend__sources" aria-label="Why this tag is shown">
      {sources.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  )
}

function EventPicker({
  findings,
  selected,
  onSelect,
  loading,
  error,
}: {
  findings: readonly RcaFinding[]
  selected: RcaFinding | null
  onSelect: (id: string | null) => void
  loading: boolean
  error: { message: string } | null
}) {
  return (
    <label className="field etrend__picker">
      <span className="field__label">RCA event</span>
      <select
        className="field__input"
        value={selected?.id ?? ''}
        disabled={loading || error != null}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">
          {loading ? 'Loading RCA events…' : error ? 'RCA insight unavailable' : 'None: selected range only'}
        </option>
        {findings.map((f) => (
          <option key={f.id} value={f.id}>
            {formatDateTime(f.eventTime)} · {zoneLabel(f)}
            {f.c3s == null ? '' : ` · C3S ${f.c3s.toFixed(2)}`}
          </option>
        ))}
      </select>
    </label>
  )
}

function LastSamples({
  params,
  trends,
  eventMs,
}: {
  params: readonly RelevantParameter[]
  trends: EventTrends
  eventMs: number
}) {
  const line = useLine()
  if (trends.labLoading) return <LoadingState message="Loading laboratory samples…" />
  if (trends.labError) {
    return (
      <ErrorState
        message="Laboratory data unavailable"
        detail={trends.labError.message}
        onRetry={trends.reload}
      />
    )
  }

  const rows = params.map((p) => ({ p, samples: lastSamples(trends.labRows, p.key, eventMs) }))

  return (
    <div className="etrend__table-wrap">
      <table className="etrend__table">
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            {Array.from({ length: SAMPLE_COUNT }, (_, i) => (
              <th key={i} scope="col" className="num">
                {i === 0 ? 'Latest' : `${i + 1}${['nd', 'rd', 'th'][Math.min(i - 1, 2)]} latest`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, samples }) => {
            const def = line.describe(p.key)
            return (
              <tr key={p.key}>
                <th scope="row">
                  <span className="etrend__param" title={p.key}>
                    {def.label}
                    {def.unit ? <span className="etrend__unit"> {def.unit}</span> : null}
                  </span>
                  <Sources sources={p.sources} />
                </th>
                {Array.from({ length: SAMPLE_COUNT }, (_, i) => {
                  const s = samples[i]
                  return (
                    <td key={i} className="num">
                      {s ? (
                        <>
                          <strong>{fmt(s.v)}</strong>
                          <span className="etrend__time" title={formatFull(s.t)}>
                            {formatDateTime(s.t)}
                          </span>
                        </>
                      ) : (
                        <NoData reason={`No sample in the ${LAB_LOOKBACK_MS / HOUR_MS} h before the event`} />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface TrendCardData {
  def: TrendDef
  /** RCA wording that names this trend's tag; empty for a kiln-operation trend it does not name. */
  sources: string[]
}

function TrendCard({
  card,
  points,
  eventMs,
  window: w,
  maxGapMs,
  rows,
  scope,
}: {
  card: TrendCardData
  /** The trend's readings inside the window shown. */
  points: readonly Point[]
  eventMs: number | null
  window: EventWindow
  maxGapMs: number
  /** The rows the trend was read from, for figures a card derives from other tags. */
  rows: readonly TimestampRow[]
  /** What the window is, for the empty message: "the selected range", "the event window", … */
  scope: string
}) {
  const { def, sources } = card
  // With an event, the reading in force at it; without one, the newest reading shown.
  const at = eventMs != null ? valueAt(points, eventMs) : (points[points.length - 1] ?? null)
  return (
    <article className="etrend__card" data-trend={def.key}>
      <header className="etrend__card-head">
        <div>
          <h4 title={def.tags.join(', ')}>{def.label}</h4>
          {def.quality && def.quality !== 'usable' ? (
            <Badge tone="warn" title="The process tag map's own grading of this signal">
              tag map: {def.quality}
            </Badge>
          ) : null}
          {sources.length ? <Sources sources={sources} /> : null}
        </div>
        <div className="etrend__at">
          <span className="etrend__at-label">{eventMs != null ? 'At event' : 'Latest'}</span>
          {at ? (
            <>
              <strong>
                {fmt(at.v)}
                {def.unit ? <span className="etrend__unit"> {def.unit}</span> : null}
              </strong>
              {eventMs == null ? (
                <span className="etrend__time" title={formatFull(at.t)}>
                  {formatDateTime(at.t)}
                </span>
              ) : null}
            </>
          ) : (
            <NoData reason={eventMs != null ? 'No reading in the 5 minutes up to the event' : 'No reading in the range'} />
          )}
        </div>
      </header>
      {def.note ? <p className="etrend__note">{def.note}</p> : null}
      {def.key === FILL_KEY ? <FillingFigures points={points} at={at} rows={rows} atEvent={eventMs != null} /> : null}
      {points.length < 2 ? (
        <p className="trend__empty">No readings for this trend in {scope}.</p>
      ) : (
        <EventTrendChart
          name={def.label}
          unit={def.unit}
          points={points}
          eventMs={eventMs}
          atEvent={eventMs != null ? at : null}
          windowStart={w.start}
          windowEnd={w.end}
          maxGapMs={maxGapMs}
          band={def.band}
          flagAt={def.flagAbove}
        />
      )}
    </article>
  )
}

/**
 * One grid of cards: the fixed kiln-operation trends, then any other process tag the RCA names
 * (each labelled with the RCA's wording). Tags the plant asked not to chart are left out.
 */
function trendCards(line: LineModel, params: readonly RelevantParameter[]): TrendCardData[] {
  const core = kilnOperationTrends(line)
  const named = new Map(params.map((p) => [p.key, p.sources]))
  const coreTags = new Set(core.filter((d) => d.tags.length === 1).map((d) => d.tags[0]))
  return [
    ...core.map((def) => ({
      def,
      sources: def.tags.length === 1 ? (named.get(def.tags[0]) ?? []) : [],
    })),
    ...params
      .filter((p) => !coreTags.has(p.key) && !line.isTrendExcluded(p.key))
      .map((p) => ({ def: tagTrend(line, p.key), sources: p.sources })),
  ]
}

/**
 * The filling degree's own figures over the time shown: median, the share of readings above the
 * plant's flag level, and the kiln speed that would bring the reading at the event (or the newest
 * one) to the plant's target filling (rpm × filling / target).
 */
function FillingFigures({
  points,
  at,
  rows,
  atEvent,
}: {
  points: readonly Point[]
  at: Point | null
  rows: readonly TimestampRow[]
  atEvent: boolean
}) {
  const line = useLine()
  const spec = line.kilnFilling
  const rpmKey = line.role('kilnRpm')
  if (!spec || !rpmKey) return null
  const stats = fillingStats(points, spec.flagAbove)
  const rpm = at ? valueAt(extractSeries(rows, rpmKey), at.t) : null
  const rpmTarget = at && rpm ? rpmForFilling(rpm.v, at.v, spec.speedTarget) : null
  return (
    <dl className="etrend__figs">
      <div>
        <dt>Median</dt>
        <dd>{stats.median == null ? '—' : `${stats.median.toFixed(2)} %`}</dd>
      </div>
      <div>
        <dt>Above {spec.flagAbove} %</dt>
        <dd className={stats.abovePct ? 'is-flag' : undefined}>
          {stats.abovePct == null ? '—' : `${stats.abovePct.toFixed(1)} % of the time shown`}
        </dd>
      </div>
      <div>
        <dt>Speed for {spec.speedTarget} %</dt>
        <dd
          title={
            rpm ? `rpm × filling / ${spec.speedTarget}, from ${rpm.v.toFixed(2)} rpm ${atEvent ? 'at the event' : 'at the newest reading'}` : undefined
          }
        >
          {rpmTarget == null ? '—' : `${rpmTarget.toFixed(2)} rpm`}
        </dd>
      </div>
    </dl>
  )
}

function ProcessTrends({
  params,
  rows,
  eventMs,
  window: w,
  maxGapMs,
  scope,
}: {
  params: readonly RelevantParameter[]
  rows: readonly TimestampRow[]
  eventMs: number | null
  window: EventWindow
  maxGapMs: number
  scope: string
}) {
  const line = useLine()
  const cards = useMemo(() => trendCards(line, params), [line, params])
  const series = useMemo(() => {
    const out = new Map<string, Point[]>()
    for (const c of cards) out.set(c.def.key, c.def.series(rows).filter((p) => p.t >= w.start && p.t <= w.end))
    return out
  }, [cards, rows, w.start, w.end])

  if (cards.length === 0) {
    return (
      <EmptyState
        message={`No kiln-operation tags are configured for ${line.plant.name}.`}
        hint="Map the kiln roles (burning zone, secondary / tertiary air, kiln speed, coal rates, cooler fans) in the line's client spec to chart them here."
      />
    )
  }
  return (
    <div className="etrend__grid">
      {cards.map((c) => (
        <TrendCard
          key={c.def.key}
          card={c}
          points={series.get(c.def.key) ?? []}
          eventMs={eventMs}
          window={w}
          maxGapMs={maxGapMs}
          rows={rows}
          scope={scope}
        />
      ))}
    </div>
  )
}

const NO_PARAMS: readonly RelevantParameter[] = []

export function TrendAnalysis({
  findings,
  event,
  onSelect,
  range,
  rangeLab,
  trends,
  context,
  zoneTargets,
  rcaLoading,
  rcaError,
}: {
  /** The events the picker offers: those in the selected range, and the open one. */
  findings: readonly RcaFinding[]
  /** The RCA event opened here, or null to show the selected range only. */
  event: RcaFinding | null
  onSelect: (id: string | null) => void
  range: RangeProcess
  rangeLab: RangeLab
  /** Minute data and laboratory samples around the open event. */
  trends: EventTrends
  /** The open event's own part of a range longer than the loaded process data. */
  context: EventContext
  /** The insight's C3S / free-lime targets the zone plots are drawn from. */
  zoneTargets: ClinkerTargets | null
  rcaLoading: boolean
  rcaError: { message: string } | null
}) {
  const line = useLine()
  const [view, setView] = useState<View>('range')
  const params = useMemo(() => (event ? relevantParameters(event, line) : null), [event, line])

  const eventMs = event?.eventTime ?? null
  const ew = eventMs != null ? trendWindow(eventMs) : null
  // An event picked on the 48-hour timeline can lie outside the selected range; then only its own
  // window has data to show.
  const inRange = eventMs != null && eventMs >= range.start && eventMs <= range.end
  const ownWindowOnly = ew != null && !inRange
  // What the dashboard loaded: a range longer than 7 days keeps its newest 7, and nothing past
  // the data cut-off exists.
  const loaded: EventWindow = { start: range.fetchedStart ?? range.start, end: clampEnd(range.end) }
  // An event in the range but older than the loaded days is charted over its own part of it.
  const ownContext = inRange && eventMs < loaded.start && context.window != null
  const base: EventWindow = ownContext && context.window ? context.window : loaded
  const showEventWindow = ew != null && (view === 'event' || ownWindowOnly)
  const w: EventWindow = showEventWindow && ew ? ew : base

  const rows = useMemo(() => {
    if (eventMs == null) return range.rows
    if (ownWindowOnly) return trends.processRows
    return spliceRows(ownContext ? context.rows : range.rows, trends.processRows, trendWindow(eventMs))
  }, [range.rows, context.rows, trends.processRows, eventMs, ownWindowOnly, ownContext])
  const processLoading = ownWindowOnly ? trends.processLoading : ownContext ? context.loading : range.loading
  const processError = ownWindowOnly ? trends.processError : ownContext ? context.error : range.error
  // Thinned rows are one reading per 5 minutes; only a longer silence is a gap.
  const maxGapMs = (range.thinned || ownContext) && !showEventWindow ? 15 * MINUTE_MS : 5 * MINUTE_MS

  const processPanel = (
    <Panel
      title="Process Trends"
      actions={
        ew != null && !ownWindowOnly ? (
          <div className="toggle" role="group" aria-label="Time shown">
            {(
              [
                ['range', 'Selected range'],
                ['event', 'Event window (−1 h / +30 min)'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`toggle__btn ${view === id ? 'is-active' : ''}`}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {processLoading ? (
        <LoadingState message="Loading process trends…" />
      ) : processError ? (
        <ErrorState
          message="Process data unavailable"
          detail={processError.message}
          onRetry={ownWindowOnly ? trends.reload : ownContext ? context.reload : range.reload}
        />
      ) : (
        <ProcessTrends
          params={params?.process ?? NO_PARAMS}
          rows={rows}
          eventMs={eventMs}
          window={w}
          maxGapMs={maxGapMs}
          scope={
            showEventWindow
              ? 'the event window'
              : ownContext
                ? 'the 7 days around the event'
                : range.fetchedStart != null
                  ? 'the newest 7 days of the range'
                  : 'the selected range'
          }
        />
      )}
      <p className="muted small etrend__foot">
        {event == null
          ? `The kiln-operation trends over the selected range, ${range.thinned ? 'one reading per 5 minutes' : 'every minute reading'}. `
          : ownWindowOnly
            ? 'This event is outside the selected range, so its own window (1 h before to 30 minutes after) is shown. '
            : `The kiln-operation trends over the ${showEventWindow ? 'event window' : 'selected range'}, with every minute reading from 1 h before to 30 minutes after the event. Process tags the RCA names are labelled with its wording, and any others it names follow. The red line is the event; the shaded area is the 30 minutes after it. `}
        Drag across a chart to zoom in.
        {ownContext
          ? ` The range is longer than the 7 days of process data loaded at once, so the 7 days around the event (${formatDateTime(base.start)} – ${formatDateTime(base.end)}) are shown.`
          : range.fetchedStart != null && !ownWindowOnly
            ? ` The range is longer than the 7 days of process data loaded at once, so its newest 7 days (from ${formatDateTime(range.fetchedStart)}) are shown.`
            : ''}
      </p>
    </Panel>
  )

  return (
    <div className="etrend">
      <Panel
        title="Trend Analysis"
        actions={
          <>
            {event ? (
              <button type="button" className="btn btn--sm" onClick={() => onSelect(null)}>
                Close event
              </button>
            ) : null}
            <Badge tone="neutral">Times in {DISPLAY_TIMEZONE}</Badge>
          </>
        }
      >
        <div className="etrend__bar">
          <EventPicker findings={findings} selected={event} onSelect={onSelect} loading={rcaLoading} error={rcaError} />
          {event == null ? (
            <dl className="etrend__meta">
              <div>
                <dt>Showing</dt>
                <dd>Process data for the selected range</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>
                  {formatStamp(range.start)} – {formatStamp(clampEnd(range.end))}
                </dd>
              </div>
              <div>
                <dt>Readings</dt>
                <dd>{range.thinned ? 'One per 5 minutes' : 'Every minute'}</dd>
              </div>
              <div>
                <dt>RCA events in range</dt>
                <dd>{rcaLoading ? '—' : rcaError ? <span className="muted">unavailable</span> : findings.length}</dd>
              </div>
            </dl>
          ) : (
            <dl className="etrend__meta">
              <div>
                <dt>Event time</dt>
                <dd title={event.eventTimeRaw ?? undefined}>{eventMs == null ? '—' : formatFull(eventMs)}</dd>
              </div>
              <div>
                <dt>Event window</dt>
                <dd>
                  {ew ? `${formatTime(ew.start)} – ${formatTime(ew.end)}` : '—'}
                  <span className="muted"> (−1 h / +30 min)</span>
                </dd>
              </div>
              <div>
                <dt>Zone</dt>
                <dd>
                  {zoneOf(event) === 'Undetermined' ? (
                    <span className="muted">—</span>
                  ) : (
                    <ZoneBadge zone={zoneOf(event)} title={zoneDetail(event)} />
                  )}
                </dd>
              </div>
              <div>
                <dt>Predicted C3S (trigger)</dt>
                <dd>
                  {event.c3s == null ? '—' : `${event.c3s.toFixed(2)}%`}
                  {event.c3sGap == null ? null : (
                    <span className="muted">
                      {' '}
                      ({event.c3sGap >= 0 ? '+' : ''}
                      {event.c3sGap.toFixed(2)} vs target)
                    </span>
                  )}
                </dd>
              </div>
              {event.freeLime == null ? null : (
                <div>
                  <dt>Free lime (last lab)</dt>
                  <dd>{event.freeLime.toFixed(2)}%</dd>
                </div>
              )}
            </dl>
          )}
        </div>
        {event == null ? (
          <p className="muted small etrend__hint">
            Open an RCA event, here or with &ldquo;View process trends&rdquo; in the RCA panel, to mark it on
            the zone plots and trends and add its laboratory samples and the process tags it names.
          </p>
        ) : null}
      </Panel>

      {event == null ? (
        <>
          <Panel title="C3S vs Free Lime Zones">
            {rangeLab.loading ? (
              <LoadingState message="Loading clinker samples…" />
            ) : rangeLab.error ? (
              <ErrorState message="Laboratory data unavailable" detail={rangeLab.error.message} onRetry={rangeLab.reload} />
            ) : (
              <ClinkerZones
                rows={rangeLab.rows}
                targets={zoneTargets}
                selected={null}
                scope={`the selected range (${formatStamp(range.start)} – ${formatStamp(clampEnd(range.end))})`}
              />
            )}
          </Panel>
          {processPanel}
        </>
      ) : eventMs == null || params == null ? (
        <EmptyState message="This RCA result carries no event time, so no trend can be placed." />
      ) : (
        <>
          <Panel title="C3S vs Free Lime Zones">
            {trends.labLoading ? (
              <LoadingState message="Loading clinker samples…" />
            ) : trends.labError ? (
              <ErrorState
                message="Laboratory data unavailable"
                detail={trends.labError.message}
                onRetry={trends.reload}
              />
            ) : (
              <ClinkerZones
                rows={trends.labRows}
                targets={zoneTargets}
                selected={event}
                scope={`the ${LAB_LOOKBACK_MS / HOUR_MS} h up to the event`}
              />
            )}
          </Panel>

          <Panel title={`Last ${SAMPLE_COUNT} Laboratory Samples`}>
            <LastSamples params={params.lab} trends={trends} eventMs={eventMs} />
            <p className="muted small">
              Samples taken at or before the event, newest first, from the{' '}
              {LAB_LOOKBACK_MS / HOUR_MS} h before it. Each parameter is sampled on its own schedule,
              so each cell carries its own time.
            </p>
          </Panel>

          {processPanel}
        </>
      )}
    </div>
  )
}
