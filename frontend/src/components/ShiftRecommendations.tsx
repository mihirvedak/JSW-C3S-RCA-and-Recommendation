/**
 * The RCA insight's findings for the last completed shifts.
 *
 * Each shift shows only what the insight gives for it:
 *   - which shift and its time,
 *   - the root cause analysis: the drivers the insight named for the shift's RCA events (or the
 *     causes its own shift summary names), each with the insight's wording and grading,
 *   - the complete recommendations: the insight's shift summary ("C3S RCA Shift", matched by
 *     `lib/shiftSummaries.ts`) when it wrote one, otherwise the actions of the shift's events.
 * A recommendation that calls for SHC optimisation carries the link to the SHC Optimizer.
 * The summary's own report text, notes and bookkeeping fields are not shown.
 */

import { Badge, EmptyState, ErrorState, LoadingState, ProvenanceTag } from './primitives'
import type { RcaItem, ShiftSummary } from '../services/rcaService'
import { summaryForShift } from '../lib/shiftSummaries'
import type { Tone } from './primitives'
import { formatShiftRange } from '../lib/shifts'
import type { CauseSummary, ShiftReport } from '../lib/shiftReport'
import { needsShcOptimizer } from '../lib/recommendations'
import { ShcOptimizerLink } from './ShcOptimizerLink'

