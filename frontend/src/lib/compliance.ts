/**
 * Specification compliance: how a parameter's samples fall against its LSL and USL.
 *
 *   below   value <  LSL
 *   within  LSL <= value <= USL   (a value exactly on a limit is within specification)
 *   above   value >  USL
 *
 * A limit that is not configured is not guessed. The side that depends on it is reported
 * as unavailable (`null`) and "within" is judged against the limit(s) that do exist, so
 * with only a USL, "within" means "not above USL". With no limit at all nothing is
 * classified.
 */

export interface SpecLimits {
  /** Lower specification limit, or null when not configured. */
  lsl: number | null
  /** Upper specification limit, or null when not configured. */
  usl: number | null
}

export type ComplianceStatus = 'ok' | 'no-limits' | 'no-data'

export interface Compliance {
  /** Valid samples classified — the denominator for every percentage. */
  n: number
  status: ComplianceStatus
  /** Percentages 0–100. Null where the limit that side depends on is not configured. */
  below: number | null
  within: number | null
  above: number | null
  /** Which limits were missing. */
  missing: Array<'lsl' | 'usl'>
}

export function compliance(values: readonly number[], limits: SpecLimits): Compliance {
  const { lsl, usl } = limits
  const missing: Array<'lsl' | 'usl'> = []
  if (lsl == null) missing.push('lsl')
  if (usl == null) missing.push('usl')

  const valid = values.filter((v) => Number.isFinite(v))
  const n = valid.length

  if (missing.length === 2) {
    return { n, status: 'no-limits', below: null, within: null, above: null, missing }
  }
  if (n === 0) {
    return { n, status: 'no-data', below: null, within: null, above: null, missing }
  }

  let below = 0
  let above = 0
  for (const v of valid) {
    if (lsl != null && v < lsl) below++
    else if (usl != null && v > usl) above++
  }
  const within = n - below - above

  return {
    n,
    status: 'ok',
    below: lsl == null ? null : (below / n) * 100,
    within: (within / n) * 100,
    above: usl == null ? null : (above / n) * 100,
    missing,
  }
}

/** A limit pair is usable only if it is ordered; LSL above USL is a configuration mistake. */
export function limitsAreOrdered(limits: SpecLimits): boolean {
  return limits.lsl == null || limits.usl == null || limits.lsl <= limits.usl
}

/** One row of the Specification Compliance table, laboratory or process. */
export interface ComplianceRow {
  key: string
  label: string
  /** "LSL 41.5 · USL 44.5 %", or where the limits come from. */
  limitsText: string
  /** Readings the percentages are taken over, and anything left out. */
  countText: string
  below: number | null
  within: number | null
  above: number | null
  /** When set, shown across the three cells instead of percentages. */
  message: string | null
  /** Caveat for this row's data, e.g. process data covering only part of the range. */
  note: string | null
}

/** Classified rows by share within, highest first; unclassified rows after, in their order. */
export function sortRows(rows: readonly ComplianceRow[]): ComplianceRow[] {
  const classified = rows.filter((r) => r.message == null && r.within != null)
  const rest = rows.filter((r) => !(r.message == null && r.within != null))
  return [...classified.sort((a, b) => (b.within ?? 0) - (a.within ?? 0)), ...rest]
}
