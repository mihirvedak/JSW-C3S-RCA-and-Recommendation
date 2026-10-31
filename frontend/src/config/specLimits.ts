/**
 * The laboratory rows of the Executive View's compliance table, for one line.
 *
 * A line's own limits come first (`LineSpec.specLimits`, each with the basis the plant gave it
 * on). For the C3S and free-lime rows a line without plant limits falls back to the bands the RCA
 * insight itself reports in its targets, and says so in the basis, so the table is never empty for
 * a newly onboarded plant and a percentile band is never mistaken for a specification.
 */

import type { ClinkerTargets } from '../services/rcaService'
import type { SpecLimits } from '../lib/compliance'
import type { LineModel } from './lineModel'
import { refKey } from './lineModel'

export interface SpecRow extends SpecLimits {
  key: string
  /** Where the limits come from, as the plant stated it. */
  basis: string | null
}

export function specRows(line: LineModel, targets: ClinkerTargets | null): SpecRow[] {
  const out: SpecRow[] = []
  for (const s of line.spec.specLimits ?? []) {
    const key = s.ref ? refKey(s.ref) : s.role ? line.role(s.role) : null
    if (!key) continue
    out.push({ key, lsl: s.lsl, usl: s.usl, basis: s.basis })
  }
  const has = (key: string) => out.some((r) => r.key === key)
  if (targets) {
    const [c3sLo, c3sHi] = targets.c3sBand
    const [flLo, flHi] = targets.freeLimeBand
    for (const key of [line.actualC3S, line.predictedC3S]) {
      if (!has(key)) out.push({ key, lsl: c3sLo, usl: c3sHi, basis: `RCA insight target band (target ${targets.c3s})` })
    }
    if (!has(line.freeLime)) out.push({ key: line.freeLime, lsl: flLo, usl: flHi, basis: `RCA insight target band (target ${targets.freeLime})` })
  } else {
    for (const key of [line.actualC3S, line.predictedC3S, line.freeLime]) {
      if (!has(key)) out.push({ key, lsl: null, usl: null, basis: null })
    }
  }
  return out
}