const n1 = (v: number) => v.toFixed(1)
const signed = (v: number, digits = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`

function severityTone(s: CauseSummary['severity']): Tone {
  return s === 'cause' ? 'low' : s === 'watch' ? 'warn' : 'neutral'
}

/** "Hold: re-check …" → a "Hold" tag and the rest of the sentence. */
const ACTION_KIND = /^(hold|check|watch|note)\s*:\s*/i

function ActionLine({ text }: { text: string }) {
  const m = ACTION_KIND.exec(text)
  return (
    <li className="shift__action">
      <p className="shift__action-text">
        {m ? <Badge tone="neutral">{m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()}</Badge> : null}
        {m ? text.slice(m[0].length) : text}
      </p>
      {needsShcOptimizer(text) ? <ShcOptimizerLink /> : null}
    </li>
  )
}

function RootCauses({ report, summaryCauses }: { report: ShiftReport; summaryCauses: readonly RcaItem[] }) {
  const total = report.events.length
  return (
    <section className="shift__section">
      <h4>
        Root cause analysis <ProvenanceTag kind="retrieved" />
      </h4>
      {summaryCauses.length > 0 ? (
        <ul className="shift__list">
          {summaryCauses.map((c) => (
            <li key={`${c.label}|${c.text}`}>
              <span className="shift__item-title">{c.label}</span>
              <p className="shift__evidence">{c.text}</p>
            </li>
          ))}
        </ul>
      ) : report.causes.length > 0 ? (
        <ul className="shift__list">
          {report.causes.map((c) => (
            <li key={`${c.label}|${c.example}`}>
              <div className="shift__item-head">
                <span className="shift__item-title">{c.label}</span>
                {c.severity ? <Badge tone={severityTone(c.severity)}>{c.severity}</Badge> : null}
                {total > 1 ? (
                  <span className="shift__count">
                    {c.count} of {total} events
                  </span>
                ) : null}
              </div>
              <p className="shift__evidence">{c.example}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">
          {total === 0
            ? 'The RCA insight analysed no deviation in this shift.'
            : 'The RCA insight named no root cause for this shift’s events.'}
        </p>
      )}
    </section>
  )
}

function Recommendations({ report, summary }: { report: ShiftReport; summary: ShiftSummary | null }) {
  const total = report.events.length
  // The insight's own shift recommendations when it wrote them; else what its events advised.
  const fromSummary = summary?.recommendations ?? []
  const lines = fromSummary.length > 0 ? fromSummary : report.holds
  const moves = fromSummary.length > 0 ? [] : report.actions
  const linked = lines.some((l) => needsShcOptimizer(l)) || moves.some((a) => a.examples.some((e) => needsShcOptimizer(a.label, e.text)))

  return (
    <section className="shift__section shift__section--action">
      <h4>
        Recommendations <ProvenanceTag kind="retrieved" />
      </h4>
      {moves.length === 0 && lines.length === 0 ? (
        <p className="muted small">The RCA insight made no recommendation for this shift.</p>
      ) : (
        <ul className="shift__actions">
          {moves.map((a) => {
            const first = a.examples[0]
            return (
              <li key={`${a.label}|${a.direction}`} className="shift__action">
                <div className="shift__item-head">
                  <span className="shift__item-title">
                    {a.direction === 'increase' ? 'Increase' : 'Reduce'} {a.label}
                  </span>
                  <span className="shift__delta">
                    {signed(a.meanChange)}
                    {a.unit ? ` ${a.unit}` : ''}
                  </span>
                  {total > 1 ? (
                    <span className="shift__count">
                      {a.count} of {total} events
                    </span>
                  ) : null}
                </div>
                {first ? (
                  <p className="shift__evidence">
                    {n1(first.from)} → {n1(first.to)}
                    {first.unit ? ` ${first.unit}` : ''}
                    {first.lo != null && first.hi != null ? `, limits ${n1(first.lo)}–${n1(first.hi)}` : ''}
                  </p>
                ) : null}
                {a.examples.some((e) => needsShcOptimizer(a.label, e.text)) ? <ShcOptimizerLink /> : null}
              </li>
            )
          })}
          {lines.map((l) => (
            <ActionLine key={l} text={l} />
          ))}
        </ul>
      )}
      {/* The insight flags the shift for the optimizer without naming it in an action. */}
      {summary?.shcOptimizer && !linked ? <ShcOptimizerLink /> : null}
    </section>
  )
}

function ShiftBlock({
  report,
  ordinal,
  summaries,
}: {
  report: ShiftReport
  ordinal: string
  summaries: readonly ShiftSummary[]
}) {
  const summary = summaryForShift(summaries, report.shift)?.summary ?? null
  const n = report.events.length
  return (
    <article className="shift" aria-label={`Shift ${report.shift.id}`}>
      <header className="shift__head">
        <div>
          <span className="shift__ordinal">{ordinal}</span>
          <h3 className="shift__title">Shift {report.shift.id}</h3>
          <span className="shift__range">{formatShiftRange(report.shift)}</span>
        </div>
        <Badge tone={n ? 'info' : 'neutral'}>{n ? `${n} RCA event${n === 1 ? '' : 's'}` : 'No RCA events'}</Badge>
      </header>

      <RootCauses report={report} summaryCauses={summary?.causes ?? []} />
      <Recommendations report={report} summary={summary} />
    </article>
  )
}

export function ShiftRecommendations({
  reports,
  loading,
  error,
  summaries = [],
  dayMode = false,
}: {
  reports: readonly ShiftReport[]
  /** Every shift summary the RCA insight holds; each block picks its own. */
  summaries?: readonly ShiftSummary[]
  /** Showing one picked day's shifts (in time order) rather than the last completed ones. */
  dayMode?: boolean
  loading: boolean
  error: { message: string; isAuth: boolean } | null
}) {
  if (error) {
    return <ErrorState message="Shift data unavailable" detail={error.message} />
  }
  if (loading) return <LoadingState message="Loading shift data…" />
  if (reports.length === 0) {
    return (
      <EmptyState
        message={dayMode ? 'No completed shift with RCA results on this day yet.' : 'No completed shift in the selected range.'}
      />
    )
  }
  return (
    <div className="shifts">
      {reports.map((r, i) => (
        <ShiftBlock
          key={`${r.shift.id}-${r.shift.start}`}
          report={r}
          ordinal={dayMode ? `Shift ${i + 1} of ${reports.length} with RCA results` : i === 0 ? 'Last shift' : 'Previous shift'}
          summaries={summaries}
        />
      ))}
    </div>
  )
}
