/**
 * Root Cause Analysis panel.
 *
 * Renders what the line's RCA insight returned for one deviation: its classification and the
 * highs and lows it names; the event time, the predicted C3S that triggered it, the nearest
 * laboratory C3S and the free lime; then its evidence and the process parameters it names, with
 * their values at the event. The insight emits no confidence score, so none is shown.
 * Recommendations are a separate panel (`RecommendationsPanel`).
 */

import type { RcaFinding, RcaSeverity } from '../services/rcaService'
import { triggerIsLab } from '../services/rcaService'
import { Badge, EmptyState, ErrorState } from './primitives'
import type { Tone } from './primitives'
import { ZoneBadge } from './ZoneBadge'
import { formatFull, formatTime } from '../lib/time'
import { zoneDetail, zoneOf } from '../lib/zones'
import { highsAndLows, itemSubject } from '../lib/rcaHighlights'

function severityTone(severity: RcaSeverity): Tone {
  switch (severity) {
    case 'cause':
      return 'low'
    case 'watch':
      return 'warn'
    default:
      return 'neutral'
  }
}

/** A process parameter the RCA names, with its reading at the event. */
export interface ObservedParameter {
  key: string
  label: string
  unit: string | null
  value: number | null
  /** Why it is listed, in the insight's wording. */
  sources: string[]
}

/** The laboratory C3S nearest the event. */
export interface LabCheck {
  value: number
  time: number
}

const isProblem = (label: string) => /^problem\b/i.test(label.trim())

export function RcaPanel({
  finding,
  labCheck,
  modelCheck,
  observed,
  observedStatus,
  error,
  loading,
  onRetry,
  onOpenTrends,
  emptyHint,
}: {
  finding: RcaFinding | null
  labCheck: LabCheck | null
  /** The model's prediction nearest the event, shown when the insight ran on the laboratory C3S. */
  modelCheck: LabCheck | null
  observed: readonly ObservedParameter[]
  /** Whether the minute process data around the event has loaded. */
  observedStatus: 'loading' | 'error' | 'ready'
  error: { message: string; isAuth: boolean } | null
  loading: boolean
  onRetry: () => void
  /** Opens the Trend Analysis tab on this finding. */
  onOpenTrends?: () => void
  /** What to say when the selected range holds no RCA event. */
  emptyHint?: string
}) {
  if (error) {
    return <ErrorState message="RCA insight unavailable" detail={error.message} onRetry={onRetry} />
  }
  if (loading) return <EmptyState message="Loading RCA findings…" />
  if (!finding) {
    return (
      <EmptyState
        message="No analysed deviations in the selected range."
        hint={emptyHint ?? 'Pick an event in the 48-hour timeline or on the trend.'}
      />
    )
  }

  const moves = highsAndLows(finding)
  const problem = finding.rootCauses.find((c) => isProblem(c.label))
  const evidence = finding.rootCauses.filter((c) => !isProblem(c.label))

  return (
    <div className="rca">
      <header className="rca__summary">
        <div className="rca__summary-main">
          {/* An unclassified result gets no badge: "Undetermined" is not shown. */}
          {zoneOf(finding) !== 'Undetermined' ? <ZoneBadge zone={zoneOf(finding)} title={zoneDetail(finding)} /> : null}
          {onOpenTrends && finding.eventTime != null ? (
            <a
              href="#trend-analysis"
              className="rca__trend-link"
              onClick={(e) => {
                e.preventDefault()
                onOpenTrends()
              }}
            >
              View process trends →
            </a>
          ) : null}
        </div>

        {moves.length > 0 ? (
          <div className="rca__moves" aria-label="Highs and lows the insight names">
            {moves.map((m) => (
              <span
                key={m.name}
                className={`move ${m.severity ? `move--${m.severity}` : ''}`}
                title={`${m.name} ${m.dir}${m.severity ? ` (${m.severity})` : ''}`}
              >
                {m.name} {m.dir === 'high' ? '↑' : '↓'}
              </span>
            ))}
          </div>
        ) : null}

        <dl className="rca__meta rca__meta--four">
          <div>
            <dt>Event time</dt>
            <dd title={finding.eventTimeRaw ?? undefined}>{formatFull(finding.eventTime)}</dd>
          </div>
          {triggerIsLab(finding) ? (
            <>
              <div>
                <dt>Lab C3S (trigger)</dt>
                <dd title="The laboratory C3S this RCA was run on (the insight states its source: lab C3S)">
                  {finding.c3s == null ? '—' : `${finding.c3s.toFixed(2)}%`}
                </dd>
              </div>
              <div>
                <dt>Predicted C3S</dt>
                <dd title={modelCheck ? `Model prediction at ${formatFull(modelCheck.time)}` : 'No model prediction within 30 min of the event'}>
                  {modelCheck ? `${modelCheck.value.toFixed(2)}%` : '—'}
                </dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Predicted C3S</dt>
                <dd title="The predicted C3S that triggered this RCA event">
                  {finding.c3s == null ? '—' : `${finding.c3s.toFixed(2)}%`}
                </dd>
              </div>
              <div>
                <dt>Actual C3S (lab)</dt>
                <dd title={labCheck ? `Lab sample ${formatFull(labCheck.time)}` : 'No laboratory C3S within 4 h of the event'}>
                  {labCheck ? `${labCheck.value.toFixed(2)}%` : '—'}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>Free lime</dt>
            <dd title="Free lime of the last laboratory sample before the event, as the insight reports it">
              {finding.freeLime == null ? '—' : `${finding.freeLime.toFixed(2)}%`}
            </dd>
          </div>
        </dl>
      </header>

      {problem ? (
        <p className="rca__problem">
          <strong>Problem.</strong> {problem.text}
        </p>
      ) : null}

      <section className="rca__section">
        <h4>Primary cause and evidence</h4>
        <p className="rca__primary">
          {finding.primaryCause ? (
            <>
              <strong>{finding.primaryCause}</strong>
            </>
          ) : (
            <span className="muted">The insight names no primary cause.</span>
          )}
        </p>
        {evidence.length === 0 ? (
          <p className="muted small">The insight supplied no evidence for this event.</p>
        ) : (
          <ul className="rca__items">
            {evidence.map((c) => (
              <li key={c.label}>
                <span className="rca__item-label">
                  {itemSubject(c) === c.label ? c.label : `${c.label} · ${itemSubject(c)}`}
                  {c.severity ? <Badge tone={severityTone(c.severity)}>{c.severity}</Badge> : null}
                </span>
                <span className="rca__item-text">{c.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {observed.length > 0 ? (
        <section className="rca__section">
          <h4>Relevant process parameters at the event</h4>
          <table className="rca__params">
            <tbody>
              {observed.map((p) => (
                <tr key={p.key}>
                  <th scope="row">
                    {p.label}
                    <span className="rca__param-why">{p.sources.join(' · ')}</span>
                  </th>
                  <td className="num">
                    {observedStatus === 'loading' ? (
                      <span className="muted">loading…</span>
                    ) : observedStatus === 'error' ? (
                      <span className="muted" title="The process data around the event could not be loaded">unavailable</span>
                    ) : p.value == null ? (
                      <span
                        className="muted"
                        title={
                          finding.eventTime == null
                            ? 'The event has no time'
                            : `The tag reported nothing between ${formatTime(finding.eventTime - 5 * 60_000)} and ${formatTime(finding.eventTime)}`
                        }
                      >
                        no reading
                      </span>
                    ) : (
                      p.value.toFixed(Math.abs(p.value) >= 100 ? 1 : 2)
                    )}
                    {p.value != null && p.unit ? <span className="muted"> {p.unit}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}
