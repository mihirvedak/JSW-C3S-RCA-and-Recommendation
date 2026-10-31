/**
 * The latest moment the dashboard loads data for.
 *
 * At the plant's request (2026-10-28) nothing after 28 Aug 2026, 03:00 plant time is loaded: device
 * readings are fetched only up to it, the "newest data" every preset and the 48-hour timeline hang
 * from is capped at it, and RCA events and shift summaries after it are left out.
 *
 * Set `VITE_DATA_END` to a plant wall-clock time ("2026-08-28T03:00") to move it, or to "none" to
 * load everything.
 */

import { wallClockToEpoch } from '../lib/time'

const DEFAULT_END = '2026-08-28T03:00'

function resolve(): number | null {
  const raw = ((import.meta.env.VITE_DATA_END as string | undefined) ?? DEFAULT_END).trim()
  if (!raw || raw.toLowerCase() === 'none') return null
  return wallClockToEpoch(raw)
}

/** Epoch ms of the cut-off, or null for no cut-off. */
export const DATA_END_MS: number | null = resolve()

/** A window's end, never past the cut-off. */
export const clampEnd = (endMs: number): number => (DATA_END_MS == null ? endMs : Math.min(endMs, DATA_END_MS))

/** True when a moment is after the cut-off and must not be shown. */
export const afterCutoff = (ms: number | null): boolean => DATA_END_MS != null && ms != null && ms > DATA_END_MS
