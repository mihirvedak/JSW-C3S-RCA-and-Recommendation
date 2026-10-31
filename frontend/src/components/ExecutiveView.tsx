/**
 * Executive View — the management summary.
 *
 * Laid out as in the reference sketch:
 *
 *   left column                          right column
 *   ─ C3S distribution (actual|pred)     ─ Actual vs predicted C3S trend
 *   ─ Specification compliance table     ─ Last two completed shifts
 *
 * Everything is driven by the same global time selection and the same loaded data as the
 * analysis tab (`d`), so the histogram, trend and compliance table always describe the
 * range shown in the time picker. Only the shift recommendations load their own data, for
 * the shift windows themselves.
 */

import { lazy, Suspense, useMemo, useState } from 'react'
import { Badge, EmptyState, LoadingState, Panel } from './primitives'
import { ComplianceTable } from './ComplianceTable'
import type { ComplianceRow } from '../lib/compliance'
import { BIN_PARAMETERS, binLimitTags } from '../config/binLimits'
import { binCompliance } from '../lib/binCompliance'
import type { BinStatus } from '../lib/binCompliance'
import { ShiftRecommendations } from './ShiftRecommendations'
import { SPEC_ROWS } from '../config/specLimits'
import {
  ACTUAL_C3S,
  LAB_DEVICE,
  PREDICTED_C3S,
  PROCESS_DEVICE,
  getSensor,
  sensorLabel,
} from '../config/deviceMappings'
import { compliance, limitsAreOrdered } from '../lib/compliance'
import { histogramSet } from '../lib/histogram'
import { extractSeries } from '../lib/series'
import { formatFull } from '../lib/time'
import { lastCompletedShifts, useShiftReports } from '../hooks/useShiftReports'
import { SHIFTS } from '../config/shifts'
import { formatDay, rcaDays } from '../lib/rcaDays'
import { clampEnd } from '../config/dataWindow'
import { PROCESS_THIN_ABOVE_MS } from '../hooks/useDashboardData'
import type { DashboardData } from '../hooks/useDashboardData'

// Highcharts is the largest dependency, so the two charts load on demand.
const C3STimeline = lazy(() =>
  import('./C3STimeline').then((m) => ({ default: m.C3STimeline })),
)
const C3SHistogram = lazy(() =>
  import('./C3SHistogram').then((m) => ({ default: m.C3SHistogram })),
)

type Dataset = 'actual' | 'predicted'

const DATASETS: ReadonlyArray<{ id: Dataset; label: string; color: string; sensorId: string }> = [
  { id: 'actual', label: 'Actual', color: '#1f6fd0', sensorId: ACTUAL_C3S },
  { id: 'predicted', label: 'Predicted', color: '#0f9b74', sensorId: PREDICTED_C3S },
]

/** One-point bins normally; half-point bins when the data spans only a few points. */
function binWidthFor(values: readonly number[]): number {
  if (values.length === 0) return 1
  const span = Math.max(...values) - Math.min(...values)
  return span < 4 ? 0.5 : 1
}

const noop = () => {}

