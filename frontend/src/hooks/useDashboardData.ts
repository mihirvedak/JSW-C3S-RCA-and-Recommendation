/**
 * Loads everything the dashboard renders, and reports partial failure honestly.
 *
 * Four independent loads, each with its own abort and error, so one slow or failing
 * source never blanks another:
 *   - the newest-sample probe (anchors presets, drives the "feed is behind" notice),
 *   - the full RCA result set (filtered to the window here, not re-fetched per selection),
 *   - the laboratory range (the C3S trend, KPIs, lab grid),
 *   - the process range (heavy; chunked and thinned, and never blocks the C3S trend).
 *
 * Every figure is derived from the selected window, so the global time picker drives the
 * whole dashboard rather than only the chart.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LAB_SENSORS,
  PROCESS_SENSORS,
  PREDICTED_C3S,
  ACTUAL_C3S,
} from '../config/deviceMappings'
import {
  fetchLatestTimestamp,
  fetchRangeChunked,
  PROCESS_THIN_MS,
} from '../services/deviceDataService'
import type { LastReading } from '../services/deviceDataService'
import { fetchAllRcaFindings } from '../services/rcaService'
import type { RcaFinding, ShiftSummary } from '../services/rcaService'
import { extractSeries, latestFromRows, matchSamples, unmatchedPredictions } from '../lib/series'
import type { Band, MatchedSample, Point, TimestampRow } from '../lib/series'
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../lib/time'
import { AuthError } from '../services/apiClient'
import { DATA_END_MS, afterCutoff, clampEnd } from '../config/dataWindow'
import type { LineConfig } from '../config/plants'

export const RANGE_OPTIONS = [
  { id: '1h', label: 'Last 1 Hour', spanMs: HOUR_MS },
  { id: '6h', label: 'Last 6 Hours', spanMs: 6 * HOUR_MS },
  { id: '12h', label: 'Last 12 Hours', spanMs: 12 * HOUR_MS },
  { id: '24h', label: 'Last 24 Hours', spanMs: 24 * HOUR_MS },
  { id: '48h', label: 'Last 48 Hours', spanMs: 48 * HOUR_MS },
  { id: '3d', label: 'Last 3 Days', spanMs: 72 * HOUR_MS },
  { id: '7d', label: 'Last 7 Days', spanMs: 168 * HOUR_MS },
] as const

export type RangeId = (typeof RANGE_OPTIONS)[number]['id']

/**
 * The global time selection.
 *
 * A preset is relative and anchors to the newest sample on the device rather than to
 * `now`, so a lagging feed still renders data. A custom selection is absolute: the two
 * instants are used exactly as given and nothing is re-anchored. An optional `label` names
 * a calendar range ("Today", "This Month") for display; it never affects what is fetched.
 */
export type TimeSelection =
  | { kind: 'preset'; rangeId: RangeId }
  | { kind: 'custom'; start: number; end: number; label?: string }

