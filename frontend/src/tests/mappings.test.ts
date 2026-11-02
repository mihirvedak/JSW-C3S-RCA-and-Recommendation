/**
 * The line models: Adani's (built from its two tag maps) must carry exactly what the old
 * device registry carried; JSW's must resolve every role the brief supplies, on the right device,
 * and nothing it does not.
 */

import { describe, expect, it } from 'vitest'
import { buildLine, sensorKey, splitKey } from '../config/lineModel'
import { ALL_LINES } from '../config/plants'
import { REQUIRED_ROLES } from '../config/clients/types'
import type { LineSpec, PlantSpec } from '../config/clients/types'
import { ADANI, JSW, lab, raw } from './lines'

describe('Adani: C3S series mappings', () => {
  it('maps predicted C3S to ADANI_LAB:D55', () => {
    expect(ADANI.predictedC3S).toBe(lab('D55'))
    const s = ADANI.sensorByKey(ADANI.predictedC3S)
    expect(s?.name).toBe('Predicted C3S')
    expect(s?.verification).toBe('verified')
  })

  it('maps actual lab C3S to ADANI_LAB:D58 and free lime to D43', () => {
    expect(ADANI.actualC3S).toBe(lab('D58'))
    expect(ADANI.label(ADANI.actualC3S)).toBe('Actual C3S (Lab)')
    expect(ADANI.freeLime).toBe(lab('D43'))
  })

  it('keeps the clinker Bogue C3S values distinct, listed and hidden', () => {
    expect(ADANI.getSensor('ADANI_LAB', 'D44')?.name).toBe('Clinker C3S')
    expect(ADANI.getSensor('ADANI_LAB', 'D45')?.name).toBe('Clinker C3S (uncorrected)')
    expect(ADANI.isHidden(lab('D44'))).toBe(true)
    expect(ADANI.isHidden(lab('D45'))).toBe(true)
    expect(ADANI.isHidden(lab('D58'))).toBe(false)
    const clinker = ADANI.groups('lab').find((g) => g.id === 'clinker')!
    expect(clinker.sensors.some((s) => s.sensorId === 'D44' || s.sensorId === 'D45')).toBe(false)
  })
})

describe('device-scoped lookup', () => {
  it('resolves the same D-tag differently per device', () => {
    // The documented collision: D55 is predicted C3S on the lab device and
    // Cooler Fan 9 Amps on the process device.
    expect(ADANI.label(lab('D55'))).toBe('Predicted C3S')
    expect(ADANI.label(raw('D55'))).toBe('Cooler Fan 9 Amps')
    expect(ADANI.getSensor('ADANI_LAB', 'D55')).not.toBe(ADANI.getSensor('ADANI_RAW', 'D55'))
  })

  it('namespaces keys by device', () => {
    expect(sensorKey('ADANI_LAB', 'D55')).toBe('ADANI_LAB:D55')
    expect(splitKey('JSWBMBCLRMTR_KC:D18')).toEqual({ devID: 'JSWBMBCLRMTR_KC', sensorId: 'D18' })
  })

  it('returns undefined for an unknown pair rather than guessing, and describes it as unverified', () => {
    expect(ADANI.getSensor('ADANI_LAB', 'D999')).toBeUndefined()
    expect(ADANI.getSensor('SOME_OTHER_DEVICE', 'D55')).toBeUndefined()
    const d = ADANI.describe('ADANI_RAW:D999')
    expect([d.label, d.name, d.verification, d.kind]).toEqual(['D999', null, 'unverified', 'process'])
  })
})

describe('Adani: category bands D0–D51', () => {
  const expected: Array<[string, number, number, number]> = [
    ['raw_mix', 0, 12, 13],
    ['kiln_feed', 13, 25, 13],
    ['hot_meal_1', 26, 29, 4],
    ['hot_meal_2', 30, 33, 4],
    ['clinker', 34, 45, 12],
    ['coal', 46, 47, 2],
    ['afr', 48, 51, 4],
  ]
  const byGroup = (g: string) => ADANI.labSensors.filter((s) => s.group === g)

  it.each(expected)('%s covers D%d–D%d with %d sensors', (cat, from, to, count) => {
    const list = byGroup(cat)
    expect(list).toHaveLength(count)
    expect(list[0].sensorId).toBe(`D${from}`)
    expect(list[list.length - 1].sensorId).toBe(`D${to}`)
    for (const s of list) expect(s.devID).toBe('ADANI_LAB')
  })

  it('covers every tag from D0 to D58 exactly once', () => {
    const ids = ADANI.labSensors.map((s) => s.sensorId)
    expect(new Set(ids).size).toBe(ids.length)
    for (let i = 0; i <= 58; i++) expect(ids).toContain(`D${i}`)
    expect(ids).toHaveLength(59)
  })
})

