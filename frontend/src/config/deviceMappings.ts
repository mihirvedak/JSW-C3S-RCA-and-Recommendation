/**
 * Central, device-scoped parameter registry.
 *
 * Every lookup in this app is keyed by the pair (devID, sensorId). D-tag numbers are
 * NOT unique across devices — ADANI_LAB:D55 is predicted C3S while ADANI_RAW:D55 is
 * Cooler Fan 9 Amps — so nothing here is ever indexed by sensor id alone.
 *
 * Names, units and (on the process device) equipment sections come from the supplied tag
 * maps in `tagMaps.ts`; `sensorAliases.ts` can override any single name. `verification`
 * records how much is known about an entry:
 *   'verified'      — a name was supplied (tag map or alias).
 *   'category-only' — the material group is known but no name: the ADANI_LAB model outputs
 *                     D52–D54, D56 and D57, which the lab tag map does not cover. The UI
 *                     labels these by category and position and marks the alias as not set.
 *   'unverified'    — carries data but neither name nor group is known. No longer occurs
 *                     for a mapped device.
 */

import { SENSOR_ALIASES } from './sensorAliases'
import {
  LAB_TAGS,
  PROCESS_SECTION_LABELS,
  PROCESS_SECTION_ORDER,
  RAW_TAGS,
} from './tagMaps'
import type { ProcessSection, SignalQuality } from './tagMaps'

export const LAB_DEVICE = 'ADANI_LAB' as const
export const PROCESS_DEVICE = 'ADANI_RAW' as const

export type DeviceId = typeof LAB_DEVICE | typeof PROCESS_DEVICE

export type Verification = 'verified' | 'category-only' | 'unverified'

/** Material categories on ADANI_LAB. */
export type LabCategory =
  | 'raw_mix'
  | 'kiln_feed'
  | 'hot_meal_1'
  | 'hot_meal_2'
  | 'clinker'
  | 'coal'
  | 'afr'
  | 'model_output'

/** Equipment sections on ADANI_RAW, as given by the process tag map. */
export type ProcessGroup = ProcessSection

export interface SensorDef {
  devID: DeviceId
  sensorId: string
  /** Supplied name or alias. Null when none exists — never invented. */
  name: string | null
  /**
   * What the UI shows. The supplied name or alias when there is one, otherwise a label
   * built from what *is* known (material category / position), so no screen has to fall
   * back to a bare sensor ID.
   */
  label: string
  unit: string | null
  verification: Verification
}

export interface LabSensorDef extends SensorDef {
  devID: typeof LAB_DEVICE
  category: LabCategory
  /** What the parameter is, from the lab tag map ("silica", "free lime - …"). */
  meaning: string | null
}

export interface ProcessSensorDef extends SensorDef {
  devID: typeof PROCESS_DEVICE
  group: ProcessGroup
  /** The process tag map's assessment of the signal. Carried as data; nothing is hidden by it. */
  quality: SignalQuality | null
}

export const LAB_CATEGORY_LABELS: Record<LabCategory, string> = {
  raw_mix: 'Raw Mix Quality',
  kiln_feed: 'Kiln Feed Quality',
  hot_meal_1: 'Hot Meal Quality — Stream 1',
  hot_meal_2: 'Hot Meal Quality — Stream 2',
  clinker: 'Clinker Quality',
  coal: 'Coal Quality',
  afr: 'Alternative Fuel (AFR) Quality',
  model_output: 'Model Outputs & Lab C3S',
}

/** Short category names used to build fallback labels, e.g. "Raw mix parameter 3". */
const LAB_CATEGORY_SHORT: Record<LabCategory, string> = {
  raw_mix: 'Raw mix',
  kiln_feed: 'Kiln feed',
  hot_meal_1: 'Hot meal (stream 1)',
  hot_meal_2: 'Hot meal (stream 2)',
  clinker: 'Clinker',
  coal: 'Coal',
  afr: 'AFR',
  model_output: 'Model output',
}

export const PROCESS_GROUP_LABELS: Record<ProcessGroup, string> = PROCESS_SECTION_LABELS

/** Section order for lists: the order of the process tag map. */
export const PROCESS_GROUP_ORDER: readonly ProcessGroup[] = PROCESS_SECTION_ORDER

/* ------------------------------------------------------------------ *
 * The four C3S series. These names come from the mapping authority.
 * ------------------------------------------------------------------ */

/** Predicted C3S — ADANI_LAB:D55. Kept strictly separate from the actual series. */
export const PREDICTED_C3S = 'D55' as const
/** Actual laboratory C3S — ADANI_LAB:D58. */
export const ACTUAL_C3S = 'D58' as const
/** CLINKER_C3S — ADANI_LAB:D44. A distinct clinker parameter, never substituted above. */
export const CLINKER_C3S = 'D44' as const
/** CLINKER_C3S_uncorrected — ADANI_LAB:D45. Also distinct. */
export const CLINKER_C3S_UNCORRECTED = 'D45' as const
/**
 * Lab parameters the dashboard does not show. C3S is reported as Actual C3S (Lab, D58) and
 * Predicted C3S (D55) only; the clinker Bogue C3S values (corrected D44, uncorrected D45) are
 * other derivations of the same quantity and are kept out so no screen shows a third C3S.
 * They stay in the registry; remove an entry here to show it again.
 */
export const HIDDEN_LAB_SENSORS: ReadonlySet<string> = new Set([CLINKER_C3S, CLINKER_C3S_UNCORRECTED])

/** Clinker free lime (FreeCaO) — ADANI_LAB:D43. The second axis of the clinker zone plots. */
export const CLINKER_FREE_LIME = 'D43' as const

/* ------------------------------------------------------------------ *
 * ADANI_LAB
 * ------------------------------------------------------------------ */

