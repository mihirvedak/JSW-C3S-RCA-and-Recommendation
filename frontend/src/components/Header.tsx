/**
 * Dashboard header: branding, data freshness, refresh and sign-out. The plant, line and time
 * range selectors live in the scope bar above each view's content (`ScopeBar`).
 */

import { formatFull, formatStamp, formatAge } from '../lib/time'
import { BrandLogo } from './BrandLogo'

export function Header({
  anchorMs,
  lastRefreshed,
  isStale,
  onRefresh,
  loading,
  onSignOut,
  now,
}: {
  anchorMs: number | null
  lastRefreshed: number | null
  isStale: boolean
  onRefresh: () => void
  loading: boolean
  onSignOut: () => void
  /** Supplied by the caller's ticking clock so ages stay live and render stays pure. */
  now: number
}) {
  return (
    <header className="appbar">
      <div className="appbar__brand">
        <BrandLogo />
        <div className="appbar__titles">
          <h1>C3S Quality Intelligence</h1>
        </div>
      </div>

      <div className="appbar__status">
        <div className="appbar__clock">
          <span className={`dot-live ${isStale ? 'is-stale' : ''}`} aria-hidden="true" />
          <div>
            <span className="appbar__clock-label">
              {isStale ? 'Feed behind' : 'Data through'}
            </span>
            <strong title={anchorMs ? `${formatFull(anchorMs)}` : undefined}>
              {anchorMs == null ? '—' : formatStamp(anchorMs)}
            </strong>
            {lastRefreshed ? (
              <span className="appbar__refreshed">
                refreshed {formatAge(lastRefreshed, now)}
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="btn btn--icon"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh data"
          title="Refresh"
        >
          <svg
            className={loading ? 'spin' : ''}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>

        <button type="button" className="btn btn--ghost btn--sm" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
