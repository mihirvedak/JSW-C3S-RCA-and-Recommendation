import { describe, expect, it } from 'vitest'
import { binCompliance, binLimit, binOf } from '../lib/binCompliance'
import { specRows } from '../config/specLimits'
import { buildLine } from '../config/lineModel'
import type { TimestampRow } from '../lib/series'
import { ADANI, JSW, lab, raw } from './lines'

const SPEC = ADANI.binLimits!
const D66 = raw('D66')
const D74 = raw('D74')

describe('the plant limit table', () => {
  it('maps every reported parameter to an ADANI_RAW tag by name', () => {
    const tags = new Map(SPEC.parameters.map((p) => [p.name, p.ref.sensorId]))
    expect(tags.size).toBe(21)
    expect(tags.get('Burning Zone Temp')).toBe('D0')
    expect(tags.get('Kiln Coal')).toBe('D66')
    expect(tags.get('Kiln feed')).toBe('D74')
    expect(tags.get('Cooler Fan 9 Flow')).toBe('D57')
    expect(SPEC.parameters.every((p) => p.ref.devID === 'ADANI_RAW')).toBe(true)
    expect(ADANI.role(SPEC.binRole)).toBe(D74)
  })

  it('holds the file’s figures', () => {
    expect(binLimit(SPEC, '370440', 'Kiln Coal')).toEqual({ lsl: 20.981, usl: 22.248, target: 21.572, status: 'USABLE' })
    expect(binLimit(SPEC, '520565', 'PC Coal')?.lsl).toBe(27.007)
    expect(binLimit(SPEC, '480500', 'Kiln RPM')?.status).toBe('DROP')
    // PC Outlet Temp has a limit in one bin only, and no fan 8 flow anywhere.
    expect(['370440', '440460', '460480', '480500', '500520', '520565'].filter((b) => binLimit(SPEC, b, 'PC Outlet Temp'))).toEqual(['440460'])
    expect(binLimit(SPEC, '440460', 'Cooler Fan 8 Flow')).toBeNull()
  })

  it('bins kiln feed on the file’s edges', () => {
    expect(binOf(SPEC.bins, 369.9)).toBeNull()
    expect(binOf(SPEC.bins, 370)?.id).toBe('370440')
    expect(binOf(SPEC.bins, 440)?.id).toBe('440460')
    expect(binOf(SPEC.bins, 565)?.id).toBe('520565')
    expect(binOf(SPEC.bins, 565.1)).toBeNull()
  })

  it('is absent for a plant that has not supplied one', () => {
    expect(JSW.binLimits).toBeNull()
  })
})

describe('time in range, bin by bin', () => {
  const row = (t: number, feed: number | undefined, coal: number): TimestampRow => ({
    t,
    values: feed == null ? { [D66]: coal } : { [D74]: feed, [D66]: coal },
  })
  // 370–440 bin: kiln coal 20.981–22.248. 520–565 bin: 24.593–26.521.
  const rows = [
    row(1, 420, 21.5), // in range, bin 370–440
    row(2, 420, 23.0), // out, bin 370–440
    row(3, 530, 25.0), // in range, bin 520–565
    row(4, 530, 25.0), // in range, bin 520–565
    row(5, 300, 21.5), // feed below 370: not judged
    row(6, undefined, 21.5), // no feed reading: not judged
  ]

  it('judges each reading against the limits of the bin its feed was in', () => {
    const r = binCompliance(rows, SPEC, 'Kiln Coal', D66, D74)
    const cell = (id: string) => r.bins.find((c) => c.binId === id)!
    expect([cell('370440').judged, cell('370440').inRange, cell('370440').pct]).toEqual([2, 1, 50])
    expect([cell('520565').judged, cell('520565').pct]).toEqual([2, 100])
    expect([r.judged, r.inRange, r.pct, r.notJudged, r.n]).toEqual([4, 3, 75, 2, 6])
    expect(r.status).toBe('good') // 75 % ≥ 68 %
  })

  it('does not judge a bin without a limit, and says so rather than "no readings"', () => {
    const r = binCompliance([{ t: 1, values: { [D74]: 420, [raw('D77')]: 52 } }], SPEC, 'PC Outlet Temp', raw('D77'), D74)
    expect([r.judged, r.notJudged, r.status]).toEqual([0, 1, 'unjudged'])
  })

  it('flags readings in different units instead of reporting 0 %', () => {
    // Cooler fan 1 flow limits are ~190; readings of ~20 (m3/sec?) are 10× away from every target.
    const r = binCompliance([{ t: 1, values: { [D74]: 420, [raw('D9')]: 20 } }], SPEC, 'Cooler Fan 1 Flow', raw('D9'), D74)
    expect(r.status).toBe('units')
  })

  it('splits the judged readings into below, within and above, summed over the bins', () => {
    const r = binCompliance(rows, SPEC, 'Kiln Coal', D66, D74)
    // 23.0 t/h in the 370–440 bin is above its USL 22.248; nothing is below.
    expect([r.below, r.inRange, r.above]).toEqual([0, 3, 1])
    expect([r.belowPct, r.pct, r.abovePct]).toEqual([0, 75, 25])
  })
})

