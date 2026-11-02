import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  classifyClinker,
  defaultView,
  limeLevel,
  pairActual,
  pairPredicted,
  zonePolygons,
} from '../lib/clinkerZones'
import type { TimestampRow } from '../lib/series'
import { HOUR_MS, MINUTE_MS } from '../lib/time'
import { fetchRcaFindings } from '../services/rcaService'
import type { ClinkerTargets } from '../services/rcaService'
import { fillingStats, kilnFilling, kilnOperationTrends, labTrends, rpmForFilling } from '../config/kilnTrends'
import { ADANI, JSW, raw } from './lines'

/** As INS_df1b3c1a11de returns them (result 6adee6b96ef9b41b70f92fa7). */
const T: ClinkerTargets = {
  c3s: 43,
  c3sBand: [41.5, 44.5],
  freeLime: 1.5,
  freeLimeBand: [1.2, 1.8],
  limeLevelK: 4.071,
  limeLevelFreeLimeRef: 1.5,
}

describe('clinker zones', () => {
  it('agrees with the insight on its own event (C3S 43.6, free lime 1.74 → lime level 44.6, Overlimed)', () => {
    expect(limeLevel(43.6, 1.74, T)).toBeCloseTo(44.58, 2)
    expect(classifyClinker(43.6, 1.74, T)).toBe('Overlimed')
  })

  it('splits the lime-level band by free lime', () => {
    expect(classifyClinker(43, 1.5, T)).toBe('Good clinker')
    expect(classifyClinker(42, 2.0, T)).toBe('Under burnt')
    // Lime level 44.54: past the band, so overlimed although free lime is high.
    expect(classifyClinker(42.5, 2.0, T)).toBe('Overlimed')
    expect(classifyClinker(44.5, 1.0, T)).toBe('Overburnt')
    expect(classifyClinker(39, 1.2, T)).toBe('Underlimed')
  })

  it('uses the view of the reference plots', () => {
    expect(defaultView(T)).toEqual({ x: [34, 46], y: [0, 3] })
  })

  it('draws the diagonals where the reference plot has them', () => {
    const polys = new Map(zonePolygons(T, defaultView(T)).map((p) => [p.zone, p.points]))
    expect([...polys.keys()]).toEqual(['Underlimed', 'Overburnt', 'Good clinker', 'Under burnt', 'Overlimed'])
    // Overlimed meets the top edge at C3S 38.39 and the right edge at free lime 1.13.
    const over = polys.get('Overlimed')!
    expect(over.some(([x, y]) => y === 3 && Math.abs(x - 38.39) < 0.01)).toBe(true)
    expect(over.some(([x, y]) => x === 46 && Math.abs(y - 1.13) < 0.01)).toBe(true)
    // Underlimed meets the top edge at C3S 35.39 and the right edge at free lime 0.39.
    const under = polys.get('Underlimed')!
    expect(under.some(([x, y]) => y === 3 && Math.abs(x - 35.39) < 0.01)).toBe(true)
    expect(under.some(([x, y]) => x === 46 && Math.abs(y - 0.39) < 0.01)).toBe(true)
    // Good clinker is a parallelogram between free lime 1.2 and 1.8.
    const good = polys.get('Good clinker')!
    expect(good).toHaveLength(4)
    expect(Math.min(...good.map(([, y]) => y))).toBeCloseTo(1.2)
    expect(Math.max(...good.map(([, y]) => y))).toBeCloseTo(1.8)
  })

  it('classifies every point of a polygon as that zone', () => {
    for (const { zone, points } of zonePolygons(T, defaultView(T))) {
      const cx = points.reduce((a, [x]) => a + x, 0) / points.length
      const cy = points.reduce((a, [, y]) => a + y, 0) / points.length
      expect(classifyClinker(cx, cy, T)).toBe(zone)
    }
  })
})