export function spanOf(rangeId: RangeId): number {
  return RANGE_OPTIONS.find((r) => r.id === rangeId)?.spanMs ?? 24 * HOUR_MS
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface SectionError {
  message: string
  /** True when the failure is an expired/invalid session rather than a data problem. */
  isAuth: boolean
}

export interface DashboardData {
  /** The production line everything below was loaded for. */
  line: LineConfig
  state: LoadState
  /** Non-null when the whole load failed before anything could be read. */
  fatalError: SectionError | null

  /** Newest timestamp with data; presets are anchored here, not to `now`. */
  anchorMs: number | null
  windowStart: number | null
  windowEnd: number | null
  /** How far behind the newest sample must be before it is called stale. */
  staleAfterMs: number

  labRows: TimestampRow[]
  labLoading: boolean
  processRows: TimestampRow[]
  processLoading: boolean
  processError: SectionError | null
  /** Set when the process window was shortened; says what is actually shown. */
  processNote: { fetchedStart: number } | null
  /** True when the window is short enough that its process rows are every reading (not thinned or shortened). */
  processFull: boolean
  labError: SectionError | null
  /** Latest value per sensor *within the selected window*. */
  labLatest: Map<string, LastReading>
  processLatest: Map<string, LastReading>
  dataError: SectionError | null

  predicted: Point[]
  actual: Point[]
  matched: MatchedSample[]
  awaitingLab: Point[]

  /** RCA results whose event time falls inside the selected window, newest first. */
  rca: RcaFinding[]
  /** Every result the insight holds, newest first, regardless of the selected window. */
  rcaAll: RcaFinding[]
  /** Results the insight holds in total, regardless of window. */
  rcaTotal: number
  rcaMalformed: number
  /** The insight's shift summaries ("C3S RCA Shift"), every one it holds. */
  rcaShifts: ShiftSummary[]
  rcaLoading: boolean
  rcaError: SectionError | null

  /** Acceptable C3S band. The RCA insight does not supply one, so this is currently null. */
  band: Band | null

  refresh: () => void
  /** Changes only when the user asks for a refresh: the key other loads may refetch on. */
  refreshKey: number
  lastRefreshed: number | null
}

function toSectionError(err: unknown): SectionError {
  if (err instanceof AuthError) return { message: err.message, isAuth: true }
  if (err instanceof Error) return { message: err.message, isAuth: false }
  return { message: 'Unknown error', isAuth: false }
}

const LAB_SENSOR_IDS = LAB_SENSORS.map((x) => x.sensorId)
const PROCESS_SENSOR_IDS = PROCESS_SENSORS.map((x) => x.sensorId)

/** Beyond this, the newest reading is called out as stale in the header. */
export const STALE_AFTER_MS = 2 * HOUR_MS

/**
 * Laboratory requests cover at most a week each (about 700 rows: a prediction every 15 min plus the
 * lab results), so a range of months is many small requests rather than one very large one.
 */
export const LAB_CHUNK_MS = 7 * DAY_MS

/** The process device is dense; past this span only the most recent part is fetched. */
export const PROCESS_MAX_SPAN_MS = 7 * DAY_MS

/**
 * Windows longer than this are thinned to {@link PROCESS_THIN_MS} buckets on arrival. A minute of
 * slack: the "24 hours" preset is 24 h + 1 ms (its end is made inclusive) and must not be thinned.
 */
export const PROCESS_THIN_ABOVE_MS = DAY_MS + 60_000

/**
 * Chunk size for the process load: the window split into as many requests as run at once (4),
 * at least 6 h and at most a day each. A 24-hour window is four 6-hour requests side by side
 * instead of one 3 MB request; a week stays at day-sized chunks.
 */
export function processChunkMs(spanMs: number): number {
  return Math.min(DAY_MS, Math.max(6 * HOUR_MS, Math.ceil(spanMs / 4)))
}

/** Latest-in-window readings as the `LastReading` map the panels consume. */
function toReadings(
  sensorIds: readonly string[],
  rows: readonly TimestampRow[],
): Map<string, LastReading> {
  const found = latestFromRows(rows)
  const out = new Map<string, LastReading>()
  for (const sensorId of sensorIds) {
    const hit = found.get(sensorId)
    out.set(sensorId, { sensorId, value: hit?.value ?? null, time: hit?.time ?? null })
  }
  return out
}

export function useDashboardData(selection: TimeSelection, line: LineConfig): DashboardData {
  // Primitives, so a new line object with the same IDs does not refetch.
  const { labDevice, processDevice, insightId } = line
  // With a data cut-off in the past, presets can hang from it at once: the range loads start
  // without waiting for the newest-sample probe, which only moves the anchor earlier if the feed
  // stopped before the cut-off.
  const [anchorMs, setAnchorMs] = useState<number | null>(() =>
    DATA_END_MS != null && DATA_END_MS <= Date.now() ? DATA_END_MS : null,
  )
  const [anchorError, setAnchorError] = useState<SectionError | null>(null)

  const [labRows, setLabRows] = useState<TimestampRow[]>([])
  const [labLoading, setLabLoading] = useState(true)
  const [dataError, setDataError] = useState<SectionError | null>(null)

  const [processRows, setProcessRows] = useState<TimestampRow[]>([])
  const [processLoading, setProcessLoading] = useState(true)
  const [processError, setProcessError] = useState<SectionError | null>(null)
  const [processNote, setProcessNote] = useState<{ fetchedStart: number } | null>(null)

  const [rcaAll, setRcaAll] = useState<RcaFinding[]>([])
  const [rcaTotal, setRcaTotal] = useState(0)
  const [rcaMalformed, setRcaMalformed] = useState(0)
  const [rcaShifts, setRcaShifts] = useState<ShiftSummary[]>([])
  const [rcaLoading, setRcaLoading] = useState(true)
  const [rcaError, setRcaError] = useState<SectionError | null>(null)

  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  // Primitives, so a new selection object of the same value does not retrigger a fetch.
  const isCustom = selection.kind === 'custom'
  const spanMs = selection.kind === 'preset' ? spanOf(selection.rangeId) : 0
  const customStart = selection.kind === 'custom' ? selection.start : 0
  const customEnd = selection.kind === 'custom' ? selection.end : 0

  // The window is derived, not fetched: a custom selection is absolute and known at once;
  // a preset hangs off the newest sample so a lagging feed still shows data.
  const { windowStart, windowEnd } = useMemo(() => {
    if (isCustom) return { windowStart: customStart, windowEnd: customEnd }
    if (anchorMs == null) return { windowStart: null, windowEnd: null }
    return { windowStart: anchorMs - spanMs, windowEnd: anchorMs + 1 } // inclusive of the anchor
  }, [isCustom, customStart, customEnd, anchorMs, spanMs])

  // 1. Newest-sample probe. Once per refresh, not per selection.
  useEffect(() => {
    const controller = new AbortController()
    fetchLatestTimestamp(labDevice, [PREDICTED_C3S, ACTUAL_C3S], controller.signal)
      .then((t) => {
        // Presets hang from the newest sample, never past the data cut-off.
        setAnchorMs(clampEnd(t ?? Date.now()))
        setAnchorError(null)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        // Without an anchor a preset cannot resolve; fall back to "now" so the dashboard
        // still renders, and surface the failure.
        setAnchorMs(clampEnd(Date.now()))
        setAnchorError(toSectionError(err))
      })
    return () => controller.abort()
  }, [nonce, labDevice])

  // 2. RCA — the whole set, once per refresh. Filtering to the window is a memo below.
  useEffect(() => {
    const controller = new AbortController()
    setRcaLoading(true)
    fetchAllRcaFindings(controller.signal, insightId)
      .then((page) => {
        if (controller.signal.aborted) return
        // Events and shift summaries after the data cut-off are left out.
        setRcaAll(page.findings.filter((f) => !afterCutoff(f.eventTime)))
        // Events only: the insight also holds one summary per shift.
        setRcaTotal(Math.max(0, page.totalCount - page.shiftCount))
        setRcaMalformed(page.malformedCount)
        setRcaShifts(page.shifts.filter((s) => !afterCutoff(s.end ?? s.time ?? s.start ?? s.invocationTime)))
        setRcaError(null)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setRcaAll([])
        setRcaShifts([])
        setRcaTotal(0)
        setRcaError(toSectionError(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setRcaLoading(false)
      })
    return () => controller.abort()
  }, [nonce, insightId])

  // 3. Laboratory range — the C3S trend and everything derived from it.
  useEffect(() => {
    if (windowStart == null || windowEnd == null) return
    const controller = new AbortController()
    setLabLoading(true)
    setLabRows([]) // never leave the previous window's points under the new axis
    // Every sample of the range, however long: a long range is split into week-sized requests run
    // side by side, never shortened, so the C3S trend and zone plots see the whole range.
    fetchRangeChunked(labDevice, windowStart, windowEnd, {
      // Up to a week (with a minute's slack for the inclusive "7 days" preset) is one request.
      chunkMs: windowEnd - windowStart <= LAB_CHUNK_MS + MINUTE_MS ? Math.max(1, windowEnd - windowStart) : LAB_CHUNK_MS,
      maxSpanMs: Number.POSITIVE_INFINITY,
      signal: controller.signal,
    })
      .then(({ rows }) => {
        if (controller.signal.aborted) return
        setLabRows(rows)
        setDataError(null)
        setLastRefreshed(Date.now())
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setDataError(toSectionError(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLabLoading(false)
      })
    return () => controller.abort()
  }, [windowStart, windowEnd, nonce, labDevice])

  // 4. Process range — heavy, so chunked, thinned and independent of the above.
  useEffect(() => {
    if (windowStart == null || windowEnd == null) return
    const controller = new AbortController()
    setProcessLoading(true)
    setProcessRows([])
    fetchRangeChunked(processDevice, windowStart, windowEnd, {
      chunkMs: processChunkMs(windowEnd - windowStart),
      maxSpanMs: PROCESS_MAX_SPAN_MS,
      thinMs: windowEnd - windowStart > PROCESS_THIN_ABOVE_MS ? PROCESS_THIN_MS : 0,
      signal: controller.signal,
    })
      .then((r) => {
        if (controller.signal.aborted) return
        setProcessRows(r.rows)
        setProcessNote(r.capped ? { fetchedStart: r.fetchedStart } : null)
        setProcessError(null)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setProcessError(toSectionError(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setProcessLoading(false)
      })
    return () => controller.abort()
  }, [windowStart, windowEnd, nonce, processDevice])

  const rca = useMemo(() => {
    if (windowStart == null || windowEnd == null) return []
    return rcaAll.filter(
      (f) => f.eventTime != null && f.eventTime >= windowStart && f.eventTime <= windowEnd,
    )
  }, [rcaAll, windowStart, windowEnd])

  const predicted = useMemo(() => extractSeries(labRows, PREDICTED_C3S), [labRows])
  const actual = useMemo(() => extractSeries(labRows, ACTUAL_C3S), [labRows])
  const matched = useMemo(() => matchSamples(predicted, actual), [predicted, actual])
  const awaitingLab = useMemo(() => unmatchedPredictions(predicted, actual), [predicted, actual])

  const labLatest = useMemo(() => toReadings(LAB_SENSOR_IDS, labRows), [labRows])
  const processLatest = useMemo(() => toReadings(PROCESS_SENSOR_IDS, processRows), [processRows])

  // The insight no longer supplies an acceptable band (only a gap to a single target), so
  // none is drawn. Kept on the return type so the chart and KPI cards stay band-aware.
  const band: Band | null = null

  const waitingForWindow = windowStart == null
  const state: LoadState = waitingForWindow || labLoading || rcaLoading ? 'loading' : 'ready'

  return {
    line,
    state,
    fatalError: null,
    anchorMs,
    windowStart,
    windowEnd,
    staleAfterMs: STALE_AFTER_MS,
    labRows,
    labLoading,
    processRows,
    processLoading,
    processError,
    processNote,
    processFull: windowStart != null && windowEnd != null && windowEnd - windowStart <= PROCESS_THIN_ABOVE_MS,
    labError: dataError,
    labLatest,
    processLatest,
    dataError: dataError ?? anchorError,
    predicted,
    actual,
    matched,
    awaitingLab,
    rca,
    rcaAll,
    rcaTotal,
    rcaMalformed,
    rcaShifts,
    rcaLoading,
    rcaError,
    band,
    refresh,
    refreshKey: nonce,
    lastRefreshed,
  }
}
