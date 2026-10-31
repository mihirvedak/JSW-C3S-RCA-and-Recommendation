/**
 * Recommendations for the selected RCA event, exactly as the insight gives them.
 *
 * Each action shows the parameter, its current and suggested values and the insight's limits
 * when the sentence states them (`lib/recommendations.ts`). When the insight advises no
 * change, that is said outright. Nothing here is computed, sized or applied: these are the
 * insight's recommendations for an engineer to validate.
 */

import type { RcaFinding } from '../services/rcaService'
import { findingActions } from '../lib/recommendations'
import type { Action } from '../lib/recommendations'
import { EmptyState } from './primitives'
import { ShcOptimizerLink } from './ShcOptimizerLink'

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : String(v))

function ActionRow({ a }: { a: Action }) {
  const numeric = a.from != null && a.to != null
  return (
    <li className={`rec__action ${a.hold ? 'is-hold' : ''}`}>
      <div className="rec__head">
        <span className="rec__param">{a.parameter || (a.hold ? 'Set points' : 'Action')}</span>
        {numeric ? (
          <span className="rec__values">
            <span title="Current value, as the insight states it">{fmt(a.from!)}</span>
            <span aria-hidden="true"> → </span>
            <strong title="Suggested value">{fmt(a.to!)}</strong>
            {a.unit ? <span className="muted"> {a.unit}</span> : null}
            {a.change ? <span className={`rec__delta ${a.to! >= a.from! ? 'is-up' : 'is-down'}`}>{a.change}</span> : null}
          </span>
        ) : null}
      </div>
      {a.lo != null && a.hi != null ? (
        <p className="rec__limits">
          Operating limits {fmt(a.lo)} to {fmt(a.hi)} {a.unit}
          {numeric && (a.to! < a.lo || a.to! > a.hi) ? (
            <strong className="rec__warn"> · suggested value is outside these limits</strong>
          ) : null}
        </p>
      ) : null}
      <p className="rec__text">{a.text}</p>
      {a.shcOptimizer ? <ShcOptimizerLink /> : null}
    </li>
  )
}

export function RecommendationsPanel({ finding }: { finding: RcaFinding | null }) {
  if (!finding) return <EmptyState message="Select an RCA event to see its recommendations." />

  const actions = findingActions(finding)
  const moves = actions.filter((a) => !a.hold)

  return (
    <div className="rec">
      {moves.length === 0 ? (
        <p className="rec__none" role="note">
          <strong>No set-point change is recommended</strong> for this event.
        </p>
      ) : null}

      {actions.length > 0 ? (
        <ul className="rec__actions">
          {(moves.length > 0 ? moves : actions).map((a, i) => (
            <ActionRow key={`${a.parameter}|${i}`} a={a} />
          ))}
        </ul>
      ) : (
        <p className="muted small">The insight supplied no recommendation for this event.</p>
      )}

      {finding.outcomes.length > 0 ? (
        <section className="rec__section">
          <h4>Expected outcome</h4>
          <ul className="rca__items">
            {finding.outcomes.map((o) => (
              <li key={o.label}>
                <span className="rca__item-label">{o.label}</span>
                <span className="rca__item-text">{o.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="rec__foot">
        From the RCA insight. Nothing is applied automatically: validate with the process engineer
        before changing a set point.
      </p>
    </div>
  )
}
