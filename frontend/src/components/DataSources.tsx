/**
 * Data sources: what the platform holds for every device of the line, and what the selected range
 * returned from it. The first thing to open when a panel says "no data".
 *
 * Per device: whether the platform answered the newest-reading probe (and with what, how recent),
 * how many of its listed sensors have ever reported, how many rows the current range returned and
 * the newest of them, and the platform's own message when it refused the device ("Device not added
 * in Account", a session problem, a gateway error). Nothing here is interpreted: a refusal is shown
 * in the platform's words so it can be taken to the platform team as is.
 */

import type { DeviceStatus } from '../hooks/useDashboardData'
import { formatAge, formatFull } from '../lib/time'
import { Badge } from './primitives'

type Standing = 'ok' | 'stale' | 'empty' | 'refused' | 'pending'

/** One word for a device's standing, from the probe and the range. */
function standing(s: DeviceStatus, windowStart: number | null): Standing {
  if (s.probeError || s.range?.error) return 'refused'
  if (s.range == null) return 'pending'
  if (s.range.rows > 0) return 'ok'
  if (s.newestEver == null) return 'empty'
  // Holds data, but none in the window: the feed stopped before the window began.
  return windowStart != null && s.newestEver < windowStart ? 'stale' : 'empty'
}

const TONE: Record<Standing, 'ok' | 'warn' | 'high' | 'neutral' | 'low'> = {
  ok: 'ok',
  stale: 'warn',
  empty: 'neutral',
  refused: 'low',
  pending: 'neutral',
}

const WORD: Record<Standing, string> = {
  ok: 'Data in range',
  stale: 'Stopped before range',
  empty: 'No data',
  refused: 'Refused by platform',
  pending: 'Loading',
}

function classify(sources: readonly DeviceStatus[], windowStart: number | null) {
  const rows = sources.map((s) => ({ s, st: standing(s, windowStart) }))
  const count = (st: Standing) => rows.filter((r) => r.st === st).length
  const refused = count('refused')
  const summary =
    rows.length === 0
      ? 'No devices configured'
      : [
          `${count('ok')} of ${rows.length} devices with data in range`,
          refused ? `${refused} refused by the platform` : null,
          count('stale') ? `${count('stale')} stopped before the range` : null,
          count('empty') ? `${count('empty')} with no data` : null,
        ]
          .filter(Boolean)
          .join(' · ')
  return { rows, refused, summary }
}

/** The one-line control, placed in the scope bar: a summary, red when the platform refused a device. */
export function DataSourcesToggle({
  sources,
  windowStart,
  open,
  onToggle,
}: {
  sources: readonly DeviceStatus[]
  windowStart: number | null
  open: boolean
  onToggle: () => void
}) {
  const { refused, summary } = classify(sources, windowStart)
  return (
    <button
      type="button"
      className={`sources__toggle ${refused ? 'sources__toggle--refused' : ''}`}
      aria-expanded={open}
      aria-controls="data-sources"
      onClick={onToggle}
    >
      <span className="sources__chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
      <strong>Data sources</strong>
      <span className="sources__summary">{summary}</span>
    </button>
  )
}

/** The table, shown under the scope bar while the toggle is open. */
export function DataSources({
  sources,
  windowStart,
  windowEnd,
  now,
}: {
  sources: readonly DeviceStatus[]
  windowStart: number | null
  windowEnd: number | null
  now: number
}) {
  const { rows, refused } = classify(sources, windowStart)
  return (
    <section id="data-sources" className={`sources ${refused ? 'sources--refused' : ''}`} aria-label="Data sources">
      {(
        <div className="sources__body">
          <table className="sources__table">
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Read as</th>
                <th scope="col">Newest reading on platform</th>
                <th scope="col" className="num">Sensors reporting</th>
                <th scope="col" className="num">Rows in range</th>
                <th scope="col">Newest in range</th>
                <th scope="col">Standing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, st }) => (
                <tr key={s.devID} data-device={s.devID} data-standing={st}>
                  <th scope="row">
                    <code>{s.devID}</code>
                    <span className="sources__label">{s.label}</span>
                  </th>
                  <td>{s.kind === 'lab' ? 'laboratory' : 'process'}</td>
                  <td>
                    {s.probeError ? (
                      <span className="sources__error" title={s.probeError}>{s.probeError}</span>
                    ) : s.newestEver == null ? (
                      <span className="muted">{s.sensorsListed ? 'none' : '—'}</span>
                    ) : (
                      <span title={formatFull(s.newestEver)}>
                        {formatFull(s.newestEver)} <span className="muted">({formatAge(s.newestEver, now)})</span>
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {s.probeError ? '—' : `${s.sensorsReporting} / ${s.sensorsListed}`}
                  </td>
                  <td className="num">{s.range == null ? '…' : s.range.error ? '—' : s.range.rows.toLocaleString()}</td>
                  <td>
                    {s.range?.error ? (
                      <span className="sources__error" title={s.range.error}>{s.range.error}</span>
                    ) : s.range?.newest != null ? (
                      <span title={formatFull(s.range.newest)}>{formatFull(s.range.newest)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={TONE[st]}>{WORD[st]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Range {windowStart == null ? '—' : formatFull(windowStart)} – {windowEnd == null ? '—' : formatFull(windowEnd)}.
            &ldquo;Newest reading on platform&rdquo; is the platform&rsquo;s latest value for any listed sensor of the
            device, whatever the range. A device the platform refused is shown with the platform&rsquo;s own message;
            the other devices still load. A device with data on the platform but none in range stopped reporting
            before the range began: widen or move the range to see it.
          </p>
        </div>
      )}
    </section>
  )
}
