/**
 * Which plant tags an RCA finding is about.
 *
 * The insight names parameters in prose ("Kiln coal high", "TSR low", "Kiln feed LSF"), never by
 * tag. Each rule below ties one of those names to the *roles* that measure it; the selected line
 * resolves the roles to its own tags, and a role the line has not mapped is skipped. The first
 * rule that matches a label wins, so the more specific names come first ("Kiln feed LSF" is the
 * lab LSF, not the kiln feed rate).
 *
 * Derived quantities have no tag of their own. They map to the measured inputs they are computed
 * from: TSR and SHC to the fuel rates, fuel ash to the coal / AFR ash and fuel rates, lime level
 * to clinker C3S and free lime.
 */

import type { RcaFinding } from '../services/rcaService'
import { itemSubject } from '../lib/rcaHighlights'
import type { Role } from './clients/types'
import type { LineModel } from './lineModel'

interface Rule {
  match: RegExp
  roles: readonly Role[]
}

const RULES: readonly Rule[] = [
  { match: /secondary air/i, roles: ['secondaryAirTemp'] },
  { match: /tertiary air|\btad\b/i, roles: ['tertiaryAirTemp'] },
  { match: /cooler grate/i, roles: ['coolerGrateSpeed'] },
  { match: /kiln inlet o2|inlet oxygen/i, roles: ['kilnInletO2'] },
  { match: /kiln inlet temp/i, roles: ['kilnInletTemp'] },
  { match: /kiln (rpm|speed)/i, roles: ['kilnRpm'] },
  { match: /pc outlet|precalciner|calciner (outlet )?temp/i, roles: ['pcOutletTemp'] },
  { match: /\blsf\b/i, roles: ['kilnFeedLsf'] },
  { match: /^raw mix/i, roles: ['rawMixLsf', 'rawMixSm', 'rawMixAm'] },
  { match: /raw meal|\bbogue\b|kiln feed (cao|sio2|al2o3|fe2o3|loi|chem|oxide)/i, roles: ['rawMealCaO', 'rawMealSiO2', 'rawMealAl2O3', 'rawMealFe2O3', 'rawMealLoi'] },
  { match: /free\s*(lime|cao)|\bfcao\b/i, roles: ['freeLime'] },
  { match: /over\s*limed?|under\s*limed?|lime level/i, roles: ['freeLime', 'kilnFeedLsf'] },
  { match: /unburnt|under\s*burnt|over\s*burnt|hard\s*burnt|burning/i, roles: ['burningZoneTemp', 'freeLime'] },
  { match: /kiln share of coal/i, roles: ['kilnCoal', 'pcCoal'] },
  { match: /coal per t|coal rate/i, roles: ['kilnCoal', 'pcCoal', 'lowNoxCoal', 'kilnFeed'] },
  { match: /low.?nox/i, roles: ['lowNoxCoal'] },
  { match: /kiln coal/i, roles: ['kilnCoal'] },
  { match: /\bpc coal|calciner coal/i, roles: ['pcCoal'] },
  { match: /\bafr\b/i, roles: ['solidAfr'] },
  { match: /\btsr\b/i, roles: ['solidAfr', 'kilnCoal', 'pcCoal', 'lowNoxCoal'] },
  { match: /\bshc\b|specific heat/i, roles: ['kilnCoal', 'pcCoal', 'lowNoxCoal', 'solidAfr', 'kilnFeed'] },
  { match: /coal ash/i, roles: ['coalAsh', 'pcCoalAsh'] },
  {
    match: /fuel ash|ash fed|ash addition|total ash/i,
    roles: ['kilnCoal', 'pcCoal', 'lowNoxCoal', 'solidAfr', 'coalAsh', 'pcCoalAsh', 'afrAsh'],
  },
  { match: /kiln feed/i, roles: ['kilnFeed'] },
  { match: /\bso3\b|sulph|sulf/i, roles: ['clinkerSO3'] },
  { match: /\bncv\b|calorific/i, roles: ['coalNcv', 'pcCoalNcv', 'afrNcv'] },
]

/** A recommendation that advises nothing ("No proportions advised …") names no parameter. */
const NO_CHANGE = /^no\b.*\b(advised|change)\b/i

export interface RelevantParameter {
  key: string
  devID: string
  sensorId: string
  /** The insight's own wording that brought this tag in, e.g. "Root cause: Kiln coal high". */
  sources: string[]
}

export interface RelevantParameters {
  process: RelevantParameter[]
  lab: RelevantParameter[]
}

/**
 * The tags a finding is about, in the order the insight first mentions them. C3S always leads
 * the lab list: predicted C3S first, since it is what triggers every RCA event, then the
 * laboratory C3S that checks it.
 */
export function relevantParameters(f: RcaFinding, line: LineModel): RelevantParameters {
  const found = new Map<string, RelevantParameter>()
  const add = (key: string, source: string) => {
    const cur = found.get(key)
    if (!cur) {
      const def = line.describe(key)
      found.set(key, { key, devID: def.devID, sensorId: def.sensorId, sources: [source] })
    } else if (!cur.sources.includes(source)) cur.sources.push(source)
  }

  add(line.predictedC3S, 'RCA trigger')
  add(line.actualC3S, 'Lab check of the prediction')

  const mentions: Array<{ label: string; source: string }> = []
  if (f.zone) mentions.push({ label: f.zone, source: `Zone: ${f.zone}` })
  if (f.primaryCause) mentions.push({ label: f.primaryCause, source: `Primary cause: ${f.primaryCause}` })
  // Numbered labels ("Watch 1") name the parameter in the text instead.
  for (const c of f.rootCauses) {
    const subject = itemSubject(c)
    mentions.push({ label: subject, source: `Root cause: ${subject}` })
  }
  for (const r of f.recommendations) {
    const subject = itemSubject(r)
    if (!NO_CHANGE.test(r.text.trim())) mentions.push({ label: subject, source: `Recommendation: ${subject}` })
  }

  for (const { label, source } of mentions) {
    const rule = RULES.find((r) => r.match.test(label))
    if (!rule) continue
    for (const key of line.roleKeys(rule.roles)) add(key, source)
  }

  const all = [...found.values()]
  return {
    process: all.filter((p) => line.describe(p.key).kind === 'process'),
    lab: all.filter((p) => line.describe(p.key).kind === 'lab'),
  }
}
