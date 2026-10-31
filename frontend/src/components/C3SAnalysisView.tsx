/**
 * C3S Analysis tab, in the whiteboard layout:
 *
 *   1. (scope bar) plant, line and time range
 *   2. RCA classification over the last 48 hours, 15-minute intervals
 *   3. left: predicted vs actual C3S, then laboratory quality parameters (last against
 *      previous sample); right: Root Cause Analysis over Recommendations
 *   4. process monitoring
 *
 * The time picker drives the trend, lab quality and process monitoring; the 48-hour timeline is
 * a fixed span anchored to the newest data. An event is
 * selected from the timeline, a trend marker, or the Older / Newer steps on the RCA panel, and
 * selecting it anywhere selects it everywhere.
 */

import { lazy, Suspense, useMemo } from 'react'
import type { DashboardData, SectionError } from '../hooks/useDashboardData'
import type { Timeline48Data } from '../hooks/useTimeline48'
import type { ClinkerTargets, RcaFinding } from '../services/rcaService'
import { relevantParameters } from '../config/rcaParameters'
import { extractSeries, nearestWithin } from '../lib/series'
import type { Point, TimestampRow } from '../lib/series'
import { buildTimeline } from '../lib/timeline'
import { classifyClinker, pairPredicted } from '../lib/clinkerZones'
import { valueAt } from '../lib/eventTrends'
import { zoneOf, shownZone } from '../lib/zones'
import type { ZoneKey } from '../lib/zones'
import { formatAge, formatFull, HOUR_MS } from '../lib/time'
import { RcaPanel } from './RcaPanel'
import type { ObservedParameter } from './RcaPanel'
import { RecommendationsPanel } from './RecommendationsPanel'
import { RcaTimeline } from './RcaTimeline'
import { LabQuality } from './LabQuality'
import { ProcessMonitor } from './ProcessMonitor'
import { Badge, EmptyState, ErrorState, LoadingState, Panel, ProvenanceTag } from './primitives'
import type { TrendEvent } from './C3STimeline'

const C3STimeline = lazy(() => import('./C3STimeline').then((m) => ({ default: m.C3STimeline })))

/** A laboratory C3S further than this from the event is not "its" sample. */
const NEAREST_LAB_MS = 4 * HOUR_MS

