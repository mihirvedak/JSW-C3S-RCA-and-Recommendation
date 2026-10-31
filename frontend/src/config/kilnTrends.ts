/**
 * The kiln-operation trends every RCA event is read against, in the order operators asked for
 * them: burning zone, secondary air, kiln filling degree, tertiary air, kiln inlet O2, the two
 * coal rates, kiln speed and cooler air. Each is a role; a line that has not mapped the role does
 * not get the card, and says nothing in its place.
 *
 * Two trends have no tag and are computed from the tags they are made of, and say so on screen:
 *   - kiln filling degree (%): the plant's formula, anchor % × (feed / anchor feed) × (anchor rpm / rpm),
 *     with the plant's norm band and flag level (`LineSpec.kilnFilling`); needs kiln feed and speed;
 *   - cooler fan flow: the sum of the cooler fan flows, at instants where every fan reports.
 *     A fan the tag map marks "drop" is left out.
 */

import type { KilnFillingSpec, Role, SignalQuality } from './clients/types'
import type { LineModel } from './lineModel'
import type { Point, TimestampRow } from '../lib/series'
import { extractSeries } from '../lib/series'

export interface TrendDef {
  key: string
  label: string
  unit: string | null
  /** Sensor keys it is read from. */
  tags: readonly string[]
  /** Worst grading the tag map gives any of those tags. */
  quality: SignalQuality | null
  /** How a computed trend is made. Null for a plain tag. */
  note: string | null
  /** A normal band to shade on the chart, when the plant gave one. */
  band?: { lo: number; hi: number; label: string }
  /** A level above which readings are flagged, drawn as a line. */
  flagAbove?: number
  series: (rows: readonly TimestampRow[]) => Point[]
}

const QUALITY_RANK: Record<SignalQuality, number> = { usable: 0, flag: 1, unreliable: 2, drop: 3 }

function worst(line: LineModel, tags: readonly string[]): SignalQuality | null {
  let out: SignalQuality | null = null
  for (const t of tags) {
    const q = line.sensorByKey(t)?.quality
    if (q && (out == null || QUALITY_RANK[q] > QUALITY_RANK[out])) out = q
  }
  return out
}

/** A trend for a single sensor key, named and graded by the line. */
export function tagTrend(line: LineModel, key: string): TrendDef {
  const def = line.describe(key)
  return {
    key,
    label: def.label,
    unit: def.unit,
    tags: [key],
    quality: def.quality,
    note: null,
    series: (rows) => extractSeries(rows, key),
  }
}

/* ------------------------------ kiln filling degree ------------------------------ */

/** Filling degree in %, or null when the kiln is stopped or a reading is missing. */
export function kilnFilling(
  feed: number | null | undefined,
  rpm: number | null | undefined,
  spec: KilnFillingSpec,
): number | null {
  if (feed == null || rpm == null || !Number.isFinite(feed) || !Number.isFinite(rpm) || rpm < spec.minRpm) return null
  return spec.anchor.percent * (feed / spec.anchor.feed) * (spec.anchor.rpm / rpm)
}

/** Kiln speed that brings the filling degree to `target` %: rpm × filling / target. */
export const rpmForFilling = (rpm: number, filling: number, target: number) => (rpm * filling) / target

/** Median and the share of readings above the flag level. */
export function fillingStats(points: readonly Point[], flagAbove: number): { n: number; median: number | null; abovePct: number | null } {
  const v = points.map((p) => p.v).sort((a, b) => a - b)
  if (!v.length) return { n: 0, median: null, abovePct: null }
  const m = v.length >> 1
  const median = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
  return { n: v.length, median, abovePct: (v.filter((x) => x > flagAbove).length / v.length) * 100 }
}

export const FILL_KEY = 'kiln-fill'
export const COOLER_FLOW_KEY = 'cooler-flow'

function fillTrend(line: LineModel): TrendDef | null {
  const spec = line.kilnFilling
  const feed = line.role('kilnFeed')
  const rpm = line.role('kilnRpm')
  if (!spec || !feed || !rpm) return null
  const { anchor, norm, flagAbove, minRpm } = spec
  return {
    key: FILL_KEY,
    label: 'Kiln filling degree',
    unit: '%',
    tags: [feed, rpm],
    quality: worst(line, [feed, rpm]),
    note: `${anchor.percent} × (feed / ${anchor.feed}) × (${anchor.rpm} / rpm). Norm ${norm.lo}–${norm.hi} %, flagged above ${flagAbove} %; stopped kiln (rpm < ${minRpm}) skipped.`,
    band: { lo: norm.lo, hi: norm.hi, label: `Norm ${norm.lo}–${norm.hi} %` },
    flagAbove,
    series: (rows) =>
      rows.flatMap((r) => {
        const v = kilnFilling(r.values[feed], r.values[rpm], spec)
        return v == null ? [] : [{ t: r.t, v }]
      }),
  }
}

function coolerFlowTrend(line: LineModel): TrendDef | null {
  const all = line.coolerFanFlows
  if (all.length === 0) return null
  const fans = all.filter((k) => line.sensorByKey(k)?.quality !== 'drop')
  const dropped = all.filter((k) => line.sensorByKey(k)?.quality === 'drop').map((k) => line.label(k))
  if (fans.length === 0) return null
  return {
    key: COOLER_FLOW_KEY,
    label: 'Cooler fan flow (total)',
    unit: line.unit(fans[0]),
    tags: fans,
    quality: worst(line, fans),
    note:
      `Sum of ${fans.length} cooler fan flows, at instants where all of them report` +
      (dropped.length ? `; ${dropped.join(', ')} left out (marked "drop" in the tag map).` : '.'),
    series: (rows) =>
      rows.flatMap((r) => {
        let sum = 0
        for (const id of fans) {
          const v = r.values[id]
          if (v == null) return []
          sum += v
        }
        return [{ t: r.t, v: sum }]
      }),
  }
}

/** The order operators asked for. `fill` and `cooler` are the two computed trends. */
const ORDER: ReadonlyArray<Role | 'fill' | 'cooler'> = [
  'burningZoneTemp',
  'secondaryAirTemp',
  'fill',
  'tertiaryAirTemp',
  'kilnInletO2',
  'pcCoal',
  'kilnCoal',
  'kilnRpm',
  'cooler',
]

const cache = new WeakMap<LineModel, TrendDef[]>()

/** The kiln-operation trends this line can show, in operators' order. */
export function kilnOperationTrends(line: LineModel): TrendDef[] {
  const hit = cache.get(line)
  if (hit) return hit
  const out: TrendDef[] = []
  for (const item of ORDER) {
    if (item === 'fill') {
      const t = fillTrend(line)
      if (t) out.push(t)
    } else if (item === 'cooler') {
      const t = coolerFlowTrend(line)
      if (t) out.push(t)
    } else {
      const key = line.role(item)
      if (key) out.push(tagTrend(line, key))
    }
  }
  cache.set(line, out)
  return out
}
