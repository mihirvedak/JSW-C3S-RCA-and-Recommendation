/**
 * The plant's brand: its logo when the client spec carries one, otherwise its name as a wordmark.
 * Before a line is chosen (the sign-in gate) the remembered or default plant is shown.
 */

import type { PlantSpec } from '../config/clients/types'
import { loadLineSelection, resolveLine } from '../config/plants'

export function BrandLogo({ plant, large = false }: { plant?: PlantSpec; large?: boolean }) {
  const p = plant ?? resolveLine(loadLineSelection()).plant
  return (
    <div className={`brand ${large ? 'brand--lg' : ''}`}>
      {p.brand.logo ? (
        <img className="brand__logo" src={p.brand.logo} alt={p.brand.alt} />
      ) : (
        <span className="brand__wordmark">{p.brand.alt}</span>
      )}
    </div>
  )
}
