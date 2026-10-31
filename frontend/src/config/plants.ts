/**
 * Plants and production lines.
 *
 * Every data load is scoped to the selected line: its laboratory device, its process device
 * and its RCA insight. To add a line, add an entry with those three IDs; to add a plant, add a
 * plant with its lines. Nothing else changes: the selectors, the fetches and the caches all
 * read from here.
 *
 * Sensor names and units come from the tag maps in `tagMaps.ts`, which describe the D-tag
 * layout of the ADANI_LAB / ADANI_RAW devices. A line whose devices use a different layout
 * also needs its own tag map.
 *
 * Only Line 1 is configured: it is the only line whose devices and insight this account can
 * read. Its IDs are verified (see iosense.md). No other line is listed until its device and
 * insight IDs are known, so the selector never offers a line that would show no data.
 */

import { LAB_DEVICE, PROCESS_DEVICE } from './deviceMappings'

export interface LineConfig {
  id: string
  name: string
  labDevice: string
  processDevice: string
  insightId: string
}

export interface PlantConfig {
  id: string
  name: string
  lines: readonly LineConfig[]
}

export const PLANTS: readonly PlantConfig[] = [
  {
    id: 'adani',
    name: 'Adani Cement',
    lines: [
      {
        id: 'line1',
        name: 'Line 1',
        labDevice: LAB_DEVICE,
        processDevice: PROCESS_DEVICE,
        insightId: 'INS_df1b3c1a11de',
      },
    ],
  },
]

export interface LineSelection {
  plantId: string
  lineId: string
}

/** The plant and line a selection names, falling back to the first configured ones. */
export function resolveLine(sel: LineSelection | null): { plant: PlantConfig; line: LineConfig } {
  const plant = PLANTS.find((p) => p.id === sel?.plantId) ?? PLANTS[0]
  const line = plant.lines.find((l) => l.id === sel?.lineId) ?? plant.lines[0]
  return { plant, line }
}

const STORAGE_KEY = 'c3s.line'

/** The viewer's last plant and line. A convenience only: any failure means "use the default". */
export function loadLineSelection(): LineSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const v = raw ? (JSON.parse(raw) as Partial<LineSelection>) : null
    return v && typeof v.plantId === 'string' && typeof v.lineId === 'string'
      ? { plantId: v.plantId, lineId: v.lineId }
      : null
  } catch {
    return null
  }
}

export function saveLineSelection(sel: LineSelection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sel))
  } catch {
    // Private mode or blocked storage: the selection simply is not remembered.
  }
}