describe('Adani: names come from the supplied tag maps', () => {
  it('names every ADANI_LAB tag the lab tag map covers (D0–D51), and only those plus D55/D58', () => {
    const verified = ADANI.labSensors.filter((s) => s.verification === 'verified').map((s) => s.sensorId)
    const want = [...Array.from({ length: 52 }, (_, i) => `D${i}`), 'D55', 'D58']
    expect([...verified].sort()).toEqual([...want].sort())
  })

  it('leaves the model outputs the lab tag map does not cover as category-only', () => {
    for (const id of ['D52', 'D53', 'D54', 'D56', 'D57']) {
      const s = ADANI.getSensor('ADANI_LAB', id)
      expect(s?.name).toBeNull()
      expect(s?.verification).toBe('category-only')
    }
  })

  it('names all 124 ADANI_RAW signals (D0–D123)', () => {
    const ps = ADANI.processSensors
    expect(ps).toHaveLength(124)
    expect(ps[0].sensorId).toBe('D0')
    expect(ps[123].sensorId).toBe('D123')
    expect(ps.every((s) => s.verification === 'verified' && s.name != null)).toBe(true)
  })

  it('spot-checks lab names against the lab tag map', () => {
    const cases: Array<[string, string, string | null]> = [
      ['D0', 'Raw mix SiO2', '%'],
      ['D10', 'Raw mix LSF', null],
      ['D12', 'Raw mix AM', null],
      ['D13', 'Kiln feed SiO2', '%'],
      ['D23', 'Kiln feed LSF', null],
      ['D26', 'Hot meal (stream 1) SO3', '%'],
      ['D33', 'Hot meal (stream 2) K2O', '%'],
      ['D34', 'Clinker SiO2', '%'],
      ['D43', 'Clinker Free CaO', '%'],
      ['D44', 'Clinker C3S', '%'],
      ['D45', 'Clinker C3S (uncorrected)', '%'],
      ['D46', 'Coal NCV', 'kcal/kg'],
      ['D47', 'Coal Ash', '%'],
      ['D48', 'AFR Ash (furnace)', '%'],
      ['D49', 'AFR NCV (net)', 'kcal/kg'],
      ['D50', 'AFR Total moisture', '%'],
      ['D51', 'AFR Cl (alternate method)', '%'],
    ]
    for (const [id, label, unit] of cases) {
      const s = ADANI.getSensor('ADANI_LAB', id)
      expect([id, s?.label, s?.unit]).toEqual([id, label, unit])
    }
  })

  it('spot-checks process names, units and sections against the process tag map', () => {
    const cases: Array<[string, string, string, string]> = [
      ['D0', 'Burning Zone Temp', '°C', 'kiln'],
      ['D1', 'Calciner CO Str1', 'ppm', 'calciner'],
      ['D7', 'Cooler Fan 1 Amps', 'A', 'cooler'],
      ['D55', 'Cooler Fan 9 Amps', 'A', 'cooler'],
      ['D59', 'Cooler Grate Speed', '1/min', 'cooler'],
      ['D66', 'Kiln Coal', 't/h', 'other'],
      ['D68', 'Kiln Hood Draft', 'mbar', 'cooler'],
      ['D74', 'Kiln feed', 't/h', 'other'],
      ['D76', 'PC Outlet Draft', 'mbar', 'calciner'],
      ['D78', 'PH Cy1A Draft', 'mbar', 'preheater'],
      ['D113', 'PH Fan Power', 'kw', 'preheater'],
      ['D117', 'Secondary Air Temp', '°C', 'cooler'],
      ['D118', 'Solid AFR', 't/h', 'other'],
      ['D123', 'Total Clinker Production_CF', 't', 'other'],
    ]
    for (const [id, label, unit, group] of cases) {
      const s = ADANI.getSensor('ADANI_RAW', id)!
      expect([id, s.label, s.unit, s.group]).toEqual([id, label, unit, group])
    }
  })

  it('has the section sizes the process tag map lists', () => {
    const count = (g: string) => ADANI.processSensors.filter((s) => s.group === g).length
    expect(count('preheater')).toBe(39)
    expect(count('calciner')).toBe(6)
    expect(count('kiln')).toBe(7)
    expect(count('cooler')).toBe(65)
    expect(count('other')).toBe(7)
  })

  it("carries the tag map's signal assessment as data", () => {
    const q = (id: string) => ADANI.getSensor('ADANI_RAW', id)!.quality
    expect(q('D0')).toBe('usable')
    expect(q('D1')).toBe('unreliable')
    expect(q('D16')).toBe('flag')
    expect(q('D5')).toBe('drop')
    expect(q('D77')).toBe('flag')
    expect(q('D115')).toBe('unreliable')
  })

  it('writes the degree sign as a degree sign, not the export artefact', () => {
    for (const s of ADANI.processSensors) expect(s.unit ?? '').not.toMatch(/[｡-ﾟ]/)
    expect(ADANI.getSensor('ADANI_RAW', 'D72')?.unit).toBe('°C')
  })

  it('resolves every kiln and chemistry role the old constants named', () => {
    expect(ADANI.role('kilnFeed')).toBe(raw('D74'))
    expect(ADANI.role('kilnCoal')).toBe(raw('D66'))
    expect(ADANI.role('pcCoal')).toBe(raw('D75'))
    expect(ADANI.role('solidAfr')).toBe(raw('D118'))
    expect(ADANI.role('kilnRpm')).toBe(raw('D73'))
    expect(ADANI.role('burningZoneTemp')).toBe(raw('D0'))
    expect(ADANI.role('kilnFeedLsf')).toBe(lab('D23'))
    expect(ADANI.role('coalAsh')).toBe(lab('D47'))
    expect(ADANI.role('afrNcv')).toBe(lab('D49'))
    expect(ADANI.role('lowNoxCoal')).toBeNull()
  })
})

