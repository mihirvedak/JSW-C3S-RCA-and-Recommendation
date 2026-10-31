/**
 * What a client (plant) has to supply for the dashboard to run on its data.
 *
 * Nothing in `src/` outside `config/clients/` names a device, a sensor or an insight. A new
 * client is one file in this folder: its devices and the sensors on them, the *roles* the
 * dashboard needs (which sensor is the predicted C3S, which is the kiln feed rate, …), its
 * RCA insight, and whatever plant-specific limits it has supplied. Everything else — fetching,
 * charts, RCA parameter mapping, compliance, shift reports — is derived from this spec by
 * `config/lineModel.ts`.
 *
 * A role that a client cannot map is simply left out: the parts of the UI that need it say so
 * (no kiln filling degree without a kiln speed tag, no bin compliance without a limit table)
 * rather than showing a wrong or empty figure.
 */

import type { ShiftDef } from '../../lib/shifts'

/** A sensor on a device. Always the pair: D-tag numbers repeat across devices. */
export interface SensorRef {
  devID: string
  sensorId: string
}

/**
 * How a device is read.
 *   - `lab`: sparse (a sample every quarter hour to once a day). A window is one request per
 *     week, never shortened.
 *   - `process`: dense (a reading a minute). Fetched in parallel day-sized chunks, thinned to
 *     5-minute buckets past a day, and capped at the newest 7 days of a longer range.
 */
export type DeviceKind = 'lab' | 'process'

/** The tag map's assessment of a process signal, when the plant supplied one. */
export type SignalQuality = 'usable' | 'flag' | 'unreliable' | 'drop'

export interface SensorSpec {
  id: string
  /** Supplied name. Never invented: a sensor without one is not listed here. */
  name: string
  unit: string | null
  /** Display group: a lab material category or a process equipment section (see `groups`). */
  group: string
  /** What the parameter is, when the tag map says ("silica", "free lime - under-burning indicator"). */
  meaning?: string
  quality?: SignalQuality
}

export interface GroupSpec {
  id: string
  label: string
}

export interface DeviceSpec {
  devID: string
  kind: DeviceKind
  /** Human name for the device as a data source ("Laboratory", "Kiln DCS"). */
  label: string
  /** Display groups in order. A sensor whose group is not listed goes under "Other". */
  groups: readonly GroupSpec[]
  sensors: readonly SensorSpec[]
  /**
   * Lab devices whose layout is only partly known can carry unnamed tags the model writes
   * (Adani's D52–D57). They are listed by group and position and marked "alias not set".
   */
  unnamed?: ReadonlyArray<{ id: string; group: string }>
}

/**
 * The quantities the dashboard reasons about, independent of which tag measures them. The
 * first three are required; the rest unlock the features that use them.
 */
export type Role =
  // C3S and its lab check — required.
  | 'predictedC3S'
  | 'actualC3S'
  | 'freeLime'
  // Kiln operation (process device).
  | 'kilnFeed'
  | 'kilnCoal'
  | 'pcCoal'
  | 'lowNoxCoal'
  | 'solidAfr'
  | 'kilnRpm'
  | 'burningZoneTemp'
  | 'secondaryAirTemp'
  | 'tertiaryAirTemp'
  | 'kilnInletO2'
  | 'kilnInletTemp'
  | 'pcOutletTemp'
  | 'coolerGrateSpeed'
  // Laboratory chemistry.
  | 'kilnFeedLsf'
  | 'kilnFeedSm'
  | 'kilnFeedAm'
  | 'rawMixLsf'
  | 'rawMixSm'
  | 'rawMixAm'
  | 'rawMealCaO'
  | 'rawMealSiO2'
  | 'rawMealAl2O3'
  | 'rawMealFe2O3'
  | 'rawMealLoi'
  | 'clinkerSO3'
  // Fuel quality.
  | 'coalAsh'
  | 'pcCoalAsh'
  | 'afrAsh'
  | 'coalNcv'
  | 'pcCoalNcv'
  | 'afrNcv'

export const REQUIRED_ROLES: readonly Role[] = ['predictedC3S', 'actualC3S', 'freeLime']

export type RoleMap = Partial<Record<Role, SensorRef>>

