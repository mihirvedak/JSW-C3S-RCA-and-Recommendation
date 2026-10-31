/**
 * Default shift pattern, used by any line whose client spec does not supply its own.
 *
 * ASSUMPTION — NOT SUPPLIED BY EITHER PLANT: the common three-shift pattern (A 06:00–14:00,
 * B 14:00–22:00, C 22:00–06:00), plant wall-clock in VITE_DISPLAY_TIMEZONE. A plant that runs a
 * different pattern sets `shifts` on its line spec (`config/clients/<plant>.ts`); nothing else
 * moves. An end at or before the start means the shift finishes the next day.
 */

import type { ShiftDef } from '../lib/shifts'

export const DEFAULT_SHIFTS: readonly ShiftDef[] = [
  { id: 'A', start: '06:00', end: '14:00' },
  { id: 'B', start: '14:00', end: '22:00' },
  { id: 'C', start: '22:00', end: '06:00' },
]

/** How many completed shifts the Executive View reports on. */
export const SHIFTS_REPORTED = 2