describe('display labels', () => {
  it('never falls back to a bare sensor id for a listed sensor', () => {
    for (const line of ALL_LINES) {
      for (const s of line.allSensors) {
        expect(s.label).not.toBe(s.sensorId)
        expect(s.label).not.toMatch(/^D\d+$/)
      }
    }
  })

  it('builds a label from group and position only where no name was supplied', () => {
    // Numbered among the group's unnamed tags, in the order the spec lists them.
    expect(ADANI.label(lab('D52'))).toBe('Model Outputs & Lab C3S parameter 1')
    expect(ADANI.label(lab('D56'))).toBe('Model Outputs & Lab C3S parameter 4')
  })

  it('gives every sensor in a group a distinct label', () => {
    for (const line of ALL_LINES) {
      for (const g of [...line.groups('lab'), ...line.groups('process')]) {
        expect(new Set(g.sensors.map((s) => s.label)).size).toBe(g.sensors.length)
      }
    }
  })

  it('lets an alias override a supplied name', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    vi.doMock('../config/sensorAliases', () => ({
      SENSOR_ALIASES: { 'ADANI_LAB:D0': 'Raw Mix Silica', 'ADANI_RAW:D52': 'Fan 8 Pressure Drop', 'ADANI_LAB:D56': 'Leftover ash' },
    }))
    const { resolveLine } = await import('../config/plants')
    const fresh = resolveLine({ plantId: 'adani', lineId: 'line1' }).line
    expect(fresh.label('ADANI_LAB:D0')).toBe('Raw Mix Silica')
    expect(fresh.label('ADANI_RAW:D52')).toBe('Fan 8 Pressure Drop')
    // An alias names an unnamed tag, and verifies it.
    expect(fresh.sensorByKey('ADANI_LAB:D56')?.verification).toBe('verified')
    // A different device's same tag is untouched.
    expect(fresh.label('ADANI_RAW:D0')).toBe('Burning Zone Temp')
    vi.doUnmock('../config/sensorAliases')
    vi.resetModules()
  })
})

