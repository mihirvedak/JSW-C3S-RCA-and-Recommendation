/**
 * Hand-off to the SHC Optimizer, shown on a recommendation the insight sends there. It opens in
 * a new tab so the RCA stays on screen.
 */

import { SHC_OPTIMIZER_URL } from '../config/links'

export function ShcOptimizerLink() {
  return (
    <a className="shc-link" href={SHC_OPTIMIZER_URL} target="_blank" rel="noopener noreferrer">
      Open SHC Optimizer
      <span aria-hidden="true"> ↗</span>
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  )
}
