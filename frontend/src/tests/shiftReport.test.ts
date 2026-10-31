import { describe, expect, it } from 'vitest'
import { buildShiftReport, parseRecommendation } from '../lib/shiftReport'
import type { TimestampRow } from '../lib/series'
import type { ShiftWindow } from '../lib/shifts'
import type { RcaFinding } from '../services/rcaService'

const ist = (s: string) => Date.parse(`${s}+05:30`)

/** Shift A, 06:00–14:00 plant time on 27 Aug 2026. */
const SHIFT: ShiftWindow = {
  id: 'A',
  start: ist('2026-08-27T06:00:00'),
  end: ist('2026-08-27T14:00:00'),
  day: { y: 2026, m: 8, d: 27 },
}

function finding(over: Partial<RcaFinding> & { id: string; time: string }): RcaFinding {
  const { time, ...rest } = over
  return {
    eventTime: ist(time),
    eventTimeRaw: time,
    batchEnd: null,
    c3s: 37.7,
    direction: 'low',
    c3sGap: -2.15,
    primaryCause: null,
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
    ...rest,
  } as RcaFinding
}

// Sentences as returned by INS_df1b3c1a11de.
const KILN_COAL = 'Reduce Kiln coal from 31.0 to 28.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h.'
const SOLID_AFR = 'Increase Solid AFR from 14.6 to 14.7 t/h (+0.1 t/h), limits 13.0 to 14.7 t/h.'

describe('parseRecommendation', () => {
  it('reads a reduction with its limits', () => {
    expect(parseRecommendation(KILN_COAL)).toEqual({
      direction: 'decrease',
      from: 31,
      to: 28.6,
      unit: 't/h',
      change: -2.3,
      lo: 21.8,
      hi: 25.2,
    })
  })

  it('reads an increase', () => {
    const p = parseRecommendation(SOLID_AFR)
    expect(p?.direction).toBe('increase')
    expect(p?.change).toBe(0.1)
    expect(p?.hi).toBe(14.7)
  })

  it('does not treat "no change" statements as actions', () => {
    expect(parseRecommendation('No set-point change advised.')).toBeNull()
    expect(
      parseRecommendation('No change advised (kiln feed 366 t/h is outside the K05 feed bins).'),
    ).toBeNull()
  })
})

