/**
 * Share of time a process parameter spent inside the LSL–USL of the kiln-feed bin it was in.
 *
 * Every process reading is paired with the kiln feed at the same instant (same row). The feed
 * picks the bin, the bin picks the limits, and the reading is in range when LSL ≤ value ≤ USL.
 *
 *   Below LSL % / In range % / Above USL % = readings below / inside / above / readings judged × 100
 *   (per bin and over all bins)
 *
 * A reading is not judged — counted apart, never as in or out — when its feed is missing, below
 * 370 or above 565 t/h, or when its bin has no limit for the parameter. Process readings are evenly
 * spaced (one a minute, or 5-minute buckets on long ranges), so a share of readings is a share of
 * time.
 *
 * Units: the limit table's figures are compared with the tag as it reports. When the readings sit
 * more than 3× away from every bin target, the two are almost certainly in different units (or a
 * different tag), and the row says so instead of reporting a meaningless percentage.
 */

import { BIN_SENSOR, BIN_THRESHOLDS, TPH_BINS, binLimit, binOf } from '../config/binLimits'
import type { BinLimit, LimitStatus } from '../config/binLimits'
import type { TimestampRow } from './series'

export type BinStatus = 'good' | 'attention' | 'out' | 'nolimits' | 'nodata' | 'unjudged' | 'units'

export interface BinCell {
  binId: string
  limit: BinLimit | null
  judged: number
  below: number
  inRange: number
  above: number
  pct: number | null
}

export interface BinComplianceRow {
  parameter: string
  sensorId: string
  /** Readings of the tag in the range. */
  n: number
  judged: number
  below: number
  inRange: number
  above: number
  pct: number | null
  belowPct: number | null
  abovePct: number | null
  notJudged: number
  bins: BinCell[]
  status: BinStatus
  /** The worst grading the limit table gives this parameter in any bin. */
  grade: LimitStatus | null
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function statusOf(pct: number | null): BinStatus {
  if (pct == null) return 'nodata'
  if (pct >= BIN_THRESHOLDS.good) return 'good'
  if (pct >= BIN_THRESHOLDS.attention) return 'attention'
  return 'out'
}

const GRADE_RANK: Record<LimitStatus, number> = { USABLE: 0, FLAG: 1, UNRELIABLE: 2, DROP: 3 }

export function binCompliance(rows: readonly TimestampRow[], parameter: string, sensorId: string): BinComplianceRow {
  const cells: BinCell[] = TPH_BINS.map((b) => ({ binId: b.id, limit: binLimit(b.id, parameter), judged: 0, below: 0, inRange: 0, above: 0, pct: null }))
  const values: number[] = []
  let notJudged = 0

  for (const row of rows) {
    const v = row.values[sensorId]
    if (v == null || !Number.isFinite(v)) continue
    values.push(v)
    const feed = row.values[BIN_SENSOR]
    const bin = feed == null ? null : binOf(feed)
    const cell = bin ? cells.find((c) => c.binId === bin.id) : undefined
    if (!cell?.limit) {
      notJudged++
      continue
    }
    cell.judged++
    if (v < cell.limit.lsl) cell.below++
    else if (v > cell.limit.usl) cell.above++
    else cell.inRange++
  }
  for (const c of cells) c.pct = c.judged ? (c.inRange / c.judged) * 100 : null

  const judged = cells.reduce((a, c) => a + c.judged, 0)
  const inRange = cells.reduce((a, c) => a + c.inRange, 0)
  const below = cells.reduce((a, c) => a + c.below, 0)
  const above = cells.reduce((a, c) => a + c.above, 0)
  const share = (k: number) => (judged ? (k / judged) * 100 : null)
  const pct = share(inRange)

  const targets = cells.flatMap((c) => (c.limit ? [c.limit.target] : []))
  const grades = cells.flatMap((c) => (c.limit ? [c.limit.status] : []))
  const grade = grades.length ? grades.reduce((w, g) => (GRADE_RANK[g] > GRADE_RANK[w] ? g : w)) : null

  // Readings far from every bin target: different units or a different tag, not a process fault.
  const m = median(values)
  const unitsMismatch =
    m != null && targets.length > 0 && m !== 0 && targets.every((t) => t !== 0 && (Math.abs(m / t) > 3 || Math.abs(m / t) < 1 / 3))

  const status: BinStatus = !targets.length
    ? 'nolimits'
    : !values.length
      ? 'nodata'
      : unitsMismatch
        ? 'units'
        : judged === 0
          ? 'unjudged'
          : statusOf(pct)

  return {
    parameter,
    sensorId,
    n: values.length,
    judged,
    below,
    inRange,
    above,
    pct,
    belowPct: share(below),
    abovePct: share(above),
    notJudged,
    bins: cells,
    status,
    grade,
  }
}
