/**
 * Shift definitions for the Executive View's "last two completed shifts".
 *
 * ASSUMPTION — NOT SUPPLIED BY THE PLANT: no shift schedule exists in the project, so this
 * is the common three-shift pattern (A 06:00–14:00, B 14:00–22:00, C 22:00–06:00). Times
 * are plant wall-clock in VITE_DISPLAY_TIMEZONE. If the plant runs a different pattern,
 * change this list; nothing else needs to move. An end at or before the start means the
 * shift finishes the next day.
 */

import type { ShiftDef } from '../lib/shifts'

export const SHIFTS: readonly ShiftDef[] = [
  { id: 'A', start: '06:00', end: '14:00' },
  { id: 'B', start: '14:00', end: '22:00' },
  { id: 'C', start: '22:00', end: '06:00' },
]

/** How many completed shifts the Executive View reports on. */
export const SHIFTS_REPORTED = 2
