/**
 * Which plant tags an RCA finding is about.
 *
 * The insight names parameters in prose ("Kiln coal high", "TSR low", "Kiln feed LSF"),
 * never by tag. Each rule below ties one of those names to the ADANI_RAW / ADANI_LAB tags
 * that measure it, by the names in the supplied tag maps (`tagMaps.ts`). The first rule that
 * matches a label wins, so the more specific names come first ("Kiln feed LSF" is the lab
 * LSF, not the kiln feed rate).
 *
 * Derived quantities have no tag of their own. They map to the measured inputs they are
 * computed from: TSR and SHC to the fuel rates, fuel ash to the coal / AFR ash and fuel rates,
 * lime level to clinker C3S and free lime.
 */

import type { RcaFinding } from '../services/rcaService'
import { itemSubject } from '../lib/rcaHighlights'
import { ACTUAL_C3S, LAB_DEVICE, PREDICTED_C3S, PROCESS_DEVICE } from './deviceMappings'
import type { DeviceId } from './deviceMappings'

// ADANI_RAW
const BURNING_ZONE_TEMP = 'D0'
const KILN_COAL = 'D66'
const KILN_FEED = 'D74'
const PC_COAL = 'D75'
const SOLID_AFR = 'D118'
const COOLER_GRATE_SPEED = 'D59'
const KILN_INLET_O2 = 'D71'
const KILN_INLET_TEMP = 'D72'
const KILN_RPM = 'D73'
const PC_OUTLET_TEMP = 'D77'
const SECONDARY_AIR_TEMP = 'D117'
const TAD_TEMP = 'D122'

// ADANI_LAB
const RAW_MIX_LSF = 'D10'
const RAW_MIX_SM = 'D11'
const RAW_MIX_AM = 'D12'
const KILN_FEED_LSF = 'D23'
const CLINKER_FREE_CAO = 'D43'
const COAL_NCV = 'D46'
const COAL_ASH = 'D47'
const AFR_ASH = 'D48'
const AFR_NCV = 'D49'

interface Rule {
  match: RegExp
  process?: readonly string[]
  lab?: readonly string[]
}

const RULES: readonly Rule[] = [
  { match: /secondary air/i, process: [SECONDARY_AIR_TEMP] },
  { match: /tertiary air|\btad\b/i, process: [TAD_TEMP] },
  { match: /cooler grate/i, process: [COOLER_GRATE_SPEED] },
  { match: /kiln inlet o2|inlet oxygen/i, process: [KILN_INLET_O2] },
  { match: /kiln inlet temp/i, process: [KILN_INLET_TEMP] },
  { match: /kiln (rpm|speed)/i, process: [KILN_RPM] },
  { match: /pc outlet|precalciner|calciner (outlet )?temp/i, process: [PC_OUTLET_TEMP] },
  { match: /\blsf\b/i, lab: [KILN_FEED_LSF] },
  { match: /^raw mix/i, lab: [RAW_MIX_LSF, RAW_MIX_SM, RAW_MIX_AM] },
  { match: /free\s*(lime|cao)|\bfcao\b/i, lab: [CLINKER_FREE_CAO] },
  { match: /over\s*limed?|under\s*limed?|lime level/i, lab: [CLINKER_FREE_CAO, KILN_FEED_LSF] },
  {
    match: /unburnt|under\s*burnt|over\s*burnt|hard\s*burnt|burning/i,
    process: [BURNING_ZONE_TEMP],
    lab: [CLINKER_FREE_CAO],
  },
  { match: /kiln share of coal/i, process: [KILN_COAL, PC_COAL] },
  { match: /coal per t|coal rate/i, process: [KILN_COAL, PC_COAL, KILN_FEED] },
  { match: /kiln coal/i, process: [KILN_COAL] },
  { match: /\bpc coal|calciner coal/i, process: [PC_COAL] },
  { match: /\bafr\b/i, process: [SOLID_AFR] },
  { match: /\btsr\b/i, process: [SOLID_AFR, KILN_COAL, PC_COAL] },
  { match: /\bshc\b|specific heat/i, process: [KILN_COAL, PC_COAL, SOLID_AFR, KILN_FEED] },
  { match: /coal ash/i, lab: [COAL_ASH] },
  {
    match: /fuel ash|ash fed|ash addition/i,
    process: [KILN_COAL, PC_COAL, SOLID_AFR],
    lab: [COAL_ASH, AFR_ASH],
  },
  { match: /kiln feed/i, process: [KILN_FEED] },
  { match: /\bncv\b|calorific/i, lab: [COAL_NCV, AFR_NCV] },
]

/** A recommendation that advises nothing ("No proportions advised …") names no parameter. */
const NO_CHANGE = /^no\b.*\b(advised|change)\b/i

export interface RelevantParameter {
  devID: DeviceId
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
export function relevantParameters(f: RcaFinding): RelevantParameters {
  const found = new Map<string, RelevantParameter>()
  const add = (devID: DeviceId, sensorId: string, source: string) => {
    const key = `${devID}:${sensorId}`
    const cur = found.get(key)
    if (!cur) found.set(key, { devID, sensorId, sources: [source] })
    else if (!cur.sources.includes(source)) cur.sources.push(source)
  }

  add(LAB_DEVICE, PREDICTED_C3S, 'RCA trigger')
  add(LAB_DEVICE, ACTUAL_C3S, 'Lab check of the prediction')

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
    for (const id of rule.process ?? []) add(PROCESS_DEVICE, id, source)
    for (const id of rule.lab ?? []) add(LAB_DEVICE, id, source)
  }

  const all = [...found.values()]
  return {
    process: all.filter((p) => p.devID === PROCESS_DEVICE),
    lab: all.filter((p) => p.devID === LAB_DEVICE),
  }
}