describe('buildShiftReport', () => {
  const labRows: TimestampRow[] = [
    { t: ist('2026-08-27T05:30:00'), values: { D58: 50, D55: 50 } }, // before the shift
    { t: ist('2026-08-27T07:30:00'), values: { D58: 38.0, D55: 39.0 } },
    { t: ist('2026-08-27T09:30:00'), values: { D58: 40.0, D55: 39.5 } },
    { t: ist('2026-08-27T11:30:00'), values: { D58: 42.0, D55: 41.0 } },
    { t: ist('2026-08-27T14:00:00'), values: { D58: 60, D55: 60 } }, // exactly at the end: next shift
  ]
  const processRows: TimestampRow[] = [
    { t: ist('2026-08-27T05:00:00'), values: { D66: 99 } },
    { t: ist('2026-08-27T08:00:00'), values: { D66: 30, D118: 14 } },
    { t: ist('2026-08-27T12:00:00'), values: { D66: 32, D118: 15 } },
    { t: ist('2026-08-27T15:00:00'), values: { D66: 99 } },
  ]

  const e1 = finding({
    id: 'e1',
    time: '2026-08-27T08:10:00',
    c3sGap: -2.5,
    primaryCause: 'Fuel Ash Addition',
    rootCauses: [
      { label: 'Fuel ash', text: 'Fuel ash high: 6.15 against target 5.01 (cause)', severity: 'cause' },
      { label: 'SHC', text: 'SHC high: 786 kcal/kg against target 773 kcal/kg (watch)', severity: 'watch' },
    ],
    recommendations: [
      { label: 'Kiln coal', text: KILN_COAL },
      { label: 'Solid AFR', text: SOLID_AFR },
    ],
    notes: ['Air-side effects are not checked.'],
  })
  const e2 = finding({
    id: 'e2',
    time: '2026-08-27T10:00:00',
    direction: 'high',
    c3sGap: 1.2,
    rootCauses: [
      { label: 'SHC', text: 'SHC low: 756 kcal/kg against target 773 kcal/kg (watch)', severity: 'watch' },
      { label: 'Summary', text: 'No cause beyond the limits', severity: null },
    ],
    recommendations: [{ label: 'Kiln coal', text: 'Reduce Kiln coal from 30.0 to 28.0 t/h (-2.0 t/h), limits 21.8 to 25.2 t/h.' }],
    notes: ['Air-side effects are not checked.'],
  })
  const outside = finding({ id: 'out', time: '2026-08-27T15:00:00', recommendations: [{ label: 'Kiln coal', text: KILN_COAL }] })

  const report = buildShiftReport({
    shift: SHIFT,
    labRows,
    processRows,
    findings: [e2, outside, e1],
  })

  it('uses only samples and events inside the shift window', () => {
    expect(report.lab.n).toBe(3) // the 05:30 and exactly-14:00 samples are excluded
    expect(report.events.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(report.low).toBe(1)
    expect(report.high).toBe(1)
  })

  it('summarises actual C3S from D58 and predicted from D55, not swapped', () => {
    expect(report.lab.mean).toBeCloseTo(40, 6) // (38 + 40 + 42) / 3
    expect(report.lab.min).toBe(38)
    expect(report.lab.max).toBe(42)
    expect(report.lab.first).toBe(38)
    expect(report.lab.last).toBe(42)
    expect(report.lab.meanPredicted).toBeCloseTo((39 + 39.5 + 41) / 3, 6)
    // error = actual - predicted: (-1 + 0.5 + 1) / 3
    expect(report.lab.meanError).toBeCloseTo(0.5 / 3, 6)
    expect(report.lab.nMatched).toBe(3)
  })

  it('ranks the more significant event first', () => {
    // e1 names a primary cause and has the larger gap.
    expect(report.events[0].id).toBe('e1')
  })

  it('groups causes by label, keeps the strongest grading, and ignores the "Summary" line', () => {
    expect(report.causes.map((c) => [c.label, c.severity, c.count])).toEqual([
      ['Fuel ash', 'cause', 1],
      ['SHC', 'watch', 2],
    ])
    expect(report.causes.some((c) => c.label === 'Summary')).toBe(false)
  })

  it('counts how often each recommendation was made and orders by that', () => {
    const [first, second] = report.actions
    expect([first.label, first.direction, first.count]).toEqual(['Kiln coal', 'decrease', 2])
    expect(first.meanChange).toBeCloseTo(-2.15, 6)
    expect([second.label, second.direction, second.count]).toEqual(['Solid AFR', 'increase', 1])
  })

  it('attaches the insight\'s own evidence to a recommendation', () => {
    const kiln = report.actions[0]
    expect(kiln.examples).toHaveLength(2)
    expect(kiln.examples[0]).toMatchObject({ from: 31, to: 28.6, unit: 't/h', lo: 21.8, hi: 25.2 })
  })

  it('attaches the set point\'s process behaviour over the shift only', () => {
    const kiln = report.actions[0].process
    expect(kiln).toMatchObject({ sensorId: 'D66', label: 'Kiln Coal', unit: 't/h', n: 2, min: 30, max: 32 })
    expect(kiln?.mean).toBe(31) // the 05:00 and 15:00 readings are outside the shift
    expect(report.actions[1].process).toMatchObject({ sensorId: 'D118', label: 'Solid AFR', mean: 14.5 })
  })

  it('de-duplicates the insight\'s caveats', () => {
    expect(report.notes).toEqual(['Air-side effects are not checked.'])
  })

  it('says a repeated recommendation still needs validation', () => {
    expect(report.assessment.level).toBe('repeated')
    expect(report.assessment.message).toMatch(/2 of 2 analysed deviations/)
    expect(report.assessment.message).toMatch(/validate/i)
  })
})

describe('buildShiftReport — thin evidence', () => {
  const lab: TimestampRow[] = [{ t: ist('2026-08-27T08:00:00'), values: { D58: 39, D55: 39 } }]

  it('makes no recommendation when the insight analysed nothing in the shift', () => {
    const r = buildShiftReport({ shift: SHIFT, labRows: lab, processRows: [], findings: [] })
    expect(r.assessment.level).toBe('none')
    expect(r.actions).toEqual([])
    expect(r.assessment.message).toMatch(/no recommendation/i)
    expect(r.assessment.message).toMatch(/further validation/i) // only one lab sample
  })

  it('reports a single-event recommendation as needing further validation', () => {
    const r = buildShiftReport({
      shift: SHIFT,
      labRows: lab,
      processRows: [],
      findings: [
        finding({ id: 'only', time: '2026-08-27T09:00:00', recommendations: [{ label: 'Kiln coal', text: KILN_COAL }] }),
      ],
    })
    expect(r.assessment.level).toBe('limited')
    expect(r.assessment.message).toMatch(/single analysed deviation/)
    expect(r.assessment.message).toMatch(/further validation/i)
    expect(r.actions[0].process).toBeNull() // no process data: nothing is invented
  })

  it('keeps "no change advised" statements instead of dropping them', () => {
    const r = buildShiftReport({
      shift: SHIFT,
      labRows: lab,
      processRows: [],
      findings: [
        finding({
          id: 'hold',
          time: '2026-08-27T09:00:00',
          recommendations: [{ label: 'Set points', text: 'No set-point change advised.' }],
        }),
      ],
    })
    expect(r.actions).toEqual([])
    expect(r.holds).toEqual(['No set-point change advised.'])
    expect(r.assessment.message).toMatch(/advised no set-point change/)
  })

  it('reports an empty shift with no lab data without inventing values', () => {
    const r = buildShiftReport({ shift: SHIFT, labRows: [], processRows: [], findings: [] })
    expect(r.lab).toMatchObject({ n: 0, mean: null, min: null, max: null, meanError: null })
    expect(r.assessment.message).toMatch(/No laboratory C3S samples were recorded/)
    expect(r.assessment.message).not.toMatch(/Only 0/)
  })
})

describe('buildShiftReport — events as the insight lists them', () => {
  it('counts an event the insight analysed again once, keeping the newest result', () => {
    const r = buildShiftReport({
      shift: SHIFT,
      labRows: [],
      processRows: [],
      findings: [
        finding({ id: 'old', time: '2026-08-27T08:00:00', invocationTime: 1 }),
        finding({ id: 'rerun', time: '2026-08-27T08:00:00', invocationTime: 2 }),
        finding({ id: 'other', time: '2026-08-27T10:00:00' }),
      ],
    })
    expect(r.events.map((f) => f.id).sort()).toEqual(['other', 'rerun'])
  })

  it('keeps numbered causes apart by their text, and merges the same text across events', () => {
    const recovery = 'Cooler Recovery is low: 820 degC against comparable 882 degC.'
    const r = buildShiftReport({
      shift: SHIFT,
      labRows: [],
      processRows: [],
      findings: [
        finding({ id: 'a', time: '2026-08-27T08:00:00', rootCauses: [{ label: 'Cause 1', text: recovery, severity: 'cause' }] }),
        finding({
          id: 'b',
          time: '2026-08-27T10:00:00',
          rootCauses: [
            { label: 'Cause 2', text: recovery, severity: 'cause' },
            { label: 'Cause 1', text: 'TSR is high: 11.7% against comparable 9.9%.', severity: 'cause' },
          ],
        }),
      ],
    })
    expect(r.causes.map((c) => [c.label, c.count, c.example])).toEqual([
      ['Cause', 2, recovery],
      ['Cause', 1, 'TSR is high: 11.7% against comparable 9.9%.'],
    ])
  })
})