describe('JSW Cement: the line from the tag list', () => {
  it('has fifteen devices, twelve read as laboratory and three as process', () => {
    expect(JSW.labDevices).toEqual([
      'FLSRAWMILL01',
      'FLSBALLMILL',
      'FLSKILNFEED',
      'FLSCLINKER',
      'FLSCALCINATION1',
      'FLSCALCINATION2',
      'FLSCALCINATION',
      'JSWCOAL_A1',
      'JSWBMBCLRMTR_KC',
      'JSWBMBCLRMTR_PC',
      'JSW_C3S',
      'JSWCALN_A1',
    ])
    // The calciner temperatures arrive every 1–2 h with the laboratory feeds: read as laboratory samples.
    expect(JSW.processDevices).toEqual(['ABBKLN_A1', 'ABBBHPH_A1', 'ABBKLNAFRSGC_A1'])
    expect(JSW.insightId).toBe('INS_c3snandyalrca')
  })

  it('reads the quality table: moduli on the kiln feed and raw mill, the full clinker chemistry, two calciner streams', () => {
    expect(JSW.role('kilnFeedLsf')).toBe('FLSKILNFEED:D6')
    expect(JSW.role('kilnFeedSm')).toBe('FLSKILNFEED:D11')
    expect(JSW.role('kilnFeedAm')).toBe('FLSKILNFEED:D10')
    expect(JSW.role('rawMixLsf')).toBe('FLSRAWMILL01:D6')
    // The same D-tag layout on three devices stays three different parameters.
    expect([JSW.label('FLSRAWMILL01:D7'), JSW.label('FLSBALLMILL:D7'), JSW.label('FLSKILNFEED:D7')]).toEqual(['Raw mill SiO2', 'Ball mill SiO2', 'Kiln feed SiO2'])
    expect(JSW.label('FLSCLINKER:D5')).toBe('Clinker LSF')
    expect(JSW.label('FLSCLINKER:D16')).toBe('Clinker C2S')
    expect(JSW.label('FLSCALCINATION1:D16')).toBe('Calciner 1 calcination')
    expect(JSW.label('FLSCALCINATION:D17')).toBe('Average calciner temperature')
    expect(JSW.label('JSWCALN_A1:D1')).toBe('Calciner 2 temperature')
    expect(JSW.groups('lab').map((g) => g.id)).toEqual(['raw_mill', 'ball_mill', 'kiln_feed', 'clinker', 'calciner_1', 'calciner_2', 'calciner_avg', 'fuel', 'model_output'])
  })

  it('reads predicted C3S from the model device and the lab check from the clinker XRD', () => {
    expect(JSW.predictedC3S).toBe('JSW_C3S:D7')
    expect(JSW.label(JSW.predictedC3S)).toBe('Predicted C3S (Bogue + Ridge)')
    expect(JSW.actualC3S).toBe('FLSCLINKER:D18')
    expect(JSW.freeLime).toBe('FLSCLINKER:D24')
    // The two C3S series are on different devices, so the anchor probe must query both.
    expect(JSW.devicesOf([JSW.predictedC3S, JSW.actualC3S])).toEqual(['FLSCLINKER', 'JSW_C3S'])
  })

  it('keeps the three D18s apart', () => {
    expect(JSW.label('FLSCLINKER:D18')).toBe('Clinker C3S (XRD)')
    expect(JSW.label('JSWBMBCLRMTR_KC:D18')).toBe('Kiln coal NCV')
    expect(JSW.label('JSWBMBCLRMTR_PC:D18')).toBe('PC coal NCV')
    expect(JSW.role('coalNcv')).toBe('JSWBMBCLRMTR_KC:D18')
    expect(JSW.role('pcCoalNcv')).toBe('JSWBMBCLRMTR_PC:D18')
    // And the two D7s.
    expect(JSW.label('FLSKILNFEED:D7')).toBe('Kiln feed SiO2')
  })

  it('maps the kiln operation roles the list supplies, on their own DCS devices', () => {
    expect(JSW.role('kilnFeed')).toBe('ABBBHPH_A1:D63')
    expect(JSW.role('kilnCoal')).toBe('ABBKLN_A1:D154')
    expect(JSW.role('pcCoal')).toBe('ABBKLN_A1:D155')
    expect(JSW.role('lowNoxCoal')).toBe('ABBKLN_A1:D156')
    expect(JSW.role('solidAfr')).toBe('ABBKLNAFRSGC_A1:D2')
    expect(JSW.role('coalAsh')).toBe('JSWCOAL_A1:D12')
    expect(JSW.role('pcCoalAsh')).toBe('JSWCOAL_A1:D17')
    expect(JSW.role('afrNcv')).toBe('JSWCOAL_A1:D22')
    expect(JSW.role('rawMealLoi')).toBe('FLSKILNFEED:D214')
    expect(JSW.role('clinkerSO3')).toBe('FLSCLINKER:D19')
  })

  it('leaves the roles the list does not cover unmapped, so their features stay off', () => {
    for (const r of ['kilnRpm', 'burningZoneTemp', 'secondaryAirTemp', 'tertiaryAirTemp', 'kilnInletO2', 'afrAsh'] as const) {
      expect(JSW.role(r)).toBeNull()
    }
    expect(JSW.kilnFilling).toBeNull()
    expect(JSW.coolerFanFlows).toEqual([])
    expect(JSW.binLimits).toBeNull()
  })

  it('hides the superseded physics C3S so one predicted C3S is shown, and records the outputs', () => {
    expect(JSW.isHidden('JSW_C3S:D5')).toBe(true)
    const outputs = JSW.groups('lab').find((g) => g.id === 'model_output')!
    expect(outputs.sensors.map((s) => s.sensorId)).toEqual(['D0', 'D1', 'D2', 'D3', 'D4', 'D6', 'D7', 'D8'])
    expect(JSW.spec.outputs?.topic).toBe('devicesIn/JSW_C3S/data')
    expect(JSW.spec.outputs?.writes.find((w) => w.ref.sensorId === 'D7')?.writer).toBe('JSW_S9')
  })

  it('opens its own SHC Optimizer', () => {
    expect(JSW.plant.shcOptimizerUrl).toBe(
      'https://iosense.io/launchpad/view?id=6ae8242cbe636bd66706b234&entityName=Kiln%20SHC%20Optimization&fromLink=true&isHidden=false',
    )
    expect(ADANI.plant.shcOptimizerUrl).toContain('id=6ad86ac0fe275c6e1f553ae2')
  })

  it('uses the default shift pattern and no data cut-off', () => {
    expect(JSW.shifts.map((s) => s.id)).toEqual(['A', 'B', 'C'])
    expect(JSW.plant.dataEnd).toBeNull()
  })
})

