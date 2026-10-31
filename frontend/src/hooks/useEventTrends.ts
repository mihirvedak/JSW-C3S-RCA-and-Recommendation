/**
 * Process and laboratory data around one RCA event, for the Trend Analysis tab.
 *
 * Two independent loads keyed by the event time, each with its own error, so a failing
 * process feed still leaves the laboratory samples on screen:
 *   - ADANI_RAW over the trend window (1 h before to 30 min after the event),
 *   - ADANI_LAB over the look-back before the event, for the last samples.
 *
 * Results are kept per event for the life of the dashboard, so going back to an event or
 * returning to the tab does not fetch again. `reload` drops the cached entry.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LineConfig } from '../config/plants'
import { fetchRange } from '../services/deviceDataService'
import { AuthError } from '../services/apiClient'
import type { TimestampRow } from '../lib/series'
import { labWindow, trendWindow } from '../lib/eventTrends'
import type { EventWindow } from '../lib/eventTrends'
import type { SectionError } from './useDashboardData'

interface Loaded {
  rows: TimestampRow[]
  error: SectionError | null
}

export interface EventTrends {
  /** Null until an event is given. */
  window: EventWindow | null
  processRows: TimestampRow[]
  processLoading: boolean
  processError: SectionError | null
  labRows: TimestampRow[]
  labLoading: boolean
  labError: SectionError | null
  reload: () => void
}

function toSectionError(err: unknown): SectionError {
  if (err instanceof AuthError) return { message: err.message, isAuth: true }
  if (err instanceof Error) return { message: err.message, isAuth: false }
  return { message: 'Unknown error', isAuth: false }
}

async function load(
  devID: string,
  w: EventWindow,
  signal: AbortSignal,
): Promise<Loaded> {
  try {
    return { rows: await fetchRange(devID, w.start, w.end, signal), error: null }
  } catch (err) {
    if (signal.aborted) throw err
    return { rows: [], error: toSectionError(err) }
  }
}

/** `eventMs` null means "nothing to load" (no event selected, or the tab is not open). */
export function useEventTrends(eventMs: number | null, line: LineConfig): EventTrends {
  const { labDevice, processDevice } = line
  // Keyed by line and event, so switching lines never shows another line's data.
  const key = eventMs == null ? null : `${labDevice}|${processDevice}|${eventMs}`
  const cache = useRef(new Map<string, { process: Loaded; lab: Loaded }>())
  const [entry, setEntry] = useState<{ key: string; process: Loaded; lab: Loaded } | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (eventMs == null || key == null) return
    const hit = cache.current.get(key)
    if (hit) {
      setEntry({ key, ...hit })
      return
    }
    const controller = new AbortController()
    Promise.all([
      load(processDevice, trendWindow(eventMs), controller.signal),
      load(labDevice, labWindow(eventMs), controller.signal),
    ])
      .then(([process, lab]) => {
        if (controller.signal.aborted) return
        // A failure is shown but not kept, so the next visit tries again.
        if (!process.error && !lab.error) cache.current.set(key, { process, lab })
        setEntry({ key, process, lab })
      })
      .catch(() => {
        // Aborted: a newer event replaced this one.
      })
    return () => controller.abort()
  }, [eventMs, key, labDevice, processDevice, nonce])

  const reload = useCallback(() => {
    if (key != null) cache.current.delete(key)
    setEntry(null)
    setNonce((n) => n + 1)
  }, [key])

  // Only the entry for the event asked for counts; anything else is still loading.
  const current = entry != null && entry.key === key ? entry : null
  const loading = eventMs != null && current == null

  return {
    window: eventMs == null ? null : trendWindow(eventMs),
    processRows: current?.process.rows ?? [],
    processLoading: loading,
    processError: current?.process.error ?? null,
    labRows: current?.lab.rows ?? [],
    labLoading: loading,
    labError: current?.lab.error ?? null,
    reload,
  }
}
