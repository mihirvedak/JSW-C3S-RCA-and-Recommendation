/**
 * Process data around an RCA event that lies outside what the dashboard loaded for the range.
 *
 * The dashboard loads at most the newest 7 days of a longer range (minute data is ~0.9 MB per 6 h).
 * An event opened on Trend Analysis further back than that would sit on an empty stretch of the
 * chart, so its own part of the range is loaded instead (`contextWindow`): the same 7 days, thinned
 * to one reading per 5 minutes, in parallel chunks. Kept per window, as `useEventTrends` keeps its
 * event windows.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LineModel } from '../config/lineModel'
import { PROCESS_THIN_MS } from '../services/deviceDataService'
import { fetchDevicesRangeChunked } from '../services/lineDataService'
import { AuthError } from '../services/apiClient'
import type { TimestampRow } from '../lib/series'
import type { EventWindow } from '../lib/eventTrends'
import { processChunkMs } from './useDashboardData'
import type { SectionError } from './useDashboardData'

export interface EventContext {
  /** The part of the range loaded, or null when none is needed. */
  window: EventWindow | null
  rows: TimestampRow[]
  loading: boolean
  error: SectionError | null
  reload: () => void
}

function toSectionError(err: unknown): SectionError {
  if (err instanceof AuthError) return { message: err.message, isAuth: true }
  if (err instanceof Error) return { message: err.message, isAuth: false }
  return { message: 'Unknown error', isAuth: false }
}

/** `w` null means nothing to load: no event open, or the event is inside the loaded data. */
export function useEventContext(w: EventWindow | null, line: LineModel): EventContext {
  const lineKey = `${line.plant.id}/${line.id}`
  const start = w?.start ?? null
  const end = w?.end ?? null
  const key = start == null || end == null ? null : `${lineKey}|${start}|${end}`
  const cache = useRef(new Map<string, TimestampRow[]>())
  const [entry, setEntry] = useState<{ key: string; rows: TimestampRow[]; error: SectionError | null } | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (key == null || start == null || end == null) return
    const hit = cache.current.get(key)
    if (hit) {
      setEntry({ key, rows: hit, error: null })
      return
    }
    const controller = new AbortController()
    fetchDevicesRangeChunked(line, line.processDevices, start, end, {
      chunkMs: processChunkMs(end - start),
      thinMs: PROCESS_THIN_MS,
      signal: controller.signal,
    })
      .then((r) => {
        if (controller.signal.aborted) return
        cache.current.set(key, r.rows)
        setEntry({ key, rows: r.rows, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        // A failure is shown but not kept, so the next visit tries again.
        setEntry({ key, rows: [], error: toSectionError(err) })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `line` is identified by key
  }, [key, start, end, nonce])

  const reload = useCallback(() => {
    if (key != null) cache.current.delete(key)
    setEntry(null)
    setNonce((n) => n + 1)
  }, [key])

  const current = entry != null && entry.key === key ? entry : null
  return {
    window: start == null || end == null ? null : { start, end },
    rows: current?.rows ?? [],
    loading: key != null && current == null,
    error: current?.error ?? null,
    reload,
  }
}
