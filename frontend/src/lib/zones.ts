/**
 * The single source of RCA classification colours.
 *
 * Every place that colours a classification — the 48-hour timeline, the deviation table, the
 * RCA panel, chart markers, the zone plots — reads it from here, so they cannot drift apart.
 *
 * Colours are fixed by the dashboard brief: Overlimed orange, Under burnt light blue, Overburnt
 * dark blue, Good clinker green. The insight's zone geometry also produces Underlimed (lime level
 * below the C3S band), which the brief does not list; it gets its own colour rather than being
 * folded into another class.
 *
 * "Undetermined" (a prediction that cannot be classified, or a result with no zone) is kept as a
 * class internally but is not shown, at the plant's request (2026-10-28): it is drawn as "Not
 * classified", the hatched grey that also covers intervals with no prediction, and no badge
 * names it. `shownZone` applies that rule; the timeline's tooltip still gives the reason.
 */

import type { ClinkerZone } from './clinkerZones'
import type { RcaFinding } from '../services/rcaService'

export type ZoneClass = ClinkerZone | 'Undetermined'

export const NOT_CLASSIFIED = 'Not classified' as const
export type ZoneKey = ZoneClass | typeof NOT_CLASSIFIED

/** What the UI shows for a class: Undetermined is drawn as Not classified. */
export const shownZone = (z: ZoneKey): ZoneKey => (z === 'Undetermined' ? NOT_CLASSIFIED : z)

export interface ZoneStyle {
  /** Solid colour: timeline segments, chart markers, swatches. */
  fill: string
  /** Light background for badges and plot regions. */
  soft: string
  /** Text colour on `soft`. */
  ink: string
  meaning: string
}

export const ZONE_STYLE: Readonly<Record<ZoneKey, ZoneStyle>> = {
  'Good clinker': {
    fill: '#22a06b',
    soft: '#e2f5ec',
    ink: '#0b5c3b',
    meaning: 'Lime level and free lime inside their target bands',
  },
  Overlimed: {
    fill: '#f07c1b',
    soft: '#fdeddc',
    ink: '#8a3f00',
    meaning: 'Lime level above the C3S band: a raw-mix (lime) problem',
  },
  'Under burnt': {
    fill: '#7cc6f2',
    soft: '#e5f4fd',
    ink: '#0b5a85',
    meaning: 'Lime level in band but free lime above its band: not burnt enough',
  },
  Overburnt: {
    fill: '#1f4fa3',
    soft: '#e1e8f5',
    ink: '#143672',
    meaning: 'Lime level in band but free lime below its band: burnt harder than needed',
  },
  Underlimed: {
    fill: '#9061c8',
    soft: '#efe6f8',
    ink: '#55308a',
    meaning: 'Lime level below the C3S band: a raw-mix (lime) problem',
  },
  Undetermined: {
    fill: '#f2c230',
    soft: '#fdf5d8',
    ink: '#6e5200',
    meaning: 'No classification: the result carries none, or the data to classify is missing',
  },
  [NOT_CLASSIFIED]: {
    fill: '#dfe4ec',
    soft: '#f3f5f8',
    ink: '#5b6779',
    meaning: 'No predicted C3S in this interval, or not enough data to classify it',
  },
}

/** Legend order of the classes shown: the brief's, then Underlimed. Undetermined is not shown. */
export const ZONE_ORDER: readonly ZoneClass[] = ['Good clinker', 'Overlimed', 'Under burnt', 'Overburnt', 'Underlimed']

/** The insight's zone wording ("Unburnt", "Under burnt", "Over-limed" …) as a class. */
export function normalizeZone(raw: string | null | undefined): ZoneClass {
  const z = (raw ?? '').toLowerCase().replace(/[\s_-]+/g, '')
  if (z.startsWith('good')) return 'Good clinker'
  if (z.startsWith('overlime')) return 'Overlimed'
  if (z.startsWith('underlime')) return 'Underlimed'
  if (z.startsWith('unburnt') || z.startsWith('underburnt')) return 'Under burnt'
  if (z.startsWith('overburnt') || z.startsWith('hardburnt')) return 'Overburnt'
  return 'Undetermined'
}

/** The classification of an RCA finding. Results in the older format carry none. */
export function zoneOf(f: Pick<RcaFinding, 'zone'>): ZoneClass {
  return normalizeZone(f.zone)
}

/** Kept for existing callers: the classification as display text. */
export const zoneLabel = (f: Pick<RcaFinding, 'zone'>): string => zoneOf(f)

/** Why a finding reads as it does, for a tooltip. */
export function zoneDetail(f: Pick<RcaFinding, 'zone' | 'direction'>): string {
  if (!f.zone) {
    const dir = f.direction === 'low' ? 'C3S low' : f.direction === 'high' ? 'C3S high' : 'no direction'
    return `Older result with no zone (${dir})`
  }
  const cls = normalizeZone(f.zone)
  return cls === 'Undetermined' || cls === f.zone ? `Insight zone: ${f.zone}` : `Insight zone: ${f.zone} → ${cls}`
}
