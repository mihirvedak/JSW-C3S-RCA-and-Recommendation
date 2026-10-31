import { describe, expect, it } from 'vitest'
import { BIN_PARAMETERS, binLimit, binLimitTags, binOf } from '../config/binLimits'
import { binCompliance } from '../lib/binCompliance'
import type { TimestampRow } from '../lib/series'

describe('the plant limit table', () => {
  it('maps every reported parameter to an ADANI_RAW tag by name', () => {
    const tags = binLimitTags()
    expect(BIN_PARAMETERS.filter((p) => !tags.has(p))).toEqual([])
    expect(tags.get('Burning Zone Temp')).toBe('D0')
    expect(tags.get('Kiln Coal')).toBe('D66')
    expect(tags.get('Kiln feed')).toBe('D74')
    expect(tags.get('Cooler Fan 9 Flow')).toBe('D57')
  })

  it('holds the file’s figures', () => {
    expect(binLimit('370440', 'Kiln Coal')).toEqual({ lsl: 20.981, usl: 22.248, target: 21.572, status: 'USABLE' })
    expect(binLimit('520565', 'PC Coal')?.lsl).toBe(27.007)
    expect(binLimit('480500', 'Kiln RPM')?.status).toBe('DROP')
    // PC Outlet Temp has a limit in one bin only, and no fan 8 flow anywhere.
    expect(['370440', '440460', '460480', '480500', '500520', '520565'].filter((b) => binLimit(b, 'PC Outlet Temp'))).toEqual(['440460'])
    expect(binLimit('440460', 'Cooler Fan 8 Flow')).toBeNull()
  })

  it('bins kiln feed on the file’s edges', () => {
    expect(binOf(369.9)).toBeNull()
    expect(binOf(370)?.id).toBe('370440')
    expect(binOf(440)?.id).toBe('440460')
    expect(binOf(565)?.id).toBe('520565')
    expect(binOf(565.1)).toBeNull()
  })
})

describe('time in range, bin by bin', () => {
  const row = (t: number, feed: number | undefined, coal: number): TimestampRow => ({
    t,
    values: feed == null ? { D66: coal } : { D74: feed, D66: coal },
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
    const r = binCompliance(rows, 'Kiln Coal', 'D66')
    const cell = (id: string) => r.bins.find((c) => c.binId === id)!
    expect([cell('370440').judged, cell('370440').inRange, cell('370440').pct]).toEqual([2, 1, 50])
    expect([cell('520565').judged, cell('520565').pct]).toEqual([2, 100])
    expect([r.judged, r.inRange, r.pct, r.notJudged, r.n]).toEqual([4, 3, 75, 2, 6])
    expect(r.status).toBe('good') // 75 % ≥ 68 %
  })

  it('does not judge a bin without a limit, and says so rather than "no readings"', () => {
    const r = binCompliance([{ t: 1, values: { D74: 420, D77: 52 } }], 'PC Outlet Temp', 'D77')
    expect([r.judged, r.notJudged, r.status]).toEqual([0, 1, 'unjudged'])
  })

  it('flags readings in different units instead of reporting 0 %', () => {
    // Cooler fan 1 flow limits are ~190; readings of ~20 (m3/sec?) are 10× away from every target.
    const r = binCompliance([{ t: 1, values: { D74: 420, D9: 20 } }], 'Cooler Fan 1 Flow', 'D9')
    expect(r.status).toBe('units')
  })

  it('splits the judged readings into below, within and above, summed over the bins', () => {
    const r = binCompliance(rows, 'Kiln Coal', 'D66')
    // 23.0 t/h in the 370–440 bin is above its USL 22.248; nothing is below.
    expect([r.below, r.inRange, r.above]).toEqual([0, 3, 1])
    expect([r.belowPct, r.pct, r.abovePct]).toEqual([0, 75, 25])
  })
})

describe('laboratory specification limits', () => {
  it('carries the plant’s limits, each ordered and with its basis', async () => {
    const { SPEC_ROWS } = await import('../config/specLimits')
    const byId = new Map(SPEC_ROWS.map((r) => [r.sensorId, r]))
    expect([byId.get('D58')?.lsl, byId.get('D58')?.usl, byId.get('D58')?.basis]).toEqual([41.5, 44.5, 'Plant: 43 ± 1.5'])
    expect([byId.get('D43')?.lsl, byId.get('D43')?.usl]).toEqual([1.2, 1.8])
    expect([byId.get('D23')?.lsl, byId.get('D23')?.usl]).toEqual([102.8, 106.6])
    for (const r of SPEC_ROWS) {
      expect(r.lsl != null && r.usl != null && r.lsl < r.usl).toBe(true)
      expect(r.basis).toBeTruthy()
    }
    // Never the model's inferred D56 (the plant's warning), and never the clinker Bogue C3S.
    expect(SPEC_ROWS.some((r) => ['D56', 'D44', 'D45'].includes(r.sensorId))).toBe(false)
  })
})
