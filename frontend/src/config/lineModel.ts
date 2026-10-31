/**
 * The compiled form of a client's line spec: what every hook and component reads.
 *
 * Every sensor is addressed by its *key*, `DEVICE:SENSOR` (`sensorKey`). Rows merged from
 * several devices are keyed the same way, so two devices that both have a `D18` never collide
 * (JSW's `FLSCLINKER:D18` is lab C3S, `JSWBMBCLRMTR_KC:D18` is kiln-coal NCV). Nothing here is
 * ever indexed by a bare D-tag.
 *
 * Roles resolve to keys (`model.role('kilnFeed')`), or null when the client has not mapped
 * them; callers treat null as "this feature is not available on this line".
 */

import { SENSOR_ALIASES } from './sensorAliases'
import { DEFAULT_SHIFTS } from './shifts'
import type { ShiftDef } from '../lib/shifts'
import type {
  BinLimitsSpec,
  DeviceKind,
  DeviceSpec,
  GroupSpec,
  KilnFillingSpec,
  LineSpec,
  PlantSpec,
  Role,
  SensorRef,
  SignalQuality,
} from './clients/types'
import { REQUIRED_ROLES } from './clients/types'

export type Verification = 'verified' | 'category-only' | 'unverified'

export interface SensorDef {
  key: string
  devID: string
  sensorId: string
  kind: DeviceKind
  /** Supplied name or alias. Null when none exists — never invented. */
  name: string | null
  /**
   * What the UI shows: the name when there is one, otherwise a label built from what *is*
   * known (group and position), so no screen falls back to a bare sensor id for a listed tag.
   */
  label: string
  unit: string | null
  group: string
  groupLabel: string
  verification: Verification
  meaning: string | null
  quality: SignalQuality | null
}

export interface SensorGroup {
  id: string
  label: string
  sensors: SensorDef[]
}

export const sensorKey = (devID: string, sensorId: string): string => `${devID}:${sensorId}`
export const refKey = (ref: SensorRef): string => sensorKey(ref.devID, ref.sensorId)

export function splitKey(key: string): SensorRef {
  const i = key.indexOf(':')
  return i < 0 ? { devID: '', sensorId: key } : { devID: key.slice(0, i), sensorId: key.slice(i + 1) }
}

const OTHER: GroupSpec = { id: 'other', label: 'Other' }

/** Predicted C3S above this (%) is not a clinker value. Overridable per line. */
export const DEFAULT_PREDICTED_C3S_MAX = 50

export class LineModel {
  readonly plant: PlantSpec
  readonly spec: LineSpec
  readonly id: string
  readonly name: string
  readonly insightId: string
  readonly devices: readonly DeviceSpec[]
  readonly labDevices: readonly string[]
  readonly processDevices: readonly string[]
  readonly shifts: readonly ShiftDef[]
  readonly kilnFilling: KilnFillingSpec | null
  readonly binLimits: BinLimitsSpec | null
  readonly predictedC3SMax: number

  private readonly registry = new Map<string, SensorDef>()
  private readonly roles = new Map<Role, string>()
  private readonly hidden: ReadonlySet<string>
  private readonly excluded: ReadonlySet<string>
  private readonly fanFlows: readonly string[]
  private readonly deviceLabels = new Map<string, string>()

  constructor(plant: PlantSpec, spec: LineSpec) {
    this.plant = plant
    this.spec = spec
    this.id = spec.id
    this.name = spec.name
    this.insightId = spec.insightId
    this.devices = spec.devices
    this.labDevices = spec.devices.filter((d) => d.kind === 'lab').map((d) => d.devID)
    this.processDevices = spec.devices.filter((d) => d.kind === 'process').map((d) => d.devID)
    this.shifts = spec.shifts ?? DEFAULT_SHIFTS
    this.kilnFilling = spec.kilnFilling ?? null
    this.binLimits = spec.binLimits ?? null
    this.predictedC3SMax = spec.predictedC3SMax ?? DEFAULT_PREDICTED_C3S_MAX

    for (const d of spec.devices) {
      this.deviceLabels.set(d.devID, d.label)
      const groups = new Map(d.groups.map((g) => [g.id, g]))
      const position = new Map<string, number>()
      for (const s of d.sensors) {
        const g = groups.get(s.group) ?? OTHER
        const name = SENSOR_ALIASES[sensorKey(d.devID, s.id)] ?? s.name
        this.registry.set(sensorKey(d.devID, s.id), {
          key: sensorKey(d.devID, s.id),
          devID: d.devID,
          sensorId: s.id,
          kind: d.kind,
          name,
          label: name,
          unit: s.unit,
          group: g.id,
          groupLabel: g.label,
          verification: 'verified',
          meaning: s.meaning ?? null,
          quality: s.quality ?? null,
        })
      }
      for (const u of d.unnamed ?? []) {
        const g = groups.get(u.group) ?? OTHER
        const n = (position.get(g.id) ?? 0) + 1
        position.set(g.id, n)
        const alias = SENSOR_ALIASES[sensorKey(d.devID, u.id)] ?? null
        this.registry.set(sensorKey(d.devID, u.id), {
          key: sensorKey(d.devID, u.id),
          devID: d.devID,
          sensorId: u.id,
          kind: d.kind,
          name: alias,
          label: alias ?? `${g.label} parameter ${n}`,
          unit: null,
          group: g.id,
          groupLabel: g.label,
          verification: alias ? 'verified' : 'category-only',
          meaning: null,
          quality: null,
        })
      }
    }

    for (const [role, ref] of Object.entries(spec.roles) as Array<[Role, SensorRef | undefined]>) {
      if (!ref) continue
      const key = refKey(ref)
      if (!this.registry.has(key)) {
        throw new Error(`${plant.id}/${spec.id}: role "${role}" names ${key}, which is not a listed sensor`)
      }
      this.roles.set(role, key)
    }
    for (const role of REQUIRED_ROLES) {
      if (!this.roles.has(role)) throw new Error(`${plant.id}/${spec.id}: required role "${role}" is not mapped`)
    }

    this.hidden = new Set((spec.hidden ?? []).map(refKey))
    this.excluded = new Set((spec.trendExcluded ?? []).map(refKey))
    this.fanFlows = (spec.coolerFanFlows ?? []).map(refKey)
  }

