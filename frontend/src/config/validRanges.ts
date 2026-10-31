/**
 * Readings that cannot be real, dropped as they are read from the platform, so no chart, table or
 * figure ever shows them.
 *
 * Predicted C3S (D55 on every line's laboratory device) above 50 % is not a clinker value; the
 * model occasionally emits one (plant request, 2026-10-29). It is treated as missing, exactly like
 * a prediction that was never written: the C3S trend, histogram, compliance, zone plots, timeline
 * and shift figures all skip it.
 */

import { PREDICTED_C3S } from './deviceMappings'
import { PLANTS } from './plants'

/** Predicted C3S above this (%) is dropped. */
export const PREDICTED_C3S_MAX = 50

const LAB_DEVICES: ReadonlySet<string> = new Set(PLANTS.flatMap((p) => p.lines.map((l) => l.labDevice)))

/** True when a reading is outside what the sensor can report, and must not be shown. */
export function isImplausible(devID: string, sensorId: string, value: number): boolean {
  return sensorId === PREDICTED_C3S && LAB_DEVICES.has(devID) && value > PREDICTED_C3S_MAX
}