/** The plant's kiln filling degree formula, anchored on a worked example it supplied. */
export interface KilnFillingSpec {
  /** filling % = anchor.percent × (feed / anchor.feed) × (anchor.rpm / rpm) */
  anchor: { percent: number; feed: number; rpm: number }
  /** Normal band, shaded on the chart. */
  norm: { lo: number; hi: number }
  /** Readings above this are flagged. */
  flagAbove: number
  /** The filling the "speed that brings it to" figure aims at. */
  speedTarget: number
  /** Below this kiln speed the kiln is stopped and the row is skipped. */
  minRpm: number
}

/** A fixed LSL / USL for one sensor, as the plant supplied it. */
export interface SpecLimitSpec {
  /** The sensor, by role or by reference. */
  role?: Role
  ref?: SensorRef
  lsl: number | null
  usl: number | null
  /** Where the limits come from, in the plant's words ("Plant: 43 ± 1.5", "History p5–p95"). */
  basis: string | null
}

export type LimitStatus = 'USABLE' | 'FLAG' | 'DROP' | 'UNRELIABLE'

export interface BinLimitRow {
  lsl: number
  usl: number
  target: number
  status: LimitStatus
}

export interface TphBin {
  id: string
  min: number
  max: number
}

/**
 * Process limits by kiln-feed bin: the plant's "golden period" table. Each parameter is judged
 * against the limits of the bin the kiln feed was in at the same instant.
 */
export interface BinLimitsSpec {
  /** The role the bins are cut on (normally `kilnFeed`). */
  binRole: Role
  bins: readonly TphBin[]
  /** Where the table came from and how it was made, for the table's caption. */
  source: string
  /** Status at or above these shares of judged time in range. */
  thresholds: { good: number; attention: number }
  /** The rows reported, in order: the table's own parameter name and the sensor it is about. */
  parameters: ReadonlyArray<{ name: string; ref: SensorRef }>
  /** bin id → parameter name → limits. A parameter absent from a bin has no limit there. */
  table: Readonly<Record<string, Readonly<Record<string, BinLimitRow>>>>
}

/** A value the model writes back to the platform; documentation, the dashboard only reads. */
export interface OutputSpec {
  ref: SensorRef
  name: string
  writer: string
}

export interface LineSpec {
  id: string
  name: string
  /** The RCA and recommendation insight for this line. */
  insightId: string
  devices: readonly DeviceSpec[]
  roles: RoleMap
  /** Cooler fan flow tags, summed into one "cooler fan flow" trend. Fans graded "drop" are skipped. */
  coolerFanFlows?: readonly SensorRef[]
  /** Sensors kept in the registry but never shown (e.g. a third derivation of C3S). */
  hidden?: readonly SensorRef[]
  /** Tags never charted on Trend Analysis even when an RCA names them. */
  trendExcluded?: readonly SensorRef[]
  kilnFilling?: KilnFillingSpec
  specLimits?: readonly SpecLimitSpec[]
  binLimits?: BinLimitsSpec
  /** Shift pattern. Defaults to A 06–14, B 14–22, C 22–06 plant time when not supplied. */
  shifts?: readonly ShiftDef[]
  /** Predicted C3S above this (%) is not a clinker value and is treated as missing. Default 50. */
  predictedC3SMax?: number
  /** What the model writes, and where. For the record; the dashboard reads sensors only. */
  outputs?: { topic?: string; writes: readonly OutputSpec[] }
  /** Open points the plant still has to answer; shown nowhere, kept with the config. */
  notes?: readonly string[]
}

export interface PlantSpec {
  id: string
  name: string
  brand: {
    /** Imported image URL. Without one the plant's name is shown as a wordmark. */
    logo?: string
    alt: string
  }
  /**
   * Latest moment to load data for, plant wall-clock ("2026-08-28T03:00"), when the plant asked
   * for a cut-off. Null or absent: load everything. `VITE_DATA_END` overrides it for every plant.
   */
  dataEnd?: string | null
  /** The plant's SHC Optimizer, opened from a recommendation that calls for it. */
  shcOptimizerUrl?: string
  lines: readonly LineSpec[]
}
