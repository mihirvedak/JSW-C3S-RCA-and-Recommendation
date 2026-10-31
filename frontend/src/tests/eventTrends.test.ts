import { describe, expect, it } from 'vitest'
import { relevantParameters } from '../config/rcaParameters'
import { LAB_TAGS, RAW_TAGS } from '../config/tagMaps'
import { contextWindow, lastSamples, spliceRows, trendWindow, valueAt } from '../lib/eventTrends'
import type { TimestampRow } from '../lib/series'
import { HOUR_MS, MINUTE_MS } from '../lib/time'
import type { RcaFinding } from '../services/rcaService'

function finding(over: Partial<RcaFinding>): RcaFinding {
  return {
    id: 'f',
    eventTime: 0,
    eventTimeRaw: null,
    batchEnd: null,
    c3s: null,
    direction: null,
    zone: null,
    c3sGap: null,
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
    freeLime: null,
    targets: null,
    confirmedCause: null,
    ...over,
  }
}

const cause = (label: string, text = '') => ({ label, text, severity: null })
const names = (ps: Array<{ devID: string; sensorId: string }>) =>
  ps.map((p) => (p.devID === 'ADANI_RAW' ? RAW_TAGS[p.sensorId]?.label : LAB_TAGS[p.sensorId]?.label ?? p.sensorId))

describe('relevantParameters', () => {
  // Labels as INS_df1b3c1a11de returned them for result 6adee6b96ef9b41b70f92fa7 (zone format).
  const overlimed = finding({
    zone: 'Overlimed',
    rootCauses: [
      cause('Overlimed'),
      cause('Kiln feed LSF high'),
      cause('TSR low'),
      cause('Kiln coal high'),
      cause('PC coal low'),
      cause('Solid AFR low'),
      cause('Kiln share of coal high'),
      cause('Coal per t clinker low'),
      cause('Fuel ash high'),
      cause('Note 9'),
      cause('Cause not confirmed'),
      cause('Ash fed'),
    ],
    recommendations: [{ label: 'Raw mix', text: 'Bauxite 0.9% to 1.1% (+1.0 t/h).' }],
  })

  it('maps the zone format to the process tags it names, by tag-map name', () => {
    expect(names(relevantParameters(overlimed).process)).toEqual([
      'Solid AFR',
      'Kiln Coal',
      'PC Coal',
      'Kiln feed',
    ])
  })

  it('leads the lab list with predicted then actual C3S, and adds the lab quantities named', () => {
    expect(names(relevantParameters(overlimed).lab)).toEqual([
      'D55',
      'D58',
      'Clinker Free CaO',
      'Kiln feed LSF',
      'Coal Ash',
      'AFR Ash (furnace)',
      'Raw mix LSF',
      'Raw mix SM',
      'Raw mix AM',
    ])
  })

  it('records why each tag is shown', () => {
    const kilnCoal = relevantParameters(overlimed).process.find((p) => p.sensorId === 'D66')
    expect(kilnCoal?.sources).toEqual([
      'Root cause: TSR low',
      'Root cause: Kiln coal high',
      'Root cause: Kiln share of coal high',
      'Root cause: Coal per t clinker low',
      'Root cause: Fuel ash high',
      'Root cause: Ash fed',
    ])
  })

  it('reads "Kiln feed LSF" as the lab LSF, not the kiln feed rate', () => {
    const p = relevantParameters(finding({ rootCauses: [cause('Kiln feed LSF')] }))
    expect(p.process).toEqual([])
    expect(names(p.lab)).toContain('Kiln feed LSF')
  })

  it('ignores a recommendation that advises no change', () => {
    const p = relevantParameters(
      finding({ recommendations: [{ label: 'Raw mix', text: 'No proportions advised (material balance does not close).' }] }),
    )
    expect(p.lab.map((x) => x.sensorId)).toEqual(['D55', 'D58'])
  })

  it('maps an unburnt zone to burning-zone temperature and free lime', () => {
    const p = relevantParameters(finding({ zone: 'Unburnt' }))
    expect(names(p.process)).toEqual(['Burning Zone Temp'])
    expect(names(p.lab)).toContain('Clinker Free CaO')
  })
})