  /* ------------------------------ sensors ------------------------------ */

  /** A listed sensor, or undefined for a pair the client did not list — never a guess. */
  getSensor(devID: string, sensorId: string): SensorDef | undefined {
    return this.registry.get(sensorKey(devID, sensorId))
  }

  sensorByKey(key: string): SensorDef | undefined {
    return this.registry.get(key)
  }

  /**
   * A definition for any key, listed or not. An unlisted key (a tag the device reports that the
   * client did not name) is described by its bare id and marked unverified, so discovery views
   * can still show it without pretending to know what it is.
   */
  describe(key: string): SensorDef {
    const hit = this.registry.get(key)
    if (hit) return hit
    const { devID, sensorId } = splitKey(key)
    const kind: DeviceKind = this.processDevices.includes(devID) ? 'process' : 'lab'
    return {
      key,
      devID,
      sensorId,
      kind,
      name: null,
      label: sensorId,
      unit: null,
      group: 'other',
      groupLabel: 'Other',
      verification: 'unverified',
      meaning: null,
      quality: null,
    }
  }

  /** Display label for a key: name or alias, else a built label, else the bare id. */
  label(key: string): string {
    return this.describe(key).label
  }

  unit(key: string): string | null {
    return this.registry.get(key)?.unit ?? null
  }

  get allSensors(): SensorDef[] {
    return [...this.registry.values()]
  }

  get labSensors(): SensorDef[] {
    return this.allSensors.filter((s) => s.kind === 'lab')
  }

  get processSensors(): SensorDef[] {
    return this.allSensors.filter((s) => s.kind === 'process')
  }

  isHidden(key: string): boolean {
    return this.hidden.has(key)
  }

  /** Listed sensors of one kind under their groups, in the devices' group order; hidden ones left out. */
  groups(kind: DeviceKind): SensorGroup[] {
    const out: SensorGroup[] = []
    const byId = new Map<string, SensorGroup>()
    const add = (g: GroupSpec) => {
      let cur = byId.get(g.id)
      if (!cur) {
        cur = { id: g.id, label: g.label, sensors: [] }
        byId.set(g.id, cur)
        out.push(cur)
      }
      return cur
    }
    for (const d of this.devices) if (d.kind === kind) for (const g of d.groups) add(g)
    for (const s of this.allSensors) {
      if (s.kind !== kind || this.hidden.has(s.key)) continue
      add({ id: s.group, label: s.groupLabel }).sensors.push(s)
    }
    return out.filter((g) => g.sensors.length > 0)
  }

  /** Human name for a device as a data source. */
  deviceLabel(devID: string): string {
    return this.deviceLabels.get(devID) ?? devID
  }

  /** The devices a set of keys live on, in the line's device order. */
  devicesOf(keys: readonly (string | null)[]): string[] {
    const want = new Set(keys.flatMap((k) => (k ? [splitKey(k).devID] : [])))
    return this.devices.map((d) => d.devID).filter((id) => want.has(id))
  }

  /* ------------------------------ roles ------------------------------ */

  /** The key a role resolves to, or null when this line has not mapped it. */
  role(role: Role): string | null {
    return this.roles.get(role) ?? null
  }

  /** The key a role resolves to; throws for one of the required roles, which always resolve. */
  need(role: 'predictedC3S' | 'actualC3S' | 'freeLime'): string {
    const k = this.roles.get(role)
    if (!k) throw new Error(`required role ${role} missing`)
    return k
  }

  get predictedC3S(): string {
    return this.need('predictedC3S')
  }

  get actualC3S(): string {
    return this.need('actualC3S')
  }

  get freeLime(): string {
    return this.need('freeLime')
  }

  /** Keys of the roles given, in order, skipping unmapped ones. */
  roleKeys(roles: readonly Role[]): string[] {
    return roles.flatMap((r) => {
      const k = this.roles.get(r)
      return k ? [k] : []
    })
  }

  /** The role a key is mapped to, if any. */
  roleOf(key: string): Role | null {
    for (const [r, k] of this.roles) if (k === key) return r
    return null
  }

  get coolerFanFlows(): readonly string[] {
    return this.fanFlows
  }

  isTrendExcluded(key: string): boolean {
    return this.excluded.has(key)
  }

  /* ------------------------------ plausibility ------------------------------ */

  /** True when a reading is outside what the sensor can report, and must not be shown. */
  isImplausible(key: string, value: number): boolean {
    return key === this.predictedC3S && value > this.predictedC3SMax
  }
}

export function buildLine(plant: PlantSpec, spec: LineSpec): LineModel {
  return new LineModel(plant, spec)
}