describe('laboratory specification limits', () => {
  const T = { c3s: 43, c3sBand: [41.5, 44.5] as [number, number], freeLime: 1.5, freeLimeBand: [1.2, 1.8] as [number, number], limeLevelK: 4.071, limeLevelFreeLimeRef: 1.5 }

  it('carries the plant’s limits, each ordered and with its basis', () => {
    const rows = specRows(ADANI, null)
    const byId = new Map(rows.map((r) => [r.key, r]))
    expect([byId.get(lab('D58'))?.lsl, byId.get(lab('D58'))?.usl, byId.get(lab('D58'))?.basis]).toEqual([41.5, 44.5, 'Plant: 43 ± 1.5'])
    expect([byId.get(lab('D43'))?.lsl, byId.get(lab('D43'))?.usl]).toEqual([1.2, 1.8])
    expect([byId.get(lab('D23'))?.lsl, byId.get(lab('D23'))?.usl]).toEqual([102.8, 106.6])
    for (const r of rows) {
      expect(r.lsl != null && r.usl != null && r.lsl < r.usl).toBe(true)
      expect(r.basis).toBeTruthy()
    }
    // Never the model's inferred D56 (the plant's warning), and never the clinker Bogue C3S.
    expect(rows.some((r) => [lab('D56'), lab('D44'), lab('D45')].includes(r.key))).toBe(false)
    // The plant's own limits win over the insight's bands.
    expect(specRows(ADANI, T).find((r) => r.key === lab('D58'))?.basis).toBe('Plant: 43 ± 1.5')
  })

  it('uses the JSW quality-table targets, one-sided where the plant states one limit', () => {
    const rows = specRows(JSW, T)
    const byKey = new Map(rows.map((r) => [r.key, r]))
    expect([byKey.get('FLSCLINKER:D18')?.lsl, byKey.get('FLSCLINKER:D18')?.usl]).toEqual([48, 52])
    expect([byKey.get('JSW_C3S:D7')?.lsl, byKey.get('JSW_C3S:D7')?.usl]).toEqual([48, 52])
    expect([byKey.get('FLSCLINKER:D24')?.lsl, byKey.get('FLSCLINKER:D24')?.usl]).toEqual([null, 1.5])
    expect([byKey.get('FLSKILNFEED:D6')?.lsl, byKey.get('FLSKILNFEED:D6')?.usl]).toEqual([98, 102])
    expect([byKey.get('FLSCALCINATION:D17')?.lsl, byKey.get('FLSCALCINATION:D17')?.usl]).toEqual([null, 980])
    // The plant's targets win over the insight's bands, and none falls back to them.
    expect(rows.some((r) => /RCA insight target band/.test(r.basis ?? ''))).toBe(false)
    for (const r of rows) expect(r.lsl == null || r.usl == null || r.lsl < r.usl).toBe(true)
  })

  it('falls back to the insight’s target bands for a line without any limits, and says so', () => {
    const bare = { ...JSW.spec, specLimits: [] }
    const line = buildLine(JSW.plant, bare)
    const rows = specRows(line, T)
    expect(rows.map((r) => [r.key, r.lsl, r.usl])).toEqual([
      ['FLSCLINKER:D18', 41.5, 44.5],
      ['JSW_C3S:D7', 41.5, 44.5],
      ['FLSCLINKER:D24', 1.2, 1.8],
    ])
    expect(rows.every((r) => /RCA insight target band/.test(r.basis ?? ''))).toBe(true)
    // Without targets the rows exist but classify nothing.
    expect(specRows(line, null).map((r) => [r.lsl, r.usl, r.basis])).toEqual([[null, null, null], [null, null, null], [null, null, null]])
  })
})
