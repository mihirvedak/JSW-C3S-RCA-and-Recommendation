/**
 * Clinker zones on the C3S × free-lime plane, from the RCA insight's own targets.
 *
 * The insight defines lime level = C3S + k × (free lime − ref): the C3S the clinker would have
 * at the reference free lime. Lines of constant lime level are the diagonals of the zone plot.
 *   - lime level above the top of the C3S band   → Overlimed
 *   - lime level below the bottom of the C3S band → Underlimed
 *   - in between, free lime decides: above its band → Under burnt, inside → Good clinker,
 *     below → Overburnt.
 * With the insight's targets (C3S 41.5–44.5, free lime 1.2–1.8, k 4.071, ref 1.5) this gives
 * exactly the regions of the reference zone plots.
 */

import type { ClinkerTargets } from '../services/rcaService'
import type { Point, TimestampRow } from './series'
import { extractSeries } from './series'
import { HOUR_MS, MINUTE_MS } from './time'

export type ClinkerZone = 'Underlimed' | 'Overburnt' | 'Good clinker' | 'Under burnt' | 'Overlimed'

/** Legend order of the reference plots. */
export const CLINKER_ZONES: readonly ClinkerZone[] = [
  'Underlimed',
  'Overburnt',
  'Good clinker',
  'Under burnt',
  'Overlimed',
]

export function limeLevel(c3s: number, freeLime: number, t: ClinkerTargets): number {
  return c3s + t.limeLevelK * (freeLime - t.limeLevelFreeLimeRef)
}

export function classifyClinker(c3s: number, freeLime: number, t: ClinkerTargets): ClinkerZone {
  const ll = limeLevel(c3s, freeLime, t)
  if (ll > t.c3sBand[1]) return 'Overlimed'
  if (ll < t.c3sBand[0]) return 'Underlimed'
  if (freeLime > t.freeLimeBand[1]) return 'Under burnt'
  if (freeLime < t.freeLimeBand[0]) return 'Overburnt'
  return 'Good clinker'
}

export interface ZoneView {
  x: [number, number]
  y: [number, number]
}

/** The reference plots' view (C3S 34–46, free lime 0–3), placed around the targets. */
export function defaultView(t: ClinkerTargets): ZoneView {
  return {
    x: [t.c3s - 9, t.c3s + 3],
    y: [0, Math.max(3, t.freeLimeBand[1] + 1.2)],
  }
}

type XY = [number, number]

/** Keep the part of a convex polygon where a·x + b·y ≤ c (Sutherland–Hodgman, one edge). */
function clip(poly: readonly XY[], a: number, b: number, c: number): XY[] {
  const inside = ([x, y]: XY) => a * x + b * y <= c + 1e-9
  const cross = ([x1, y1]: XY, [x2, y2]: XY): XY => {
    const f1 = a * x1 + b * y1 - c
    const f2 = a * x2 + b * y2 - c
    const s = f1 / (f1 - f2)
    return [x1 + s * (x2 - x1), y1 + s * (y2 - y1)]
  }
  const out: XY[] = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const prev = poly[(i + poly.length - 1) % poly.length]
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur))
      out.push(cur)
    } else if (inside(prev)) {
      out.push(cross(prev, cur))
    }
  }
  return out
}

/** Each zone as a polygon inside the view. A zone that falls outside it is left out. */
export function zonePolygons(t: ClinkerTargets, view: ZoneView): Array<{ zone: ClinkerZone; points: XY[] }> {
  const [x0, x1] = view.x
  const [y0, y1] = view.y
  const box: XY[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const k = t.limeLevelK
  // lime level ≤ L  ⇔  x + k·y ≤ L + k·ref
  const at = (L: number) => L + k * t.limeLevelFreeLimeRef
  const [lo, hi] = t.c3sBand
  const [flLo, flHi] = t.freeLimeBand

  const band = clip(clip(box, -1, -k, -at(lo)), 1, k, at(hi))
  const regions: Array<{ zone: ClinkerZone; points: XY[] }> = [
    { zone: 'Underlimed', points: clip(box, 1, k, at(lo)) },
    { zone: 'Overburnt', points: clip(band, 0, 1, flLo) },
    { zone: 'Good clinker', points: clip(clip(band, 0, -1, -flLo), 0, 1, flHi) },
    { zone: 'Under burnt', points: clip(band, 0, -1, -flHi) },
    { zone: 'Overlimed', points: clip(box, -1, -k, -at(hi)) },
  ]
  return regions.filter((r) => r.points.length >= 3)
}

export interface ZonePoint {
  t: number
  c3s: number
  freeLime: number
}

/**
 * Free lime this close to a C3S sample counts as the same laboratory sample. The clinker chemistry
 * is logged at offset minutes from the C3S result, and samples are about 2 h apart, so half an hour
 * either way only ever reaches the same sample.
 */
export const SAME_SAMPLE_MS = 30 * MINUTE_MS

/** A prediction uses the newest laboratory free lime no older than this. */
export const LAST_USABLE_LAB_MS = 4 * HOUR_MS

/** Index of the newest point at or before `t` in a chronological series, or -1. */
function indexAtOrBefore(points: readonly Point[], t: number): number {
  let lo = 0
  let hi = points.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].t <= t) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

/** Newest point at or before `t`, from a chronological series. */
function lastAtOrBefore(points: readonly Point[], t: number): Point | null {
  const i = indexAtOrBefore(points, t)
  return i < 0 ? null : points[i]
}

/** Each laboratory C3S sample with the free lime of the same sample: the nearest one in time. */
export function pairActual(rows: readonly TimestampRow[], c3sId: string, freeLimeId: string): ZonePoint[] {
  const fl = extractSeries(rows, freeLimeId)
  const out: ZonePoint[] = []
  for (const p of extractSeries(rows, c3sId)) {
    // The newest free lime at or before the C3S time, and the first one after it.
    const i = indexAtOrBefore(fl, p.t)
    const near = [fl[i], fl[i + 1]]
      .filter((q): q is Point => q != null && Math.abs(q.t - p.t) <= SAME_SAMPLE_MS)
      .sort((a, b) => Math.abs(a.t - p.t) - Math.abs(b.t - p.t))[0]
    if (near) out.push({ t: p.t, c3s: p.v, freeLime: near.v })
  }
  return out
}

/**
 * Each predicted C3S with the free lime of the last usable laboratory sample. Free lime is not
 * predicted, so this is the measured value the prediction would be read against.
 */
export function pairPredicted(rows: readonly TimestampRow[], c3sId: string, freeLimeId: string): ZonePoint[] {
  const fl = extractSeries(rows, freeLimeId)
  const out: ZonePoint[] = []
  for (const p of extractSeries(rows, c3sId)) {
    const lab = lastAtOrBefore(fl, p.t)
    if (lab && p.t - lab.t <= LAST_USABLE_LAB_MS) out.push({ t: p.t, c3s: p.v, freeLime: lab.v })
  }
  return out
}

export function countByZone(points: readonly ZonePoint[], t: ClinkerTargets): Map<ClinkerZone, number> {
  const out = new Map<ClinkerZone, number>(CLINKER_ZONES.map((z) => [z, 0]))
  for (const p of points) {
    const z = classifyClinker(p.c3s, p.freeLime, t)
    out.set(z, (out.get(z) ?? 0) + 1)
  }
  return out
}
