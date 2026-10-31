import { describe, expect, it } from 'vitest'
import { INTERVAL_COUNT, INTERVAL_MS, buildTimeline, timelineEnd } from '../lib/timeline'
import { findingActions, needsShcOptimizer, parseAction } from '../lib/recommendations'
import { causeStatus, highsAndLows, itemSubject } from '../lib/rcaHighlights'
import { relevantParameters } from '../config/rcaParameters'
import { PLANTS, resolveLine } from '../config/plants'
import { HOUR_MS, MINUTE_MS } from '../lib/time'
import type { ClinkerTargets, RcaFinding } from '../services/rcaService'
import { ADANI } from './lines'

const T: ClinkerTargets = {
  c3s: 43,
  c3sBand: [41.5, 44.5],
  freeLime: 1.5,
  freeLimeBand: [1.2, 1.8],
  limeLevelK: 4.071,
  limeLevelFreeLimeRef: 1.5,
}

function finding(over: Partial<RcaFinding>): RcaFinding {
  return {
    id: 'f',
    eventTime: null,
    eventTimeRaw: null,
    batchEnd: null,
    c3s: null,
    direction: null,
    zone: null,
    c3sGap: null,
    primaryCause: null,
    confirmedCause: null,
    rootCauses: [],
    recommendations: [],
    outcomes: [],
    why: [],
    actions: [],
    expected: [],
    notes: [],
    asOf: null,
    tags: [],
    invocationTime: null,
    freeLime: null,
    targets: null,
    ...over,
  }
}

describe('48-hour timeline', () => {
  const end = timelineEnd(Date.parse('2026-08-28T06:45:00Z'))
  const start = end - 48 * HOUR_MS

  it('has 192 intervals of 15 minutes ending on a quarter-hour', () => {
    const iv = buildTimeline({ end, predictions: [], freeLime: [], findings: [], targets: T })
    expect(iv).toHaveLength(INTERVAL_COUNT)
    expect(INTERVAL_COUNT).toBe(192)
    expect(iv[0].start).toBe(start)
    expect(iv[191].end).toBe(end)
    expect(end % INTERVAL_MS).toBe(0)
    // No prediction is never presented as a classification.
    expect(iv.every((x) => x.zone === 'Not classified' && x.source === 'none')).toBe(true)
  })

  it('prefers the insight zone, then classifies a prediction, then says undetermined', () => {
    const t = (i: number) => start + i * INTERVAL_MS + 5 * MINUTE_MS
    const iv = buildTimeline({
      end,
      predictions: [
        { t: t(10), v: 43.0 }, // good with free lime 1.5
        { t: t(11), v: 44.4 }, // lime level 45.0 → overlimed
        { t: t(12), v: 43.0 }, // has an RCA event saying Under burnt
        { t: t(40), v: 43.0 }, // free lime 5 h old → undetermined
      ],
      freeLime: [{ t: t(9), v: 1.6 }],
      findings: [finding({ id: 'e', eventTime: t(12), zone: 'Under burnt', c3s: 43 })],
      targets: T,
    })
    expect([iv[10].zone, iv[10].source]).toEqual(['Good clinker', 'computed'])
    expect(iv[11].zone).toBe('Overlimed')
    expect([iv[12].zone, iv[12].source, iv[12].event?.id]).toEqual(['Under burnt', 'insight', 'e'])
    // Unclassifiable: drawn as Not classified (Undetermined is not shown), with the reason kept.
    expect([iv[40].zone, iv[40].source]).toEqual(['Not classified', 'unclassified'])
    expect(iv[40].reason).toMatch(/No laboratory free lime/)
  })

  it('cannot classify without targets', () => {
    const iv = buildTimeline({ end, predictions: [{ t: start + 1, v: 43 }], freeLime: [{ t: start, v: 1.5 }], findings: [], targets: null })
    expect(iv[0].zone).toBe('Not classified')
  })
})

