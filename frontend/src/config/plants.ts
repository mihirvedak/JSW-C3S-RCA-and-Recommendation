/**
 * Plants and production lines.
 *
 * Every data load is scoped to the selected line: its devices, its roles and its RCA insight,
 * compiled once into a `LineModel`. To add a plant, write its spec in `config/clients/` and list
 * it here; nothing else changes. The first plant listed is the default for a new visitor.
 *
 * A line whose spec is inconsistent (a role naming a sensor that is not listed, or a required
 * role missing) fails here, at start-up, rather than somewhere in a chart.
 */

import { ADANI } from './clients/adani'
import { JSW } from './clients/jsw'
import type { PlantSpec } from './clients/types'
import { buildLine } from './lineModel'
import type { LineModel } from './lineModel'

export const PLANTS: readonly PlantSpec[] = [JSW, ADANI]

const MODELS = new Map<string, LineModel>()
for (const plant of PLANTS) {
  for (const line of plant.lines) MODELS.set(`${plant.id}/${line.id}`, buildLine(plant, line))
}

export interface LineSelection {
  plantId: string
  lineId: string
}

/** The plant and line a selection names, falling back to the first configured ones. */
export function resolveLine(sel: LineSelection | null): { plant: PlantSpec; line: LineModel } {
  const plant = PLANTS.find((p) => p.id === sel?.plantId) ?? PLANTS[0]
  const spec = plant.lines.find((l) => l.id === sel?.lineId) ?? plant.lines[0]
  return { plant, line: MODELS.get(`${plant.id}/${spec.id}`)! }
}

/** Every configured line, for tests and tooling. */
export const ALL_LINES: readonly LineModel[] = [...MODELS.values()]

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
