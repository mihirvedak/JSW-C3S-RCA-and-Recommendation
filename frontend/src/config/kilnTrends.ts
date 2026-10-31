/**
 * The kiln-operation trends every RCA event is read against, in the order operators asked
 * for them: burning zone, secondary air, kiln filling degree, tertiary air, kiln inlet O2, the
 * two coal rates, kiln speed and cooler air. (Precalciner outlet temperature is not shown, at
 * the plant's request: `TREND_EXCLUDED_TAGS`.)
 *
 * Most are single ADANI_RAW tags. Two have no tag and are computed from the tags they are
 * made of, and say so on screen:
 *   - kiln filling degree (%): the plant's formula, 22.56 × (feed / 448) × (3.31 / rpm), with its
 *     norm 14–16 % and flag above 18 % (see FILL below);
 *   - cooler fan flow: the sum of the cooler fan flows, at instants where every fan reports.
 *     A fan the tag map marks "drop" is left out.
 */

import { RAW_TAGS } from './tagMaps'
import type { SignalQuality } from './tagMaps'
import type { Point, TimestampRow } from '../lib/series'
import { extractSeries } from '../lib/series'

export interface TrendDef {
  key: string
  label: string
  unit: string | null
  /** ADANI_RAW tags it is read from. */
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

function worst(tags: readonly string[]): SignalQuality | null {
  let out: SignalQuality | null = null
  for (const t of tags) {
    const q = RAW_TAGS[t]?.quality
    if (q && (out == null || QUALITY_RANK[q] > QUALITY_RANK[out])) out = q
  }
  return out
}

/** A trend for a single ADANI_RAW tag, named and graded by the tag map. */
export function tagTrend(sensorId: string): TrendDef {
  const t = RAW_TAGS[sensorId]
  return {
    key: sensorId,
    label: t?.label ?? sensorId,
    unit: t?.unit ?? null,
    tags: [sensorId],
    quality: t?.quality ?? null,
    note: null,
    series: (rows) => extractSeries(rows, sensorId),
  }
}

const KILN_FEED = 'D74'
const KILN_RPM = 'D73'
/*
 * Kiln filling degree, as the plant specified it (2026-10-28):
 *   filling % = 22.56 × (feed / 448) × (3.31 / rpm)
 * anchored on the Adani worked example (448 t/h at 3.31 rpm = 22.56 %). It follows filling degree =
 * productivity / (diameter³ × speed), so it rises with feed and falls with kiln speed. Feed is
 * MT.431-FM1.F4:PV (ADANI_RAW D74), speed MT.461-2C2.S1:PV (D73).
 */
export const FILL_ANCHOR = { percent: 22.56, feed: 448, rpm: 3.31 }
/** Rows with the kiln turning slower than this are a stopped kiln, and are skipped. */
export const FILL_MIN_RPM = 0.5
/** Normal operating band, and the level above which a reading is flagged. */
export const FILL_NORM = { lo: 14, hi: 16 }
export const FILL_FLAG = 18
/** The filling degree the "speed that brings it to" figure aims at. */
export const FILL_SPEED_TARGET = 19

/** Filling degree in %, or null when the kiln is stopped or a reading is missing. */
export function kilnFilling(feed: number | null | undefined, rpm: number | null | undefined): number | null {
  if (feed == null || rpm == null || !Number.isFinite(feed) || !Number.isFinite(rpm) || rpm < FILL_MIN_RPM) return null
  return FILL_ANCHOR.percent * (feed / FILL_ANCHOR.feed) * (FILL_ANCHOR.rpm / rpm)
}

/** Kiln speed that brings the filling degree to `target` %: rpm × filling / target. */
export const rpmForFilling = (rpm: number, filling: number, target = FILL_SPEED_TARGET) => (rpm * filling) / target

/** Median and the share of readings above the flag level. */
export function fillingStats(points: readonly Point[]): { n: number; median: number | null; abovePct: number | null } {
  const v = points.map((p) => p.v).sort((a, b) => a - b)
  if (!v.length) return { n: 0, median: null, abovePct: null }
  const m = v.length >> 1
  const median = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
  return { n: v.length, median, abovePct: (v.filter((x) => x > FILL_FLAG).length / v.length) * 100 }
}

const FILL: TrendDef = {
  key: 'kiln-fill',
  label: 'Kiln filling degree',
  unit: '%',
  tags: [KILN_FEED, KILN_RPM],
  quality: worst([KILN_FEED, KILN_RPM]),
  note: `22.56 × (feed / 448) × (3.31 / rpm). Norm ${FILL_NORM.lo}–${FILL_NORM.hi} %, flagged above ${FILL_FLAG} %; stopped kiln (rpm < ${FILL_MIN_RPM}) skipped.`,
  band: { lo: FILL_NORM.lo, hi: FILL_NORM.hi, label: `Norm ${FILL_NORM.lo}–${FILL_NORM.hi} %` },
  flagAbove: FILL_FLAG,
  series: (rows) =>
    rows.flatMap((r) => {
      const v = kilnFilling(r.values[KILN_FEED], r.values[KILN_RPM])
      return v == null ? [] : [{ t: r.t, v }]
    }),
}

const FAN_FLOW = /^Cooler Fan (\d+) Flow$/
const allFans = Object.entries(RAW_TAGS)
  .filter(([, t]) => FAN_FLOW.test(t.label))
  .sort(([, a], [, b]) => Number(FAN_FLOW.exec(a.label)![1]) - Number(FAN_FLOW.exec(b.label)![1]))
const fans = allFans.filter(([, t]) => t.quality !== 'drop').map(([id]) => id)
const droppedFans = allFans.filter(([, t]) => t.quality === 'drop').map(([, t]) => FAN_FLOW.exec(t.label)![1])

const COOLER_FLOW: TrendDef = {
  key: 'cooler-flow',
  label: 'Cooler fan flow (total)',
  unit: 'm3/sec',
  tags: fans,
  quality: worst(fans),
  note:
    `Sum of ${fans.length} cooler fan flows, at instants where all of them report` +
    (droppedFans.length ? `; fan ${droppedFans.join(', ')} is left out (marked "drop" in the tag map).` : '.'),
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

export const KILN_OPERATION_TRENDS: readonly TrendDef[] = [
  tagTrend('D0'), // Burning Zone Temp (BZT)
  tagTrend('D117'), // Secondary Air Temp (SAT)
  FILL,
  tagTrend('D122'), // TAD Temperature
  tagTrend('D71'), // Kiln Inlet O2
  tagTrend('D75'), // PC Coal
  tagTrend('D66'), // Kiln Coal
  tagTrend(KILN_RPM), // Kiln RPM
  COOLER_FLOW,
]

/**
 * Tags never charted on Trend Analysis, even when an RCA names them. PC Outlet Temp (D77) is left
 * out at the plant's request (2026-10-28).
 */
export const TREND_EXCLUDED_TAGS: ReadonlySet<string> = new Set(['D77'])
