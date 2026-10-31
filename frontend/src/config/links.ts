/**
 * Other plant applications the dashboard hands off to.
 *
 * The SHC Optimizer is where a specific-heat-consumption recommendation is worked out. It opens
 * only from a recommendation that calls for it (`needsShcOptimizer` in `lib/recommendations.ts`).
 * Each plant names its own deployment (`PlantSpec.shcOptimizerUrl`); `VITE_SHC_OPTIMIZER_URL`
 * overrides it for every plant. A plant with neither gets no link.
 */

import type { PlantSpec } from './clients/types'

const ENV_URL = ((import.meta.env.VITE_SHC_OPTIMIZER_URL as string | undefined) ?? '').trim()

export function shcOptimizerUrl(plant: PlantSpec): string | null {
  return ENV_URL || plant.shcOptimizerUrl || null
}
