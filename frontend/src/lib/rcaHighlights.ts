/**
 * What an RCA finding says moved, as short "highs and lows" ("AFR ↑", "Secondary air
 * temperature ↓"). Read from the insight's own root-cause wording, never inferred.
 */

import { GENERIC_LABEL } from '../services/rcaService'
import type { RcaFinding, RcaItem, RcaSeverity } from '../services/rcaService'

/**
 * The parameter phrase of an item: its label, or — when the label is only a number
 * ("Watch 1") — the text up to the first colon ("Secondary air temperature low").
 */
export function itemSubject(item: RcaItem): string {
  return GENERIC_LABEL.test(item.label.trim()) ? item.text.split(':')[0].trim() : item.label.trim()
}

export interface Highlight {
  name: string
  dir: 'high' | 'low'
  severity: RcaSeverity
}

const DIRECTED = /^(.+?)\s+(high|low)\b/i

/**
 * A parameter name, not a clause: "Heat is already high" or "Fuel is not low" describe a state
 * and are not shown as a high or low. Names are short noun phrases ("Secondary air temperature").
 */
const CLAUSE = /\b(is|are|was|were|be|been|not|no|already|still|too)\b/i
const MAX_NAME_WORDS = 5

export function highsAndLows(f: Pick<RcaFinding, 'rootCauses'>): Highlight[] {
  const out: Highlight[] = []
  for (const c of f.rootCauses) {
    // "Kiln coal high" carries the direction in the label; "TSR" in "TSR low: …".
    const m = DIRECTED.exec(itemSubject(c)) ?? DIRECTED.exec(c.text.split(':')[0].trim())
    if (!m) continue
    const name = m[1].trim()
    if (CLAUSE.test(name) || name.split(/\s+/).length > MAX_NAME_WORDS) continue
    if (out.some((h) => h.name.toLowerCase() === name.toLowerCase())) continue
    out.push({ name, dir: m[2].toLowerCase() as 'high' | 'low', severity: c.severity })
  }
  return out
}

/**
 * The insight's own confirmation state. A primary cause is only "confirmed" when the insight
 * says so (`confirmed_cause: true`) or — for results that do not say — grades a cause as such.
 */
export function causeStatus(f: Pick<RcaFinding, 'confirmedCause' | 'rootCauses'>): { confirmed: boolean; text: string } {
  if (f.confirmedCause === true) return { confirmed: true, text: 'Cause confirmed by the insight' }
  if (f.confirmedCause == null && f.rootCauses.some((c) => c.severity === 'cause')) {
    return { confirmed: true, text: 'Cause graded "cause" by the insight' }
  }
  return { confirmed: false, text: 'Not confirmed: further validation required' }
}

