/**
 * Specification limits (LSL / USL) for the laboratory rows of the Executive View's compliance
 * table, as supplied by the plant (2026-10-28), each with the basis it was given on:
 *   - "Plant: …" — the plant's own target ± tolerance;
 *   - "History p5–p95" — the 5th to 95th percentile of the series' history.
 * The basis is shown with the row, so a percentile band is never mistaken for a specification.
 *
 * Values are in the units the sensor reports. A parameter with only one limit is classified
 * against that limit alone; to add a row, add an entry naming the device and sensor (its label
 * and unit come from the sensor registry).
 *
 * Plant notes that came with the limits:
 *   - Lab C3S historically runs a little below the plant band (median 42.2 against target 43), and
 *     free lime above it (median 1.76 against target 1.5).
 *   - AFR ash limits are from the furnace lab (n = 86, mean 27.4 %). The furnace lab samples about
 *     once a day, so a short range often holds none. The model's inferred D56 ("leftover after
 *     coal", about 45 % zeros) is not the source and must not be used for these limits.
 *
 * Process parameters (BZT, SAT, TAD, fuels, kiln feed, cooler fans…) are judged against the limits
 * of their kiln-feed bin instead: config/binLimits.ts.
 */

import { ACTUAL_C3S, LAB_DEVICE, PREDICTED_C3S, PROCESS_DEVICE } from './deviceMappings'
import type { SpecLimits } from '../lib/compliance'

export interface SpecRow extends SpecLimits {
  devID: typeof LAB_DEVICE | typeof PROCESS_DEVICE
  sensorId: string
  /** Where the limits come from, as the plant stated it. */
  basis: string | null
}

export const SPEC_ROWS: readonly SpecRow[] = [
  { devID: LAB_DEVICE, sensorId: ACTUAL_C3S, lsl: 41.5, usl: 44.5, basis: 'Plant: 43 ± 1.5' },
  { devID: LAB_DEVICE, sensorId: PREDICTED_C3S, lsl: 41.5, usl: 44.5, basis: 'Same C3S spec' },
  { devID: LAB_DEVICE, sensorId: 'D47', lsl: 30.5, usl: 34.8, basis: 'History p5–p95 (n=2,101)' }, // Coal ash
  { devID: LAB_DEVICE, sensorId: 'D48', lsl: 24.1, usl: 30.8, basis: 'AFR furnace lab ash, n=86' }, // AFR ash (furnace)
  { devID: LAB_DEVICE, sensorId: 'D37', lsl: 62.9, usl: 63.7, basis: 'History p5–p95' }, // Clinker CaO
  { devID: LAB_DEVICE, sensorId: 'D35', lsl: 5.37, usl: 5.79, basis: 'History p5–p95' }, // Clinker Al2O3
  { devID: LAB_DEVICE, sensorId: 'D43', lsl: 1.2, usl: 1.8, basis: 'Plant: 1.5 ± 0.3' }, // Clinker free CaO
  { devID: LAB_DEVICE, sensorId: 'D23', lsl: 102.8, usl: 106.6, basis: 'History p5–p95 (n=4,044)' }, // Kiln feed LSF
  { devID: LAB_DEVICE, sensorId: 'D24', lsl: 2.15, usl: 2.48, basis: 'History p5–p95' }, // Kiln feed SM (silica modulus)
  { devID: LAB_DEVICE, sensorId: 'D25', lsl: 1.13, usl: 1.44, basis: 'History p5–p95' }, // Kiln feed AM
]