describe('pairing C3S with free lime', () => {
  const t0 = Date.parse('2026-08-18T00:00:00Z')
  const rows: TimestampRow[] = [
    { t: t0, values: { D44: 42.9, D43: 1.6 } },
    { t: t0 + 15 * MINUTE_MS, values: { D55: 42.0 } },
    { t: t0 + 2 * HOUR_MS, values: { D44: 43.2 } }, // no free lime for this sample
    { t: t0 + 2 * HOUR_MS + 5 * MINUTE_MS, values: { D43: 1.9 } }, // same sample, logged 5 min later
    { t: t0 + 3 * HOUR_MS, values: { D55: 42.4 } },
    { t: t0 + 7 * HOUR_MS, values: { D55: 41.0 } }, // last lab is 4 h 55 min old
  ]

  it('pairs a lab C3S with the free lime of the same sample', () => {
    expect(pairActual(rows, 'D44', 'D43').map((p) => [p.c3s, p.freeLime])).toEqual([
      [42.9, 1.6],
      [43.2, 1.9],
    ])
  })

  it('takes the nearest free lime within 30 minutes either side, and no further', () => {
    const at = (min: number, values: Record<string, number>): TimestampRow => ({ t: t0 + min * MINUTE_MS, values })
    const r = [
      at(0, { D43: 1.1 }), // 25 min before the first C3S
      at(25, { D58: 42 }),
      at(28, { D43: 1.3 }), // 3 min after it: nearer, so this one
      at(240, { D58: 43 }),
      at(262, { D43: 1.6 }), // 22 min after
      at(480, { D58: 44 }), // 40 min from either free lime: not the same sample
      at(440, { D43: 1.9 }),
      at(520, { D43: 2.0 }),
    ].sort((a, b) => a.t - b.t)
    expect(pairActual(r, 'D58', 'D43').map((p) => [p.c3s, p.freeLime])).toEqual([
      [42, 1.3],
      [43, 1.6],
    ])
  })

  it('pairs a year of two-hourly samples quickly', () => {
    const r: TimestampRow[] = []
    for (let i = 0; i < 4380; i++) {
      r.push({ t: t0 + i * 2 * HOUR_MS, values: { D58: 42 } }, { t: t0 + i * 2 * HOUR_MS + 17 * MINUTE_MS, values: { D43: 1.5 } })
    }
    const began = performance.now()
    expect(pairActual(r, 'D58', 'D43')).toHaveLength(4380)
    expect(performance.now() - began).toBeLessThan(500)
  })

  it('pairs a prediction with the last usable lab free lime, never a later one', () => {
    expect(pairPredicted(rows, 'D55', 'D43').map((p) => [p.c3s, p.freeLime])).toEqual([
      [42.0, 1.6],
      [42.4, 1.9],
    ])
  })
})

describe('insight targets', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the targets and the lime-level formula from a zone-format result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              data: [
                {
                  _id: 'z',
                  result: {
                    rca: {
                      zone: 'Overlimed',
                      c3s: 43.6,
                      fcao: 1.74,
                      targets: { c3s: 43, c3s_band: [41.5, 44.5], lime_level: 43, free_lime: 1.5, free_lime_band: [1.2, 1.8] },
                      lime_level_definition:
                        'lime level = C3S + 4.071 x (free lime - 1.5), the C3S the clinker would have at the target free lime',
                    },
                  },
                },
                { _id: 'old', result: { rca: { direction: 'low', c3s: 40 } } },
              ],
              totalCount: 2,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    const byId = new Map((await fetchRcaFindings()).findings.map((f) => [f.id, f]))
    expect(byId.get('z')?.targets).toEqual(T)
    expect(byId.get('z')?.freeLime).toBe(1.74)
    expect(byId.get('old')?.targets).toBeNull()
  })
})