function Stat({
  label,
  value,
  unit,
  time,
  previous,
  now,
  title,
}: {
  label: string
  value: number | null
  unit: string
  time: number | null
  previous?: Point | null
  now: number
  title?: string
}) {
  const delta = value != null && previous ? value - previous.v : null
  return (
    <div className="stat" title={title}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">
        {value == null ? '—' : value.toFixed(2)}
        {value != null ? <span className="stat__unit"> {unit}</span> : null}
        {delta != null && delta !== 0 ? (
          <span className={`stat__delta ${delta > 0 ? 'is-up' : 'is-down'}`} title={`Previous ${previous!.v.toFixed(2)} at ${formatFull(previous!.t)}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
          </span>
        ) : null}
      </span>
      <span className="stat__time" title={time ? formatFull(time) : undefined}>
        {time == null ? 'no sample' : formatAge(time, now)}
      </span>
    </div>
  )
}

const previousOf = (points: readonly Point[]) => (points.length > 1 ? points[points.length - 2] : null)

export function C3SAnalysisView({
  d,
  now,
  selected,
  onSelectId,
  targets,
  timeline,
  eventProcess,
  onOpenTrends,
}: {
  d: DashboardData
  now: number
  selected: RcaFinding | null
  onSelectId: (id: string) => void
  targets: ClinkerTargets | null
  timeline: Timeline48Data
  /** Minute process data around the selected event (1 h before to 30 min after). */
  eventProcess: { rows: readonly TimestampRow[]; loading: boolean; error: SectionError | null }
  onOpenTrends: () => void
}) {
  const line = d.line
  const PREDICTED_C3S = line.predictedC3S
  const ACTUAL_C3S = line.actualC3S
  const CLINKER_FREE_LIME = line.freeLime

  const intervals = useMemo(() => {
    if (timeline.end == null) return []
    return buildTimeline({
      end: timeline.end,
      predictions: extractSeries(timeline.rows, PREDICTED_C3S),
      freeLime: extractSeries(timeline.rows, CLINKER_FREE_LIME),
      findings: d.rcaAll,
      targets,
    })
  }, [timeline.end, timeline.rows, d.rcaAll, targets, PREDICTED_C3S, CLINKER_FREE_LIME])

  // Each prediction's class in the selected range, for the trend tooltip.
  const predictionZones = useMemo(() => {
    const out = new Map<number, ZoneKey>()
    if (!targets) return out
    for (const p of pairPredicted(d.labRows, PREDICTED_C3S, CLINKER_FREE_LIME)) {
      out.set(p.t, classifyClinker(p.c3s, p.freeLime, targets))
    }
    return out
  }, [d.labRows, targets, PREDICTED_C3S, CLINKER_FREE_LIME])

  const trendEvents = useMemo<TrendEvent[]>(
    () =>
      d.rca.flatMap((f) =>
        f.eventTime != null && f.c3s != null ? [{ id: f.id, t: f.eventTime, c3s: f.c3s, zone: shownZone(zoneOf(f)) }] : [],
      ),
    [d.rca],
  )

  const labCheck = useMemo(() => {
    if (selected?.eventTime == null) return null
    const near = nearestWithin(d.actual, selected.eventTime, NEAREST_LAB_MS)
    return near ? { value: near.v, time: near.t } : null
  }, [selected, d.actual])

  // The process tags the RCA names, with their reading at the event. Read from minute data
  // fetched for the event itself, not from the selected range's process data: the range may not
  // contain the event (timeline picks, Older / Newer), and over 24 h it is thinned to 5 minutes.
  const observed = useMemo<ObservedParameter[]>(() => {
    if (!selected) return []
    const at = selected.eventTime
    return relevantParameters(selected, line).process.map((p) => {
      const def = line.describe(p.key)
      const point = at == null ? null : valueAt(extractSeries(eventProcess.rows, p.key), at)
      return { key: p.key, label: def.label, unit: def.unit, value: point?.v ?? null, sources: p.sources }
    })
  }, [selected, eventProcess.rows, line])


  const latestPredicted = d.predicted[d.predicted.length - 1] ?? null
  const latestActual = d.actual[d.actual.length - 1] ?? null
  const lastError = d.matched.filter((m) => m.error != null).slice(-1)[0] ?? null
  const band = targets ? { low: targets.c3sBand[0], high: targets.c3sBand[1] } : d.band


  // Events in range are newest first; "older" steps down the list.
  const idx = selected ? d.rca.findIndex((f) => f.id === selected.id) : -1
  const eventNav = (
    <div className="event-nav">
      <Badge tone="info">{d.rca.length} in range</Badge>
      <button
        type="button"
        className="btn btn--sm"
        disabled={idx < 0 || idx >= d.rca.length - 1}
        onClick={() => onSelectId(d.rca[idx + 1].id)}
        aria-label="Older RCA event"
      >
        ← Older
      </button>
      <span className="event-nav__pos" aria-live="polite">
        {idx >= 0 ? `${idx + 1} of ${d.rca.length}` : selected ? 'outside range' : '—'}
      </span>
      <button
        type="button"
        className="btn btn--sm"
        disabled={idx <= 0}
        onClick={() => onSelectId(d.rca[idx - 1].id)}
        aria-label="Newer RCA event"
      >
        Newer →
      </button>
      <ProvenanceTag kind="retrieved" />
    </div>
  )

  return (
    <div className="analysis">
      {/* 2 — last 48 hours */}
      <Panel
        title="RCA Classification — Last 48 Hours"
        className="panel--tight"
        actions={<span className="muted small">Predicted C3S, 15-minute intervals</span>}
      >
        {timeline.error ? (
          <ErrorState message="Timeline data unavailable" detail={timeline.error.message} onRetry={d.refresh} />
        ) : timeline.loading || d.rcaLoading ? (
          <LoadingState message="Loading the last 48 hours…" />
        ) : (
          <RcaTimeline
            intervals={intervals}
            selectedEventId={selected?.id ?? null}
            onSelectEvent={(f) => onSelectId(f.id)}
          />
        )}
      </Panel>

      {/* 3 — two columns */}
      <div className="analysis__main">
        <div className="analysis__col">
          <Panel title="Predicted vs Actual C3S">
            <div className="stats">
              <Stat
                label={line.label(PREDICTED_C3S)}
                value={latestPredicted?.v ?? null}
                unit="%"
                time={latestPredicted?.t ?? null}
                previous={previousOf(d.predicted)}
                now={now}
                title={`${PREDICTED_C3S} · latest in range`}
              />
              <Stat
                label={line.label(ACTUAL_C3S)}
                value={latestActual?.v ?? null}
                unit="%"
                time={latestActual?.t ?? null}
                previous={previousOf(d.actual)}
                now={now}
                title={`${ACTUAL_C3S} · latest in range`}
              />
              <Stat
                label="Prediction error"
                value={lastError?.error ?? null}
                unit="pp"
                time={lastError?.labTime ?? null}
                now={now}
                title="Actual − predicted, latest matched sample"
              />
            </div>
            {d.labLoading ? (
              <LoadingState message="Loading C3S history…" />
            ) : (
              <Suspense fallback={<LoadingState message="Loading chart…" />}>
                <C3STimeline
                  predicted={d.predicted}
                  actual={d.actual}
                  matched={d.matched}
                  band={band}
                  target={targets?.c3s ?? null}
                  windowStart={d.windowStart}
                  windowEnd={d.windowEnd}
                  selectedTime={selected?.eventTime ?? null}
                  events={trendEvents}
                  onSelectEvent={onSelectId}
                  predictionZones={predictionZones}
                  onSelect={(labTime) => {
                    // A lab point selects the nearest RCA event within ±4 h, if there is one.
                    let best: RcaFinding | null = null
                    let bestDist = Infinity
                    for (const f of d.rca) {
                      if (f.eventTime == null) continue
                      const dist = Math.abs(f.eventTime - labTime)
                      if (dist < bestDist) {
                        bestDist = dist
                        best = f
                      }
                    }
                    if (best && bestDist <= NEAREST_LAB_MS) onSelectId(best.id)
                  }}
                />
              </Suspense>
            )}
          </Panel>

          <Panel title="Laboratory Quality Parameters">
            {d.labLoading ? (
              <LoadingState message="Loading laboratory readings…" />
            ) : (
              <>
                {d.labRows.length === 0 ? (
                  <p className="notice notice--warn" role="status">
                    <strong>No laboratory readings in the selected range.</strong> Each parameter below says when the
                    platform last saw it.
                  </p>
                ) : null}
                <LabQuality latest={d.labLatest} newest={d.labNewest} rows={d.labRows} now={now} />
              </>
            )}
          </Panel>
        </div>

        <div className="analysis__col">
          <Panel title="Root Cause Analysis" actions={eventNav}>
            <RcaPanel
              finding={selected}
              labCheck={labCheck}
              observed={observed}
              observedStatus={eventProcess.loading ? 'loading' : eventProcess.error ? 'error' : 'ready'}
              error={d.rcaError}
              loading={d.rcaLoading}
              onRetry={d.refresh}
              onOpenTrends={onOpenTrends}
              emptyHint={
                d.rcaTotal > 0
                  ? `The insight holds ${d.rcaTotal} analysed deviations in total. Widen the range, or pick one in the 48-hour timeline.`
                  : 'The insight has returned no results.'
              }
            />
            {d.rcaMalformed > 0 ? (
              <p className="muted small">{d.rcaMalformed} result(s) could not be parsed and were skipped.</p>
            ) : null}
          </Panel>
          <Panel title="Recommendations" actions={<ProvenanceTag kind="retrieved" />}>
            {d.rcaError || d.rcaLoading ? (
              <EmptyState message={d.rcaError ? 'Recommendations unavailable: the RCA insight could not be read.' : 'Loading…'} />
            ) : (
              <RecommendationsPanel finding={selected} />
            )}
          </Panel>
        </div>
      </div>

      {/* 4 — process monitoring */}
      <Panel title="Process Monitoring">
          {d.processNote ? (
            <div className="notice notice--warn" role="status">
              <strong>Showing the most recent 7 days of the selected range</strong> (from{' '}
              {formatFull(d.processNote.fetchedStart)}). Process sensors report about once a
              minute, so longer spans are shortened to keep the page responsive.
            </div>
          ) : null}
          {d.processLoading ? (
            <LoadingState message="Loading process data…" />
          ) : d.processError ? (
            <ErrorState message="Process data unavailable" detail={d.processError.message} onRetry={d.refresh} />
          ) : d.processRows.length === 0 ? (
            <EmptyState message="No process readings in the selected range." />
          ) : (
            <ProcessMonitor
              rows={d.processRows}
              latest={d.processLatest}
              now={now}
              eventMarkerMs={selected?.eventTime ?? null}
              windowStart={d.processNote?.fetchedStart ?? d.windowStart}
              windowEnd={d.windowEnd}
            />
          )}
        </Panel>
    </div>
  )
}
