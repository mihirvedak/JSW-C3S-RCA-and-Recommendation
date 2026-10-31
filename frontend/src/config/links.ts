/**
 * Other plant applications the dashboard hands off to.
 *
 * The SHC Optimizer is where a specific-heat-consumption recommendation is worked out. It opens
 * only from a recommendation that calls for it (`needsShcOptimizer` in `lib/recommendations.ts`).
 * Set `VITE_SHC_OPTIMIZER_URL` to point at another deployment.
 */

const DEFAULT_SHC_OPTIMIZER_URL = 'https://demo.iosense.io/launchpad/view?id=6ad86ac0fe275c6e1f553ae2&entityName=Kiln%20SHC%20Optimiser%20&fromLink=true&isHidden=false'

export const SHC_OPTIMIZER_URL: string =
  ((import.meta.env.VITE_SHC_OPTIMIZER_URL as string | undefined) ?? '').trim() || DEFAULT_SHC_OPTIMIZER_URL
