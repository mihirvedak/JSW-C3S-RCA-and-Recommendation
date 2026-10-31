/** Small shared building blocks: panels, badges, and the data-quality markers. */

import type { ReactNode } from 'react'
import { formatAge, formatFull } from '../lib/time'

export function Panel({
  title,
  actions,
  children,
  className = '',
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__head">
        <h2 className="panel__title">
          {title}
        </h2>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  )
}

export type Tone = 'neutral' | 'low' | 'high' | 'ok' | 'warn' | 'info'

export function Badge({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: Tone
  children: ReactNode
  title?: string
}) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  )
}

/**
 * Marks a value whose parameter name has not been supplied by the mapping authority. The
 * label shown is built from the sensor's known category and position, not a guessed name.
 */
export function UnverifiedName({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`unverified ${compact ? 'unverified--compact' : ''}`}
      title="No alias has been configured for this sensor, and its name is not readable from the platform with the current credentials. The label shown is built from its category and position. Add the real name in config/sensorAliases.ts."
    >
      alias not set
    </span>
  )
}

/** Explicitly distinguishes "no measurement" from a genuine zero. */
export function NoData({ reason = 'no measurement' }: { reason?: string }) {
  return (
    <span className="nodata" title={reason}>
      —
    </span>
  )
}

export function Stale({ at, now }: { at: number; now: number }) {
  return (
    <span className="stale" title={`Last sample ${formatFull(at)}`}>
      {formatAge(at, now)}
    </span>
  )
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="state state--empty">
      <p className="state__msg">{message}</p>
      {hint ? <p className="state__hint">{hint}</p> : null}
    </div>
  )
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="state state--loading">
      <span className="spinner" aria-hidden="true" />
      <p className="state__msg">{message}</p>
    </div>
  )
}

export function ErrorState({
  message,
  detail,
  onRetry,
}: {
  message: string
  detail?: string
  onRetry?: () => void
}) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__msg">{message}</p>
      {detail ? <p className="state__hint">{detail}</p> : null}
      {onRetry ? (
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}

/** A measured fact vs. a retrieved finding vs. a hypothesis — kept visually distinct. */
export function ProvenanceTag({ kind }: { kind: 'measured' | 'retrieved' | 'hypothesis' }) {
  const copy = {
    measured: { label: 'Measured', title: 'Read directly from the device feed.' },
    retrieved: {
      label: 'From RCA insight',
      title: 'Returned by insight INS_df1b3c1a11de. Not recomputed by this dashboard.',
    },
    hypothesis: {
      label: 'Needs validation',
      title: 'A candidate explanation requiring process-engineer confirmation. Correlation is not causation.',
    },
  }[kind]

  return (
    <span className={`prov prov--${kind}`} title={copy.title}>
      {copy.label}
    </span>
  )
}