/** Category bands supplied by the brief. Inclusive on both ends. */
const LAB_BANDS: ReadonlyArray<{ from: number; to: number; category: LabCategory }> = [
  { from: 0, to: 12, category: 'raw_mix' },
  { from: 13, to: 25, category: 'kiln_feed' },
  { from: 26, to: 29, category: 'hot_meal_1' },
  { from: 30, to: 33, category: 'hot_meal_2' },
  { from: 34, to: 45, category: 'clinker' },
  { from: 46, to: 47, category: 'coal' },
  { from: 48, to: 51, category: 'afr' },
  // D52–D58 sit outside the bands in the brief. They are observed on the device and the
  // two named ones (D55, D58) are the C3S series, so they are grouped as model outputs.
  { from: 52, to: 58, category: 'model_output' },
]

/**
 * The two model-output series the lab tag map (D0–D51) does not cover. Their names come from
 * the original mapping brief. D44 and D45 (clinker C3S) are in the tag map and stay distinct
 * from these.
 */
const LAB_MODEL_NAMED: Readonly<Record<string, { name: string; unit: string | null }>> = {
  [PREDICTED_C3S]: { name: 'Predicted C3S', unit: '%' },
  [ACTUAL_C3S]: { name: 'Actual C3S (Lab)', unit: '%' },
}

/** Highest D-tag observed to carry data on ADANI_LAB (D59+ returned empty). */
export const LAB_MAX_TAG = 58

/** Alias from the alias file, else the supplied name, else null. */
function resolveName(devID: string, sensorId: string, supplied: string | undefined): string | null {
  return SENSOR_ALIASES[`${devID}:${sensorId}`] ?? supplied ?? null
}

function buildLabSensors(): LabSensorDef[] {
  const out: LabSensorDef[] = []
  for (const band of LAB_BANDS) {
    for (let i = band.from; i <= band.to; i++) {
      const sensorId = `D${i}`
      const tag = LAB_TAGS[sensorId]
      const model = LAB_MODEL_NAMED[sensorId]
      const name = resolveName(LAB_DEVICE, sensorId, tag?.label ?? model?.name)
      out.push({
        devID: LAB_DEVICE,
        sensorId,
        name,
        label: name ?? `${LAB_CATEGORY_SHORT[band.category]} parameter ${i - band.from + 1}`,
        unit: tag ? tag.unit : (model?.unit ?? null),
        verification: name ? 'verified' : 'category-only',
        category: band.category,
        meaning: tag?.meaning ?? null,
      })
    }
  }
  return out
}

export const LAB_SENSORS: readonly LabSensorDef[] = buildLabSensors()

export const LAB_SENSORS_BY_CATEGORY: Readonly<Record<LabCategory, readonly LabSensorDef[]>> =
  LAB_SENSORS.reduce(
    (acc, s) => {
      acc[s.category] = [...(acc[s.category] ?? []), s]
      return acc
    },
    {} as Record<LabCategory, LabSensorDef[]>,
  )

/* ------------------------------------------------------------------ *
 * ADANI_RAW
 * ------------------------------------------------------------------ */

/** Highest D-tag observed to carry data on ADANI_RAW (D0–D123 in a live probe). */
export const PROCESS_MAX_TAG = 123

function buildProcessSensors(): ProcessSensorDef[] {
  const out: ProcessSensorDef[] = []
  for (let i = 0; i <= PROCESS_MAX_TAG; i++) {
    const sensorId = `D${i}`
    const tag = RAW_TAGS[sensorId]
    const name = resolveName(PROCESS_DEVICE, sensorId, tag?.label)
    out.push({
      devID: PROCESS_DEVICE,
      sensorId,
      name,
      label: name ?? `Process signal ${i + 1}`,
      unit: tag?.unit ?? null,
      verification: name ? 'verified' : 'unverified',
      group: tag?.section ?? 'other',
      quality: tag?.quality ?? null,
    })
  }
  return out
}

export const PROCESS_SENSORS: readonly ProcessSensorDef[] = buildProcessSensors()

/* ------------------------------------------------------------------ *
 * Lookup helpers — always device-scoped.
 * ------------------------------------------------------------------ */

const REGISTRY = new Map<string, SensorDef>()
for (const s of [...LAB_SENSORS, ...PROCESS_SENSORS]) {
  REGISTRY.set(`${s.devID}:${s.sensorId}`, s)
}

export function sensorKey(devID: string, sensorId: string): string {
  return `${devID}:${sensorId}`
}

/** Resolve a sensor definition. Returns undefined for an unknown pair — never a guess. */
export function getSensor(devID: string, sensorId: string): SensorDef | undefined {
  return REGISTRY.get(sensorKey(devID, sensorId))
}

/**
 * Label for a sensor: its alias or supplied name, otherwise a label built from its known
 * category and position (never a made-up parameter name). A pair that is not in the
 * registry at all falls back to the bare id, which should not occur for mapped devices.
 */
export function sensorLabel(devID: string, sensorId: string): string {
  return getSensor(devID, sensorId)?.label ?? sensorId
}

/** Human name for a data source, used where a `DEVICE:SENSOR` reference would be noise. */
export function sourceLabel(devID: string): string {
  return devID === LAB_DEVICE ? 'Laboratory' : devID === PROCESS_DEVICE ? 'Process' : devID
}

/** True when the display name is a real supplied name rather than the sensor id. */
export function hasVerifiedName(devID: string, sensorId: string): boolean {
  return getSensor(devID, sensorId)?.verification === 'verified'
}

/** Fully-qualified reference for tooltips and detail panels, e.g. `ADANI_LAB:D55`. */
export function qualifiedRef(devID: string, sensorId: string): string {
  return `${devID}:${sensorId}`
}
