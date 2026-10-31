/**
 * Specification compliance table: for each parameter, the share of its readings below LSL,
 * within LSL–USL and above USL over the selected time range, sorted by the share within.
 *
 * Laboratory rows use one fixed LSL / USL (`config/specLimits.ts`). Process rows use the limits of
 * the kiln-feed bin each reading was taken in (`config/binLimits.ts`, `lib/binCompliance.ts`),
 * summed over the bins. A row that cannot be classified — no limits, no readings, data still
 * loading or failed, readings in other units than the limits — says so across its three cells
 * instead of showing percentages that would imply a classification nobody made.
 */

import { BIN_THRESHOLDS } from '../config/binLimits'
import { statusOf } from '../lib/binCompliance'
import { sortRows } from '../lib/compliance'
import type { ComplianceRow } from '../lib/compliance'

const fmtPct = (v: number | null) => (v == null ? '—' : v.toFixed(2))

export function ComplianceTable({ rows }: { rows: readonly ComplianceRow[] }) {
  return (
    <div className="comp__wrap">
      <table className="comp">
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            <th scope="col" className="comp__num">
              Below LSL %
            </th>
            <th scope="col" className="comp__num" aria-sort="descending">
              LSL – USL % ↓
            </th>
            <th scope="col" className="comp__num">
              Above USL %
            </th>
          </tr>
        </thead>
        <tbody>
          {sortRows(rows).map((r) => (
            <tr key={r.key} data-param={r.key}>
              <th scope="row" className="comp__param">
                <span className="comp__name">{r.label}</span>
                <span className="comp__limits">
                  {r.limitsText} · {r.countText}
                </span>
                {r.note ? <span className="comp__note">{r.note}</span> : null}
              </th>
              {r.message != null ? (
                <td className="comp__unset" colSpan={3}>
                  {r.message}
                </td>
              ) : (
                <>
                  <td className="comp__num comp__pct">{fmtPct(r.below)}</td>
                  <td
                    className={`comp__num comp__pct comp__within comp__within--${statusOf(r.within)}`}
                    title={`Green ≥ ${BIN_THRESHOLDS.good}%, orange ≥ ${BIN_THRESHOLDS.attention}%, red below`}
                  >
                    {fmtPct(r.within)}
                  </td>
                  <td className="comp__num comp__pct">{fmtPct(r.above)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
