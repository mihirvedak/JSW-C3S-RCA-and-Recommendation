/**
 * The insight's recommended actions, read into parameter / current / suggested / limits.
 *
 * Two phrasings occur:
 *   "Reduce Kiln coal from 31.0 to 28.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h."
 *   "Raw mix: Bauxite 0.9% to 1.1% (+1.0 t/h)."
 * Anything else ("No set-point change.") is kept as the insight's text with no numbers. Values
 * are only ever read from the text; none is computed or suggested here.
 */

import { GENERIC_LABEL } from '../services/rcaService'
import type { RcaFinding } from '../services/rcaService'

export interface Action {
  /** "Kiln coal", "Raw mix · Bauxite". */
  parameter: string
  text: string
  from: number | null
  to: number | null
  unit: string
  /** The change as the insight states it, e.g. "-2.3 t/h". */
  change: string | null
  lo: number | null
  hi: number | null
  /** True when the action says no change. */
  hold: boolean
  /** True when the insight sends this action to the SHC optimizer. */
  shcOptimizer: boolean
}

/*
 * The insight says so in its own words when an action needs SHC optimisation, e.g. "SHC optimizer:
 * go to the kiln SHC optimizer. SHC now 852 kcal/kg vs target 703, reduce by 149." Only that
 * wording counts: an action that merely quotes an SHC figure ("TSR 12.6% to 13.5%, SHC 747 to
 * 712 kcal/kg") is not one.
 */
const SHC_OPTIMIZE = [
  /\b(?:SHC|specific heat(?: consumption)?)[\s-]*optimi[sz]/i,
  /\boptimi[sz]\w*\s+(?:the\s+)?(?:kiln\s+)?(?:SHC|specific heat(?: consumption)?)\b/i,
]

/** True when a recommendation (its label and text) calls for the SHC optimizer. */
export function needsShcOptimizer(...parts: ReadonlyArray<string | null | undefined>): boolean {
  const s = parts.filter(Boolean).join(' ')
  return SHC_OPTIMIZE.some((re) => re.test(s))
}

const NUM = '(-?\\d+(?:\\.\\d+)?)'
const VERB_FROM = new RegExp(
  `^(?:increase|raise|reduce|decrease|lower)\\s+(.+?)\\s+from\\s+${NUM}\\s*([^\\s(]*)\\s+to\\s+${NUM}\\s*([^\\s(,]*)\\s*(?:\\(([^)]*)\\))?(?:\\s*,\\s*limits\\s+${NUM}\\s+to\\s+${NUM})?`,
  'i',
)
const A_TO_B = new RegExp(`^(?:(.+?)\\s+)?${NUM}\\s*([^\\s(]*)\\s+to\\s+${NUM}\\s*([^\\s(]*)\\s*(?:\\(([^)]*)\\))?`, 'i')
const HOLD = /^no\b.*\b(change|advised)\b/i

export function parseAction(label: string, text: string): Action {
  const t = text.trim().replace(/\.$/, '')
  const base: Action = {
    parameter: GENERIC_LABEL.test(label.trim()) ? '' : label.trim(),
    text: text.trim(),
    from: null,
    to: null,
    unit: '',
    change: null,
    lo: null,
    hi: null,
    hold: HOLD.test(t),
    shcOptimizer: needsShcOptimizer(label, text),
  }
  const v = VERB_FROM.exec(t)
  if (v) {
    return {
      ...base,
      parameter: base.parameter || v[1],
      from: Number(v[2]),
      to: Number(v[4]),
      unit: v[5] || v[3] || '',
      change: v[6] ?? null,
      lo: v[7] == null ? null : Number(v[7]),
      hi: v[8] == null ? null : Number(v[8]),
    }
  }
  const a = A_TO_B.exec(t)
  if (a && !base.hold) {
    // "Kiln coal: 27.9 to 25.7 t/h" names nothing before the numbers; the label is the parameter.
    const what = (a[1] ?? '').trim()
    return {
      ...base,
      parameter: base.parameter && what ? `${base.parameter} · ${what}` : base.parameter || what,
      from: Number(a[2]),
      to: Number(a[4]),
      unit: a[5] || a[3] || '',
      change: a[6] ?? null,
    }
  }
  return base
}

/** Text compared without case, punctuation or spacing. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Split a one-line action into label and text only when what precedes the first colon reads as
 * a label ("Kiln coal: 27.9 to 25.7 t/h"). A colon inside a sentence ("… SHC optimizer: go to …")
 * is not a label boundary.
 */
const LABEL_PREFIX = /^([^:.]{1,40}):\s*(.+)$/s

/**
 * A finding's actions: the keyed recommendations first (they carry the operating limits), then
 * any action from the one-line `do` list they do not already cover. In the zone format the `do`
 * list holds every raw-mix move ("Limestone …", "Bauxite …") where the keyed form keeps one.
 * A `do` line repeating a keyed recommendation, with or without its label, is not shown twice.
 */
export function findingActions(f: Pick<RcaFinding, 'actions' | 'recommendations'>): Action[] {
  const out = f.recommendations.map((r) => parseAction(r.label, r.text))
  const seen = f.recommendations.flatMap((r) => [norm(r.text), norm(`${r.label} ${r.text}`)])
  const covered = (a: Action, line: string) => {
    const n = norm(line)
    // Containment only for substantive text, so a short "No change" never hides another action.
    const contains = (a: string, b: string) => b.length >= 20 && a.includes(b)
    if (seen.some((s) => s && (s === n || contains(s, n) || contains(n, s)))) return true
    return a.parameter !== '' && out.some((o) => o.parameter.toLowerCase() === a.parameter.toLowerCase())
  }
  for (const line of f.actions) {
    const m = LABEL_PREFIX.exec(line.trim())
    const a = m ? parseAction(m[1], m[2]) : parseAction('', line)
    if (!covered(a, line)) {
      out.push(a)
      seen.push(norm(line))
    }
  }
  return out
}
