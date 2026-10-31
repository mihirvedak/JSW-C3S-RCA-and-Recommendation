/**
 * The 48-hour RCA classification timeline: 192 intervals of 15 minutes.
 *
 * Each interval is coloured by, in order of authority:
 *   1. the RCA insight's own zone, when an RCA event falls in the interval;
 *   2. otherwise the prediction's class, computed with the insight's own targets and
 *      lime-level formula from the interval's latest predicted C3S and the free lime of the last
 *      usable laboratory sample (see `clinkerZones.ts`);
 *   3. "Not classified" when there is a prediction but it cannot be classified (no targets, or no
 *      laboratory free lime recent enough) — `reason` says which;
 *   4. "Not classified" too when the interval has no predicted C3S at all.
 * An RCA event whose result carries no zone is not classified either.
 * Every interval says which of these applied, so a computed class is never presented as an
 * insight finding.
 */

import { classifyClinker, LAST_USABLE_LAB_MS, limeLevel } from './clinkerZones'
import type { Point } from './series'
import { HOUR_MS, MINUTE_MS } from './time'
import { NOT_CLASSIFIED, shownZone, zoneOf } from './zones'
import type { ZoneKey } from './zones'
import type { ClinkerTargets, RcaFinding } from '../services/rcaService'

export const INTERVAL_MS = 15 * MINUTE_MS
export const TIMELINE_SPAN_MS = 48 * HOUR_MS
export const INTERVAL_COUNT = TIMELINE_SPAN_MS / INTERVAL_MS // 192

export type IntervalSource = 'insight' | 'computed' | 'unclassified' | 'none'

export interface TimelineInterval {
  start: number
  end: number
  zone: ZoneKey
  source: IntervalSource
  /** The interval's latest predicted C3S. */
  prediction: Point | null
  /** The laboratory free lime the prediction was classified with. */
  freeLime: Point | null
  limeLevel: number | null
  /** The newest RCA event in the interval. */
  event: RcaFinding | null
  /** Why an interval with a prediction is unclassified. */
  reason: string | null
}

/**
 * End of the timeline: the 15-minute boundary at or after the newest data. Plant time is UTC
 * +5:30, so UTC quarter-hours are plant quarter-hours too.
 */
export function timelineEnd(anchorMs: number): number {
  return Math.ceil(anchorMs / INTERVAL_MS) * INTERVAL_MS
}

/** Newest point at or before `t` in a chronological series. */
function lastAtOrBefore(points: readonly Point[], t: number): Point | null {
  let lo = 0
  let hi = points.length - 1
  let best: Point | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].t <= t) {
      best = points[mid]
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

export function buildTimeline({
  end,
  predictions,
  freeLime,
  findings,
  targets,
}: {
  end: number
  predictions: readonly Point[]
  freeLime: readonly Point[]
  findings: readonly RcaFinding[]
  targets: ClinkerTargets | null
}): TimelineInterval[] {
  const start = end - TIMELINE_SPAN_MS
  const out: TimelineInterval[] = Array.from({ length: INTERVAL_COUNT }, (_, i) => ({
    start: start + i * INTERVAL_MS,
    end: start + (i + 1) * INTERVAL_MS,
    zone: NOT_CLASSIFIED,
    source: 'none',
    prediction: null,
    freeLime: null,
    limeLevel: null,
    event: null,
    reason: null,
  }))
  const indexOf = (t: number) => Math.floor((t - start) / INTERVAL_MS)

  for (const p of predictions) {
    const i = indexOf(p.t)
    if (i < 0 || i >= INTERVAL_COUNT) continue
    const cur = out[i].prediction
    if (!cur || p.t >= cur.t) out[i].prediction = p
  }
  for (const f of findings) {
    if (f.eventTime == null) continue
    const i = indexOf(f.eventTime)
    if (i < 0 || i >= INTERVAL_COUNT) continue
    const cur = out[i].event
    if (!cur || (cur.eventTime ?? 0) <= f.eventTime) out[i].event = f
  }

  for (const iv of out) {
    if (iv.prediction) {
      const lab = lastAtOrBefore(freeLime, iv.prediction.t)
      if (lab && iv.prediction.t - lab.t <= LAST_USABLE_LAB_MS) {
        iv.freeLime = lab
        if (targets) iv.limeLevel = limeLevel(iv.prediction.v, lab.v, targets)
      }
    }
    if (iv.event) {
      iv.zone = shownZone(zoneOf(iv.event))
      iv.source = 'insight'
    } else if (iv.prediction) {
      if (!targets) {
        iv.zone = NOT_CLASSIFIED
        iv.source = 'unclassified'
        iv.reason = 'The insight supplies no targets to classify with'
      } else if (!iv.freeLime) {
        iv.zone = NOT_CLASSIFIED
        iv.source = 'unclassified'
        iv.reason = `No laboratory free lime in the ${LAST_USABLE_LAB_MS / HOUR_MS} h before the prediction`
      } else {
        iv.zone = classifyClinker(iv.prediction.v, iv.freeLime.v, targets)
        iv.source = 'computed'
      }
    }
  }
  return out
}

export function countZones(intervals: readonly TimelineInterval[]): Map<ZoneKey, number> {
  const out = new Map<ZoneKey, number>()
  for (const iv of intervals) out.set(iv.zone, (out.get(iv.zone) ?? 0) + 1)
  return out
}
