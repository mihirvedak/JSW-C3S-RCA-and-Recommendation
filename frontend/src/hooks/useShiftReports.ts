/**
 * Reports for a set of shifts: by default the last completed ones (`lastCompletedShifts`), or
 * the shifts of a day picked on the Executive View.
 *
 * "Last completed" means finished by the end of the selected range (capped at the current time,
 * so a range reaching into the future never pulls in a shift still in progress). Lab and process
 * history is fetched for the shift windows themselves, not taken from the selected range, so a
 * one-hour selection still reports on whole shifts.
 */

import { useEffect, useMemo, useState } from 'react'
import type { LineConfig } from '../config/plants'
import { SHIFTS, SHIFTS_REPORTED } from '../config/shifts'
import { fetchRange, fetchRangeChunked } from '../services/deviceDataService'
import type { RcaFinding } from '../services/rcaService'
import { AuthError } from '../services/apiClient'
import { completedShifts } from '../lib/shifts'
import { buildShiftReport } from '../lib/shiftReport'
import type { ShiftReport } from '../lib/shiftReport'
import type { TimestampRow } from '../lib/series'
import type { ShiftWindow } from '../lib/shifts'
import { clampEnd } from '../config/dataWindow'

export interface ShiftReports {
  reports: ShiftReport[]
  loading: boolean
  error: { message: string; isAuth: boolean } | null
  /**
   * True when the process history could not be loaded. The reports are still built from the
   * lab data and the RCA findings; only the process evidence behind each set point is missing.
   */
  processUnavailable: boolean
}

/**
 * The last completed shifts at the end of the selected range (capped at `now`), newest first —
 * the shift section's default view.
 */
export function lastCompletedShifts(rangeEnd: number | null, now: number): ShiftWindow[] {
  // A shift counts as completed only if it ended by the data cut-off too.
  return rangeEnd == null ? [] : completedShifts(SHIFTS, clampEnd(Math.min(rangeEnd, now)), SHIFTS_REPORTED)
}

/**
 * Data the dashboard has already loaded for the selected range. When the shifts lie inside it,
 * at full resolution, it is used as is and nothing is fetched again.
 */
export interface LoadedRange {
  start: number | null
  end: number | null
  labRows: readonly TimestampRow[]
  labLoading: boolean
  labError: ShiftReports['error']
  processRows: readonly TimestampRow[]
  processLoading: boolean
  processFailed: boolean
  /** True when the process rows are every reading (not thinned to 5 minutes, not shortened). */
  fullProcess: boolean
}

export function useShiftReports(
  /** The shift windows to report on, in display order. Memoise: a new array refetches. */
  shifts: readonly ShiftWindow[],
  findings: readonly RcaFinding[],
  /** Bumped to refetch. */
  refreshKey: number,
  line: LineConfig,
  loaded?: LoadedRange,
): ShiftReports {
  const { labDevice, processDevice } = line

  // Primitive bounds, so a new array of the same shifts does not refetch.
  const spanStart = shifts.length ? Math.min(...shifts.map((s) => s.start)) : null
  const spanEnd = shifts.length ? Math.max(...shifts.map((s) => s.end)) : null

  const [labRows, setLabRows] = useState<TimestampRow[]>([])
  const [processRows, setProcessRows] = useState<TimestampRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ShiftReports['error']>(null)
  const [processUnavailable, setProcessUnavailable] = useState(false)

  // The two last shifts sit inside the dashboard's 24-hour window, which is already loaded at full
  // resolution: report from it rather than fetch the same 16 hours again.
  const reuse =
    loaded != null &&
    loaded.fullProcess &&
    loaded.start != null &&
    loaded.end != null &&
    spanStart != null &&
    spanEnd != null &&
    loaded.start <= spanStart &&
    spanEnd <= loaded.end

  useEffect(() => {
    if (reuse || spanStart == null || spanEnd == null) return
    const controller = new AbortController()
    const { signal } = controller
    setLoading(true)
    Promise.all([
      fetchRange(labDevice, spanStart, spanEnd, signal),
      // Process history only supports the recommendations, so its failure is not fatal here.
      fetchRangeChunked(processDevice, spanStart, spanEnd, { signal }).catch((err: unknown) => {
        if (signal.aborted) throw err
        return null
      }),
    ])
      .then(([lab, proc]) => {
        if (signal.aborted) return
        setLabRows(lab)
        setProcessRows(proc?.rows ?? [])
        setProcessUnavailable(proc == null)
        setError(null)
      })
      .catch((err: unknown) => {
        if (signal.aborted) return
        setLabRows([])
        setProcessRows([])
        setError({
          message: err instanceof Error ? err.message : 'Unknown error',
          isAuth: err instanceof AuthError,
        })
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reuse, spanStart, spanEnd, refreshKey, labDevice, processDevice])

  const lab = reuse ? loaded.labRows : labRows
  const proc = reuse ? loaded.processRows : processRows
  const reports = useMemo(
    () => shifts.map((shift) => buildShiftReport({ shift, labRows: lab, processRows: proc, findings })),
    [shifts, lab, proc, findings],
  )

  if (reuse) {
    return {
      reports,
      loading: loaded.labLoading || loaded.processLoading,
      error: loaded.labError,
      processUnavailable: loaded.processFailed,
    }
  }
  return { reports, loading, error, processUnavailable }
}
