/**
 * Laboratory data behind the 48-hour classification timeline.
 *
 * The timeline always covers the 48 hours up to the newest data, whatever range the time
 * picker shows, so it is loaded on its own: the line's laboratory device over those 48 hours
 * plus the free-lime look-back before them, so the first intervals can still be classified.
 */

import { useEffect, useState } from 'react'
import type { LineConfig } from '../config/plants'
import { fetchRange } from '../services/deviceDataService'
import { AuthError } from '../services/apiClient'
import { LAST_USABLE_LAB_MS } from '../lib/clinkerZones'
import type { TimestampRow } from '../lib/series'
import { TIMELINE_SPAN_MS, timelineEnd } from '../lib/timeline'
import type { SectionError } from './useDashboardData'

export interface Timeline48Data {
  /** End of the timeline; null until the newest sample is known. */
  end: number | null
  rows: TimestampRow[]
  loading: boolean
  error: SectionError | null
}

export function useTimeline48(anchorMs: number | null, line: LineConfig, refreshKey: number): Timeline48Data {
  const { labDevice } = line
  const end = anchorMs == null ? null : timelineEnd(anchorMs)
  const [state, setState] = useState<{ key: string; rows: TimestampRow[]; error: SectionError | null } | null>(null)
  const key = end == null ? null : `${labDevice}|${end}|${refreshKey}`

  useEffect(() => {
    if (end == null || key == null) return
    const controller = new AbortController()
    fetchRange(labDevice, end - TIMELINE_SPAN_MS - LAST_USABLE_LAB_MS, end, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setState({ key, rows, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({
          key,
          rows: [],
          error: {
            message: err instanceof Error ? err.message : 'Unknown error',
            isAuth: err instanceof AuthError,
          },
        })
      })
    return () => controller.abort()
  }, [end, key, labDevice])

  const current = state?.key === key ? state : null
  return {
    end,
    rows: current?.rows ?? [],
    loading: end != null && current == null,
    error: current?.error ?? null,
  }
}