describe('recommendations', () => {
  it('reads the verb form with limits', () => {
    const a = parseAction('Kiln coal', 'Reduce Kiln coal from 31.0 to 28.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h.')
    expect(a).toMatchObject({ parameter: 'Kiln coal', from: 31, to: 28.6, unit: 't/h', change: '-2.3 t/h', lo: 21.8, hi: 25.2, hold: false })
  })

  it('reads the raw-mix form, and adds the moves only the action list carries', () => {
    const f = finding({
      recommendations: [{ label: 'Raw mix', text: 'Bauxite 0.9% to 1.1% (+1.0 t/h).' }],
      actions: ['Raw mix: Limestone 96.7% to 96.5% (-1.0 t/h)', 'Raw mix: Bauxite 0.9% to 1.1% (+1.0 t/h)'],
    })
    const acts = findingActions(f)
    expect(acts.map((a) => [a.parameter, a.from, a.to, a.unit])).toEqual([
      ['Raw mix · Bauxite', 0.9, 1.1, '%'],
      ['Raw mix · Limestone', 96.7, 96.5, '%'],
    ])
  })

  it('does not repeat a keyed recommendation that the one-line list restates without its label', () => {
    // As the live insight returned it: the `do` line is the "Action" text, and it has a colon
    // mid-sentence ("SHC optimizer: go to …") that is not a label.
    const text =
      'Do not change LSF yet. Compare actual vs expected clinker ash using fuel quality, AFR ash and fuel consumption. Coal rate per t clinker is the main ash driver. SHC optimizer: go to the kiln SHC optimizer. SHC now 852 kcal/kg vs target 703, reduce by 149.'
    const acts = findingActions(finding({ recommendations: [{ label: 'Action', text }], actions: [text] }))
    expect(acts).toHaveLength(1)
    expect(acts[0].parameter).toBe('Action')
    // Nor with the label restated in front.
    expect(findingActions(finding({ recommendations: [{ label: 'Action', text }], actions: [`Action: ${text}`] }))).toHaveLength(1)
  })

  it('still adds a different short action alongside a short keyed one', () => {
    const acts = findingActions(
      finding({
        recommendations: [{ label: 'Set point 1', text: 'No set-point change.' }],
        actions: ['Set point 1: No set-point change.', 'Raw mix: no change advised for bauxite'],
      }),
    )
    expect(acts).toHaveLength(2)
  })

  it('keeps the limits of a keyed recommendation over its one-line twin', () => {
    const acts = findingActions(
      finding({
        recommendations: [{ label: 'Kiln coal', text: 'Reduce Kiln coal from 27.9 to 25.7 t/h (-2.2 t/h), limits 23.3 to 24.7 t/h.' }],
        actions: ['Kiln coal: 27.9 to 25.7 t/h (-2.2)', 'Kiln feed: 481.3 to 486.1 t/h (+4.8)'],
      }),
    )
    expect(acts.map((a) => [a.parameter, a.from, a.to, a.lo, a.hi])).toEqual([
      ['Kiln coal', 27.9, 25.7, 23.3, 24.7],
      ['Kiln feed', 481.3, 486.1, null, null],
    ])
  })

  it('treats "No set-point change." as a hold, with no numbers', () => {
    const a = parseAction('Set point 1', 'No set-point change.')
    expect(a.hold).toBe(true)
    expect(a.from).toBeNull()
    expect(a.parameter).toBe('')
  })
})

