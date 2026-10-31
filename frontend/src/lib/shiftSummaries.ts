/**
 * Which of the RCA insight's shift summaries belongs to a shift window.
 *
 * In order of strength:
 *   1. the summary states its own window, and it starts within 15 minutes of the shift's start
 *      (and, when it states an end, ends within 15 minutes of the shift's end);
 *   2. otherwise, the time it does state — its end, else a bare time — falls in the shift;
 *   3. otherwise, the insight's run time falls in the shift or up to 30 minutes after its end
 *      (a shift summary is written once the shift is over).
 * When several qualify, the most recently written wins. How the match was made is returned, so
 * the page can say so.
 */

import type { ShiftSummary } from '../services/rcaService'
import type { ShiftWindow } from './shifts'
import { MINUTE_MS } from './time'

export const WINDOW_TOLERANCE_MS = 15 * MINUTE_MS
export const RUN_AFTER_END_MS = 30 * MINUTE_MS

export type ShiftMatch = 'window' | 'stated time' | 'run time'

export function summaryForShift(
  summaries: readonly ShiftSummary[],
  w: ShiftWindow,
): { summary: ShiftSummary; by: ShiftMatch } | null {
  const near = (a: number, b: number) => Math.abs(a - b) <= WINDOW_TOLERANCE_MS
  const inShift = (t: number) => t > w.start && t <= w.end
  const newestFirst = [...summaries].sort((a, b) => (b.invocationTime ?? 0) - (a.invocationTime ?? 0))

  const byWindow = newestFirst.find((s) => s.start != null && near(s.start, w.start) && (s.end == null || near(s.end, w.end)))
  if (byWindow) return { summary: byWindow, by: 'window' }

  const byTime = newestFirst.find((s) => {
    if (s.start != null) return false
    const t = s.end ?? s.time
    return t != null && inShift(t)
  })
  if (byTime) return { summary: byTime, by: 'stated time' }

  const byRun = newestFirst.find(
    (s) =>
      s.start == null &&
      s.end == null &&
      s.time == null &&
      s.invocationTime != null &&
      s.invocationTime > w.start &&
      s.invocationTime <= w.end + RUN_AFTER_END_MS,
  )
  return byRun ? { summary: byRun, by: 'run time' } : null
}
