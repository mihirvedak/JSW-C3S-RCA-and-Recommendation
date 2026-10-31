/** The Adani Cement logo, as supplied by the plant (2026-10-28). */

import logo from '../assets/adani-cement-logo.png'

export function BrandLogo({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? 'brand--lg' : ''}`}>
      <img className="brand__logo" src={logo} alt="Adani Cement" width={412} height={265} />
    </div>
  )
}