export function ExecutiveView({ d, now }: { d: DashboardData; now: number }) {
  const [dataset, setDataset] = useState<Dataset>('actual')

  /* ---------------- histogram ---------------- */

  const hist = useMemo(() => {
    const actual = d.actual.map((p) => p.v)
    const predicted = d.predicted.map((p) => p.v)
    return histogramSet({ actual, predicted }, binWidthFor([...actual, ...predicted]))
  }, [d.actual, d.predicted])

  const active = DATASETS.find((x) => x.id === dataset) as (typeof DATASETS)[number]
  const activeHist = hist[dataset]
  const seriesName = sensorLabel(LAB_DEVICE, active.sensorId)

  /* ---------------- compliance ---------------- */

  // Process data is dense, so a long range is shortened and thinned; the table says which.
  const processNote = useMemo(() => {
    if (d.processNote) {
      return `Most recent 7 days of the range (from ${formatFull(d.processNote.fetchedStart)}), 5-minute readings`
    }
    if (d.windowStart != null && d.windowEnd != null && d.windowEnd - d.windowStart > PROCESS_THIN_ABOVE_MS) {
      return '5-minute readings'
    }
    return null
  }, [d.processNote, d.windowStart, d.windowEnd])

  const rows = useMemo<ComplianceRow[]>(() => {
    const fmt = (v: number | null) => (v == null ? '—' : String(v))

    // Laboratory parameters: one fixed LSL / USL each (config/specLimits.ts).
    const lab = SPEC_ROWS.map((r): ComplianceRow => {
      const values = extractSeries(d.labRows, r.sensorId).map((p) => p.v)
      const unit = getSensor(r.devID, r.sensorId)?.unit ?? null
      const ordered = limitsAreOrdered(r)
      // An LSL above the USL is a configuration mistake: classify nothing rather than guess.
      const c = compliance(values, ordered ? r : { lsl: null, usl: null })
      return {
        key: `${r.devID}:${r.sensorId}`,
        label: sensorLabel(r.devID, r.sensorId),
        limitsText: `LSL ${fmt(r.lsl)} · USL ${fmt(r.usl)}${unit ? ` ${unit}` : ''}${r.basis ? ` · ${r.basis}` : ''}`,
        countText: `${c.n} sample${c.n === 1 ? '' : 's'}`,
        below: c.below,
        within: c.within,
        above: c.above,
        message: !ordered
          ? 'LSL is above USL — check the configuration'
          : c.status === 'no-limits'
            ? 'Limits not configured'
            : c.status === 'no-data'
              ? 'No samples in the selected range'
              : null,
        note: null,
      }
    })

    // Process parameters: each reading against the limits of its kiln-feed bin (config/binLimits.ts).
    const tags = binLimitTags()
    const MESSAGE: Partial<Record<BinStatus, string>> = {
      nolimits: 'No limits in the table',
      nodata: 'No readings in the selected range',
      unjudged: 'No reading at a binned kiln feed (370–565 t/h)',
      units: 'Units may not match the limit table',
    }
    const process = BIN_PARAMETERS.flatMap((name): ComplianceRow[] => {
      const id = tags.get(name)
      if (!id) return []
      const unit = getSensor(PROCESS_DEVICE, id)?.unit ?? null
      const r = binCompliance(d.processRows, name, id)
      const graded = r.grade && r.grade !== 'USABLE' ? ` · table: ${r.grade.toLowerCase()}` : ''
      return [
        {
          key: `${PROCESS_DEVICE}:${id}`,
          label: name,
          limitsText: `LSL – USL of the kiln-feed bin${unit ? ` (${unit})` : ''}${graded}`,
          countText: `${r.judged} reading${r.judged === 1 ? '' : 's'} judged${r.notJudged ? ` · ${r.notJudged} not judged` : ''}`,
          below: r.belowPct,
          within: r.pct,
          above: r.abovePct,
          message: d.processLoading
            ? 'Loading…'
            : d.processError
              ? 'Process data unavailable'
              : (MESSAGE[r.status] ?? null),
          note: processNote,
        },
      ]
    })
    return [...lab, ...process]
  }, [d.labRows, d.processRows, processNote, d.processLoading, d.processError])

  /* ---------------- shifts ---------------- */

  // The dropdown offers the days on which the insight produced RCA events or shift summaries.
  const days = useMemo(() => rcaDays(SHIFTS, d.rcaAll, d.rcaShifts), [d.rcaAll, d.rcaShifts])
  const [shiftDay, setShiftDay] = useState<string>('last')
  const picked = shiftDay === 'last' ? null : (days.find((x) => x.key === shiftDay) ?? null)
  const lastShifts = useMemo(() => lastCompletedShifts(d.windowEnd, now), [d.windowEnd, now])
  // A picked day shows its completed shifts that hold RCA content, in the order they ran.
  const dayShifts = useMemo(
    () => (picked ? [...picked.shifts.values()].filter((w) => w.end <= clampEnd(now)).sort((a, b) => a.start - b.start) : null),
    [picked, now],
  )
  const loaded = useMemo(
    () => ({
      start: d.windowStart,
      end: d.windowEnd,
      labRows: d.labRows,
      labLoading: d.labLoading,
      labError: d.labError,
      processRows: d.processRows,
      processLoading: d.processLoading,
      processFailed: d.processError != null,
      fullProcess: d.processFull,
    }),
    [d.windowStart, d.windowEnd, d.labRows, d.labLoading, d.labError, d.processRows, d.processLoading, d.processError, d.processFull],
  )
  const shifts = useShiftReports(dayShifts ?? lastShifts, d.rcaAll, d.refreshKey, d.line, loaded)

  // Without the insight's findings every shift would read "no deviation analysed", which would
  // be false. A failed or still-loading insight is reported as that, not as an empty result.
  const shiftError =
    shifts.error ??
    (d.rcaError
      ? { message: `RCA insight unavailable — ${d.rcaError.message}`, isAuth: d.rcaError.isAuth }
      : null)
  const shiftLoading = shifts.loading || d.rcaLoading

  return (
    <div className="exec">
      <div className="exec__col">
        <Panel
          title="C3S Distribution"
          actions={
            <>
              <Badge tone="info">n = {activeHist.total}</Badge>
              <div className="toggle" role="group" aria-label="C3S dataset">
                {DATASETS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={`toggle__btn ${dataset === x.id ? 'is-active' : ''}`}
                    aria-pressed={dataset === x.id}
                    onClick={() => setDataset(x.id)}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </>
          }
        >
          {d.labLoading ? (
            <LoadingState message="Loading C3S history…" />
          ) : activeHist.total === 0 ? (
            <EmptyState
              message={`No ${active.label.toLowerCase()} C3S samples in the selected range.`}
              hint="Pick a longer range, or one of the “Last …” ranges, which end at the newest data."
            />
          ) : (
            <Suspense fallback={<LoadingState message="Loading chart…" />}>
              <C3SHistogram histogram={activeHist} seriesName={seriesName} color={active.color} />
            </Suspense>
          )}
        </Panel>

        <Panel title="Specification Compliance">
          {d.labLoading ? (
            <LoadingState message="Loading laboratory readings…" />
          ) : (
            <ComplianceTable rows={rows} />
          )}
        </Panel>
      </div>

      <div className="exec__col">
        <Panel title="Actual vs Predicted C3S">
          {d.labLoading ? (
            <LoadingState message="Loading C3S history…" />
          ) : (
            <Suspense fallback={<LoadingState message="Loading chart…" />}>
              <C3STimeline
                predicted={d.predicted}
                actual={d.actual}
                matched={d.matched}
                band={d.band}
                windowStart={d.windowStart}
                windowEnd={d.windowEnd}
                selectedTime={null}
                onSelect={noop}
              />
            </Suspense>
          )}
        </Panel>

        <Panel
          title={picked ? `Shifts on ${formatDay(picked.day)}` : 'Last Two Completed Shifts'}
          actions={
            <select
              className="field__input shift-day"
              aria-label="Show the shifts of a day with RCA results"
              value={picked ? picked.key : 'last'}
              onChange={(e) => setShiftDay(e.target.value)}
              disabled={d.rcaLoading || days.length === 0}
            >
              <option value="last">Last two completed</option>
              {days.map((x) => (
                <option key={x.key} value={x.key}>
                  {formatDay(x.day)} · {x.events} RCA event{x.events === 1 ? '' : 's'}
                  {x.summaries ? ` · ${x.summaries} shift summar${x.summaries === 1 ? 'y' : 'ies'}` : ''}
                </option>
              ))}
            </select>
          }
        >
          <ShiftRecommendations
            reports={shifts.reports}
            loading={shiftLoading}
            error={shiftError}
            summaries={d.rcaShifts}
            dayMode={picked != null}
          />
        </Panel>
      </div>
    </div>
  )
}