describe('kiln-operation trends', () => {
  const TRENDS = kilnOperationTrends(ADANI)
  const FILL = ADANI.kilnFilling!
  const byKey = new Map(TRENDS.map((d) => [d.key, d]))

  it('lists the requested trends in order', () => {
    expect(TRENDS.map((d) => d.label)).toEqual([
      'Burning Zone Temp',
      'Secondary Air Temp',
      'Kiln filling degree',
      'TAD Temperature',
      'Kiln Inlet O2',
      'PC Coal',
      'Kiln Coal',
      'Kiln RPM',
      'Cooler fan flow (total)',
    ])
  })

  it('leaves PC Outlet Temp off Trend Analysis', () => {
    expect(TRENDS.some((d) => d.tags.includes(raw('D77')))).toBe(false)
    expect(ADANI.isTrendExcluded(raw('D77'))).toBe(true)
  })

  it('computes the filling degree with the plant formula, anchored on 448 t/h at 3.31 rpm = 22.56 %', () => {
    expect(kilnFilling(448, 3.31, FILL)).toBeCloseTo(22.56, 10)
    // Rises with feed, falls with speed.
    expect(kilnFilling(488, 4.2, FILL)).toBeCloseTo(22.56 * (488 / 448) * (3.31 / 4.2), 10)
    expect(kilnFilling(500, 3.31, FILL)! > kilnFilling(448, 3.31, FILL)!).toBe(true)
    expect(kilnFilling(448, 4, FILL)! < kilnFilling(448, 3.31, FILL)!).toBe(true)
    // A stopped kiln (rpm below 0.5) or a missing reading is skipped.
    expect([kilnFilling(448, 0.49, FILL), kilnFilling(448, null, FILL), kilnFilling(null, 3.31, FILL)]).toEqual([null, null, null])
    const fill = byKey.get('kiln-fill')!
    expect(fill.unit).toBe('%')
    const out = fill.series([
      { t: 1, values: { [raw('D74')]: 448, [raw('D73')]: 3.31 } },
      { t: 2, values: { [raw('D74')]: 448, [raw('D73')]: 0.2 } },
      { t: 3, values: { [raw('D74')]: 448 } },
    ])
    expect(out.map((p) => p.t)).toEqual([1])
    expect(out[0].v).toBeCloseTo(22.56, 10)
  })

  it('reports the median, the share above 18 % and the speed for 19 %', () => {
    const s = fillingStats([14, 15, 17, 19, 20].map((v, t) => ({ t, v })), FILL.flagAbove)
    expect(s.median).toBe(17)
    expect(s.abovePct).toBe(40) // 19 and 20 are above 18
    expect(rpmForFilling(3.31, 22.56, FILL.speedTarget)).toBeCloseTo((3.31 * 22.56) / 19, 10)
    expect(fillingStats([], FILL.flagAbove).median).toBeNull()
  })

  it('sums the cooler fans only where every one reports, leaving out the dropped fan 8', () => {
    const flow = byKey.get('cooler-flow')!
    expect(flow.tags).not.toContain(raw('D53'))
    expect(flow.tags).toHaveLength(12)
    const all = Object.fromEntries(flow.tags.map((t) => [t, 10]))
    const { [raw('D9')]: _, ...missingOne } = all
    expect(flow.series([{ t: 1, values: all }, { t: 2, values: missingOne }])).toEqual([{ t: 1, v: 120 }])
  })

  it('charts the process tags a line lists, else its kiln-operation roles: JSW lists its five DCS tags', () => {
    expect(kilnOperationTrends(JSW).map((d) => [d.label, d.tags[0]])).toEqual([
      ['Kiln feed', 'ABBBHPH_A1:D63'],
      ['Kiln coal', 'ABBKLN_A1:D154'],
      ['PC coal', 'ABBKLN_A1:D155'],
      ['Low-NOx coal', 'ABBKLN_A1:D156'],
      ['Solid AFR', 'ABBKLNAFRSGC_A1:D2'],
    ])
  })

  it('charts laboratory parameters: the line\'s list, else the mapped lab roles', () => {
    expect(labTrends(JSW).map((d) => d.key).slice(0, 4)).toEqual(['FLSCLINKER:D18', 'JSW_C3S:D7', 'FLSCLINKER:D24', 'FLSCLINKER:D19'])
    expect(labTrends(JSW)).toHaveLength(20)
    expect(labTrends(JSW).map((d) => d.key)).toContain('JSWCALN_A1:D0')
    // Adani lists none, so its mapped lab roles are charted, hidden tags never.
    expect(labTrends(ADANI).map((d) => d.key)).toEqual([
      raw('D58').replace('ADANI_RAW', 'ADANI_LAB'),
      'ADANI_LAB:D55',
      'ADANI_LAB:D43',
      'ADANI_LAB:D23',
      'ADANI_LAB:D24',
      'ADANI_LAB:D25',
      'ADANI_LAB:D38',
      'ADANI_LAB:D47',
      'ADANI_LAB:D48',
    ])
  })
})