describe('the live insight format (numbered labels)', () => {
  // As shown for the 25 Aug 15:17 event.
  const live = finding({
    zone: 'Under burnt',
    primaryCause: 'Secondary air temperature',
    rootCauses: [
      { label: 'Problem', text: 'Under burnt: free lime 2.18 % (band 1.2 to 1.8 %), C3S 40.4 % (band 41.5 to 44.5 %).', severity: null },
      { label: 'Cause 1', text: 'Root cause not confirmed from the available data. Further validation is required before recommending corrective action.', severity: null },
      { label: 'Watch 1', text: 'Secondary air temperature low: 1052 degC, normal 1087 degC.', severity: 'watch' },
    ],
    recommendations: [{ label: 'Set point 1', text: 'No set-point change.' }],
  })

  it('takes the parameter from the text when the label is only a number', () => {
    expect(itemSubject(live.rootCauses[2])).toBe('Secondary air temperature low')
    expect(highsAndLows(live)).toEqual([{ name: 'Secondary air temperature', dir: 'low', severity: 'watch' }])
    // A clause is not a parameter.
    const clause = { ...live, rootCauses: [{ label: 'Watch 2', text: 'Heat is already high: SHC 741 against normal 709.', severity: 'watch' as const }] }
    expect(highsAndLows(clause)).toEqual([])
  })

  it('maps the named parameter to its process tag', () => {
    const p = relevantParameters(live, ADANI).process.map((x) => x.sensorId)
    expect(p).toContain('D117') // Secondary Air Temp
    expect(p).toContain('D0') // Under burnt → burning zone
  })

  it('never reports an unconfirmed cause as confirmed', () => {
    expect(causeStatus(live).confirmed).toBe(false)
    expect(causeStatus({ ...live, confirmedCause: true }).confirmed).toBe(true)
    expect(causeStatus({ ...live, confirmedCause: false, rootCauses: [{ label: 'x', text: 'y (cause)', severity: 'cause' }] }).confirmed).toBe(false)
  })
})

describe('plants and lines', () => {
  it('resolves a selection, falling back to the first configured line (JSW)', () => {
    expect(resolveLine(null).line.id).toBe(PLANTS[0].lines[0].id)
    expect(resolveLine(null).plant.id).toBe('jsw')
    expect(resolveLine({ plantId: 'nope', lineId: 'nope' }).line.insightId).toBe('INS_c3snandyalrca')
    expect(resolveLine({ plantId: 'adani', lineId: 'line1' }).line.insightId).toBe('INS_df1b3c1a11de')
  })
})

describe('SHC Optimizer hand-off', () => {
  const LIVE =
    'Do not change LSF yet. Compare actual vs expected clinker ash using fuel quality, AFR ash and fuel consumption. Coal rate per t clinker is the main ash driver. SHC optimizer: go to the kiln SHC optimizer. SHC now 852 kcal/kg vs target 703, reduce by 149.'

  it('is offered on an action the insight sends to the SHC optimizer', () => {
    expect(parseAction('Action', LIVE).shcOptimizer).toBe(true)
    expect(needsShcOptimizer('Optimise the kiln SHC before changing fuel.')).toBe(true)
    expect(needsShcOptimizer('Specific heat consumption optimisation needed.')).toBe(true)
    expect(needsShcOptimizer('SHC optimizer', 'go to it')).toBe(true)
  })

  it('is not offered on an action that only quotes an SHC figure, or names something else', () => {
    expect(parseAction('Fuel and feed', 'TSR 12.6% to 13.5%, SHC 747 to 712 kcal/kg.').shcOptimizer).toBe(false)
    expect(parseAction('Kiln coal', 'Reduce Kiln coal from 31.0 to 28.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h.').shcOptimizer).toBe(false)
    expect(needsShcOptimizer('Raw mix optimiser: Bauxite 0.9% to 1.1%.')).toBe(false)
    expect(needsShcOptimizer('SHC high: 786 kcal/kg against target 773 kcal/kg (watch)')).toBe(false)
  })

  it('stays on that one action when a finding has several', () => {
    const acts = findingActions(
      finding({
        recommendations: [
          { label: 'Raw mix', text: 'Bauxite 0.9% to 1.1% (+1.0 t/h).' },
          { label: 'Action', text: LIVE },
        ],
        actions: [],
      }),
    )
    expect(acts.map((a) => [a.parameter, a.shcOptimizer])).toEqual([
      ['Raw mix · Bauxite', false],
      ['Action', true],
    ])
  })
})