describe('spec validation', () => {
  const plant: PlantSpec = { id: 'p', name: 'P', brand: { alt: 'P' }, lines: [] }
  const base: LineSpec = {
    id: 'l',
    name: 'L',
    insightId: 'INS_x',
    devices: [
      {
        devID: 'LAB',
        kind: 'lab',
        label: 'Lab',
        groups: [{ id: 'g', label: 'G' }],
        sensors: [
          { id: 'D1', name: 'Pred', unit: '%', group: 'g' },
          { id: 'D2', name: 'Act', unit: '%', group: 'g' },
          { id: 'D3', name: 'FL', unit: '%', group: 'g' },
        ],
      },
    ],
    roles: { predictedC3S: { devID: 'LAB', sensorId: 'D1' }, actualC3S: { devID: 'LAB', sensorId: 'D2' }, freeLime: { devID: 'LAB', sensorId: 'D3' } },
  }

  it('accepts a minimal line', () => {
    const m = buildLine(plant, base)
    expect(m.predictedC3S).toBe('LAB:D1')
    expect(m.groups('lab')[0].sensors).toHaveLength(3)
    expect(m.groups('process')).toEqual([])
  })

  it('rejects a role that names an unlisted sensor', () => {
    expect(() => buildLine(plant, { ...base, roles: { ...base.roles, kilnFeed: { devID: 'LAB', sensorId: 'D9' } } })).toThrow(/not a listed sensor/)
  })

  it.each(REQUIRED_ROLES)('rejects a line without %s', (role) => {
    const roles = { ...base.roles }
    delete roles[role]
    expect(() => buildLine(plant, { ...base, roles })).toThrow(/required role/)
  })
})
