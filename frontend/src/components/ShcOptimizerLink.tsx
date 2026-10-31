/**
 * Hand-off to the plant's SHC Optimizer, shown on a recommendation the insight sends there. It
 * opens in a new tab so the RCA stays on screen. A plant with no optimizer configured gets a note
 * instead of a dead link.
 */

import { shcOptimizerUrl } from '../config/links'
import { useLine } from '../config/LineContext'

export function ShcOptimizerLink() {
  const line = useLine()
  const url = shcOptimizerUrl(line.plant)
  if (!url) {
    return (
      <span className="shc-link shc-link--none" title="No SHC Optimizer is configured for this plant (PlantSpec.shcOptimizerUrl or VITE_SHC_OPTIMIZER_URL).">
        SHC Optimizer not configured for {line.plant.name}
      </span>
    )
  }
  return (
    <a className="shc-link" href={url} target="_blank" rel="noopener noreferrer">
      Open SHC Optimizer
      <span aria-hidden="true"> ↗</span>
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  )
}
