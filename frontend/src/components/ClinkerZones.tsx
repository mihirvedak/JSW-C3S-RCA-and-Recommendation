/**
 * Actual and predicted C3S against free lime, over the clinker zones.
 *
 *   - Actual: the line's laboratory C3S against the free lime of the same sample.
 *   - Predicted: the line's predicted C3S against the free lime of the last usable laboratory
 *     sample, since free lime itself is not predicted.
 *
 * Both use the insight's targets. RCA events are triggered on predicted C3S: the insight's
 * `c3s` is the predicted value and `fcao` the free lime of the last usable lab, so the selected
 * event is marked on the predicted plot.
 */

import { useMemo } from 'react'
import type { ClinkerTargets, RcaFinding } from '../services/rcaService'
import type { TimestampRow } from '../lib/series'
import { pairActual, pairPredicted, LAST_USABLE_LAB_MS, SAME_SAMPLE_MS } from '../lib/clinkerZones'
import { extractSeries } from '../lib/series'
import { useLine } from '../config/LineContext'
import { formatDateTime, HOUR_MS, MINUTE_MS } from '../lib/time'
import { ClinkerZoneChart } from './ClinkerZoneChart'
import { EmptyState } from './primitives'

export function ClinkerZones({
  rows,
  targets,
  selected,
  scope,
}: {
  rows: readonly TimestampRow[]
  targets: ClinkerTargets | null
  selected: RcaFinding | null
  /** What `rows` cover, for the caption, e.g. "the 96 h up to the event". */
  scope: string
}) {
  const line = useLine()
  const ACTUAL_C3S = line.actualC3S
  const PREDICTED_C3S = line.predictedC3S
  const CLINKER_FREE_LIME = line.freeLime
  const actual = useMemo(() => pairActual(rows, ACTUAL_C3S, CLINKER_FREE_LIME), [rows, ACTUAL_C3S, CLINKER_FREE_LIME])
  const predicted = useMemo(() => pairPredicted(rows, PREDICTED_C3S, CLINKER_FREE_LIME), [rows, PREDICTED_C3S, CLINKER_FREE_LIME])
  // Every C3S value in the rows, so a sample left off for want of a free lime is counted, not lost.
  const totals = useMemo(
    () => ({
      actual: extractSeries(rows, ACTUAL_C3S).length,
      predicted: extractSeries(rows, PREDICTED_C3S).length,
    }),
    [rows, ACTUAL_C3S, PREDICTED_C3S],
  )
  const unpairedActual = totals.actual - actual.length
  const unpairedPredicted = totals.predicted - predicted.length

  const marker = useMemo(
    () =>
      selected?.c3s != null && selected.freeLime != null
        ? { c3s: selected.c3s, freeLime: selected.freeLime, label: `Event ${formatDateTime(selected.eventTime)}` }
        : null,
    [selected],
  )

  if (!targets) {
    return (
      <EmptyState
        message="No targets to draw the zones from."
        hint="The zones are built from the RCA insight's C3S and free-lime targets, and no result in the insight carries them yet."
      />
    )
  }

  const [c3sLo, c3sHi] = targets.c3sBand
  const [flLo, flHi] = targets.freeLimeBand
  const flLabel = line.label(CLINKER_FREE_LIME)

  return (
    <div className="czones">
      <p className="czones__targets">
        Targets from the RCA insight: C3S <strong>{targets.c3s}</strong> (band {c3sLo}–{c3sHi}),
        free lime <strong>{targets.freeLime}</strong> (band {flLo}–{flHi}); lime level = C3S +{' '}
        {targets.limeLevelK} × (free lime − {targets.limeLevelFreeLimeRef}).
      </p>
      <div className="grid grid--2">
        <section className="czones__plot">
          <h4>
            Actual: {line.label(ACTUAL_C3S)} vs free lime{' '}
            <span className="muted">n={actual.length} lab samples</span>
          </h4>
          {actual.length === 0 ? (
            <EmptyState message="No laboratory sample in this range carries both C3S and free lime." />
          ) : (
            <ClinkerZoneChart
              points={actual}
              targets={targets}
              pointColor="#1b2533"
              pointName="Lab sample"
              xTitle="C3S %"
              yTitle={`${flLabel} %`}
              marker={null}
            />
          )}
          {unpairedActual > 0 ? (
            <p className="muted small czones__unpaired">
              {unpairedActual} of {totals.actual} lab C3S results have no free-lime result within{' '}
              {SAME_SAMPLE_MS / MINUTE_MS} min, so they cannot be placed.
            </p>
          ) : null}
        </section>
        <section className="czones__plot">
          <h4>
            Predicted: {line.label(PREDICTED_C3S)} vs free lime{' '}
            <span className="muted">n={predicted.length} predictions</span>
          </h4>
          {predicted.length === 0 ? (
            <EmptyState
              message="No prediction in this range has a laboratory free lime to pair with."
              hint={`A prediction is paired with the newest free-lime result up to ${LAST_USABLE_LAB_MS / HOUR_MS} h before it.`}
            />
          ) : (
            <ClinkerZoneChart
              points={predicted}
              targets={targets}
              pointColor="#1f6fd0"
              pointName="Prediction"
              xTitle="C3S %"
              yTitle={`${flLabel} % of the last usable lab (not predicted)`}
              marker={marker}
            />
          )}
          {unpairedPredicted > 0 ? (
            <p className="muted small czones__unpaired">
              {unpairedPredicted} of {totals.predicted} predictions have no laboratory free lime in the{' '}
              {LAST_USABLE_LAB_MS / HOUR_MS} h before them.
            </p>
          ) : null}
        </section>
      </div>
      <p className="muted small">
        Samples from {scope}.{' '}
        {marker ? 'The red diamond is the selected RCA event, which is triggered on predicted C3S. ' : ''}
        Each prediction is paired with the newest laboratory free lime up to{' '}
        {LAST_USABLE_LAB_MS / HOUR_MS} h before it. The black rectangle is the target box; the
        diagonals are lines of constant lime level.
      </p>
    </div>
  )
}