describe('event windows and samples', () => {
  const t = Date.parse('2026-05-15T19:23:00Z')

  it('spans 1 h before to 30 min after the event', () => {
    expect(trendWindow(t)).toEqual({ start: t - HOUR_MS, end: t + 30 * MINUTE_MS })
  })

  const rows: TimestampRow[] = [
    { t: t - 9 * HOUR_MS, values: { D58: 41 } },
    { t: t - 7 * HOUR_MS, values: { D58: 42 } },
    { t: t - 5 * HOUR_MS, values: { D58: 43, D23: 105 } },
    { t: t - 3 * HOUR_MS, values: { D58: 44 } },
    { t, values: { D58: 45 } },
    { t: t + 10 * MINUTE_MS, values: { D58: 99 } },
  ]

  it('takes the last four samples at or before the event, newest first', () => {
    expect(lastSamples(rows, 'D58', t).map((p) => p.v)).toEqual([45, 44, 43, 42])
  })

  it('returns fewer when fewer exist, never padding', () => {
    expect(lastSamples(rows, 'D23', t).map((p) => p.v)).toEqual([105])
  })

  it('reads the value at the event only from a recent reading', () => {
    const pts = [
      { t: t - 2 * MINUTE_MS, v: 1 },
      { t: t + MINUTE_MS, v: 2 },
    ]
    expect(valueAt(pts, t)?.v).toBe(1)
    expect(valueAt([{ t: t - 20 * MINUTE_MS, v: 1 }], t)).toBeNull()
  })
})

describe('range rows with the event window spliced in', () => {
  const t0 = Date.parse('2026-08-27T00:00:00Z')
  const row = (min: number, v: number): TimestampRow => ({ t: t0 + min * MINUTE_MS, values: { D0: v } })

  it('keeps the thinned range outside the window and every minute reading inside it, oldest first', () => {
    // Range: one reading per 5 minutes, newest first as the platform returns them.
    const range = [row(120, 9), row(115, 9), row(65, 1), row(60, 1), row(5, 0), row(0, 0)]
    const detail = [row(60, 2), row(61, 2), row(62, 2)]
    const w = { start: t0 + 58 * MINUTE_MS, end: t0 + 66 * MINUTE_MS }
    expect(spliceRows(range, detail, w).map((r) => [(r.t - t0) / MINUTE_MS, r.values.D0])).toEqual([
      [0, 0],
      [5, 0],
      [60, 2],
      [61, 2],
      [62, 2],
      [115, 9],
      [120, 9],
    ])
  })

  it('leaves the range as it is until the event data arrives', () => {
    const range = [row(5, 1), row(0, 0)]
    expect(spliceRows(range, [], { start: t0, end: t0 + HOUR_MS }).map((r) => r.values.D0)).toEqual([0, 1])
  })
})

describe('the part of a long range charted around an older event', () => {
  const DAY = 24 * HOUR_MS
  const range = { start: Date.parse('2025-09-01T00:00:00Z'), end: Date.parse('2026-08-27T21:30:00Z') }

  it('is 7 days centred on the event', () => {
    const ev = Date.parse('2026-07-13T19:00:00Z')
    expect(contextWindow(ev, range, 7 * DAY)).toEqual({ start: ev - 3.5 * DAY, end: ev + 3.5 * DAY })
  })

  it('slides to stay inside the range near either end', () => {
    expect(contextWindow(range.start + HOUR_MS, range, 7 * DAY)).toEqual({ start: range.start, end: range.start + 7 * DAY })
    expect(contextWindow(range.end - HOUR_MS, range, 7 * DAY)).toEqual({ start: range.end - 7 * DAY, end: range.end })
  })

  it('is the whole range when that is shorter', () => {
    const short = { start: range.end - 2 * DAY, end: range.end }
    expect(contextWindow(range.end - DAY, short, 7 * DAY)).toEqual(short)
  })
})
