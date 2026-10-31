/**
 * The latest moment the dashboard loads data for.
 *
 * A plant may ask for a cut-off (Adani, 2026-10-28: nothing after 28 Aug 2026, 03:00 plant
 * time). Device readings are then fetched only up to it, the "newest data" every preset and the
 * 48-hour timeline hang from is capped at it, and RCA events and shift summaries after it are
 * left out. The cut-off comes from the selected plant's spec (`PlantSpec.dataEnd`) and is applied
 * with `applyDataEnd` whenever the plant changes; `VITE_DATA_END` overrides every plant
 * ("2026-08-28T03:00" plant wall-clock, or "none" to load everything).
 *
 * The active cut-off is module state because the fetch layer (`deviceDataService`) clamps
 * every request and has no plant in hand. One plant is active at a time, so this is exact.
 */

import { wallClockToEpoch } from '../lib/time'

function parse(raw: string | null | undefined): number | null {
  const v = (raw ?? '').trim()
  if (!v || v.toLowerCase() === 'none') return null
  return wallClockToEpoch(v)
}

const ENV_RAW = (import.meta.env.VITE_DATA_END as string | undefined) ?? ''
/** True when the environment fixes the cut-off for every plant. */
export const DATA_END_FROM_ENV = ENV_RAW.trim() !== ''

let active: number | null = DATA_END_FROM_ENV ? parse(ENV_RAW) : null

/** Make a plant's cut-off the active one. Ignored when `VITE_DATA_END` is set. */
export function applyDataEnd(plantDataEnd: string | null | undefined): void {
  if (DATA_END_FROM_ENV) return
  active = parse(plantDataEnd)
}

/** Epoch ms of the active cut-off, or null for none. */
export const dataEndMs = (): number | null => active

/** A window's end, never past the cut-off. */
export const clampEnd = (endMs: number): number => (active == null ? endMs : Math.min(endMs, active))

/** True when a moment is after the cut-off and must not be shown. */
export const afterCutoff = (ms: number | null): boolean => active != null && ms != null && ms > active
