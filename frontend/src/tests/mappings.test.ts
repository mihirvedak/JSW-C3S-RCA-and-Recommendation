import { describe, expect, it } from 'vitest'
import {
  ACTUAL_C3S,
  CLINKER_C3S,
  CLINKER_C3S_UNCORRECTED,
  LAB_DEVICE,
  LAB_SENSORS,
  LAB_SENSORS_BY_CATEGORY,
  PREDICTED_C3S,
  PROCESS_DEVICE,
  PROCESS_SENSORS,
  getSensor,
  hasVerifiedName,
  qualifiedRef,
  sensorLabel,
} from '../config/deviceMappings'

describe('C3S series mappings', () => {
  it('maps predicted C3S to ADANI_LAB:D55', () => {
    expect(PREDICTED_C3S).toBe('D55')
    const s = getSensor(LAB_DEVICE, PREDICTED_C3S)
    expect(s?.name).toBe('Predicted C3S')
    expect(s?.verification).toBe('verified')
  })

  it('maps actual lab C3S to ADANI_LAB:D58', () => {
    expect(ACTUAL_C3S).toBe('D58')
    expect(getSensor(LAB_DEVICE, ACTUAL_C3S)?.name).toBe('Actual C3S (Lab)')
  })

  it('keeps CLINKER_C3S and CLINKER_C3S_uncorrected distinct from the C3S series', () => {
    expect(CLINKER_C3S).toBe('D44')
    expect(CLINKER_C3S_UNCORRECTED).toBe('D45')
    expect(getSensor(LAB_DEVICE, 'D44')?.name).toBe('Clinker C3S')
    expect(getSensor(LAB_DEVICE, 'D45')?.name).toBe('Clinker C3S (uncorrected)')

    const ids = new Set([PREDICTED_C3S, ACTUAL_C3S, CLINKER_C3S, CLINKER_C3S_UNCORRECTED])
    expect(ids.size).toBe(4)
  })
})

describe('device-scoped lookup', () => {
  it('resolves the same D-tag differently per device', () => {
    // The documented collision: D55 is predicted C3S on the lab device and
    // Cooler Fan 9 Amps on the process device.
    expect(sensorLabel(LAB_DEVICE, 'D55')).toBe('Predicted C3S')
    expect(sensorLabel(PROCESS_DEVICE, 'D55')).toBe('Cooler Fan 9 Amps')
    expect(getSensor(LAB_DEVICE, 'D55')).not.toBe(getSensor(PROCESS_DEVICE, 'D55'))
  })

  it('namespaces registry keys by device', () => {
    expect(qualifiedRef(LAB_DEVICE, 'D55')).toBe('ADANI_LAB:D55')
    expect(qualifiedRef(PROCESS_DEVICE, 'D55')).toBe('ADANI_RAW:D55')
  })

  it('returns undefined for an unknown pair rather than guessing', () => {
    expect(getSensor(LAB_DEVICE, 'D999')).toBeUndefined()
    expect(getSensor('SOME_OTHER_DEVICE', 'D55')).toBeUndefined()
  })
})

describe('ADANI_LAB category bands D0–D51', () => {
  const expected: Array<[string, number, number, number]> = [
    ['raw_mix', 0, 12, 13],
    ['kiln_feed', 13, 25, 13],
    ['hot_meal_1', 26, 29, 4],
    ['hot_meal_2', 30, 33, 4],
    ['clinker', 34, 45, 12],
    ['coal', 46, 47, 2],
    ['afr', 48, 51, 4],
  ]

  it.each(expected)('%s covers D%d–D%d with %d sensors', (cat, from, to, count) => {
    const list = LAB_SENSORS_BY_CATEGORY[cat as keyof typeof LAB_SENSORS_BY_CATEGORY]
    expect(list).toHaveLength(count)
    expect(list[0].sensorId).toBe(`D${from}`)
    expect(list[list.length - 1].sensorId).toBe(`D${to}`)
    for (const s of list) expect(s.devID).toBe(LAB_DEVICE)
  })

  it('covers every tag from D0 to D58 exactly once', () => {
    const ids = LAB_SENSORS.map((s) => s.sensorId)
    expect(new Set(ids).size).toBe(ids.length)
    for (let i = 0; i <= 58; i++) expect(ids).toContain(`D${i}`)
    expect(ids).toHaveLength(59)
  })
})

describe('names come from the supplied tag maps', () => {
  it('names every ADANI_LAB tag the lab tag map covers (D0–D51), and only those plus D55/D58', () => {
    const verified = LAB_SENSORS.filter((s) => s.verification === 'verified').map((s) => s.sensorId)
    const want = [...Array.from({ length: 52 }, (_, i) => `D${i}`), 'D55', 'D58']
    expect([...verified].sort()).toEqual([...want].sort())
  })

  it('leaves the model outputs the lab tag map does not cover as category-only', () => {
    for (const id of ['D52', 'D53', 'D54', 'D56', 'D57']) {
      const s = getSensor(LAB_DEVICE, id)
      expect(s?.name).toBeNull()
      expect(s?.verification).toBe('category-only')
      expect(hasVerifiedName(LAB_DEVICE, id)).toBe(false)
    }
  })

  it('names all 124 ADANI_RAW signals (D0–D123)', () => {
    expect(PROCESS_SENSORS).toHaveLength(124)
    expect(PROCESS_SENSORS[0].sensorId).toBe('D0')
    expect(PROCESS_SENSORS[123].sensorId).toBe('D123')
    expect(PROCESS_SENSORS.every((s) => s.verification === 'verified' && s.name != null)).toBe(true)
  })

  it('spot-checks lab names against the lab tag map', () => {
    // [tag, label, unit]
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
      const s = getSensor(LAB_DEVICE, id)
      expect([id, s?.label, s?.unit]).toEqual([id, label, unit])
    }
  })

  it('keeps the two clinker C3S parameters distinct from each other and from the C3S series', () => {
    expect(sensorLabel(LAB_DEVICE, CLINKER_C3S)).not.toBe(sensorLabel(LAB_DEVICE, CLINKER_C3S_UNCORRECTED))
    expect(sensorLabel(LAB_DEVICE, CLINKER_C3S)).not.toBe(sensorLabel(LAB_DEVICE, PREDICTED_C3S))
  })

  it('spot-checks process names, units and sections against the process tag map', () => {
    // [tag, label, unit, section]
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
      const s = getSensor(PROCESS_DEVICE, id) as (typeof PROCESS_SENSORS)[number]
      expect([id, s.label, s.unit, s.group]).toEqual([id, label, unit, group])
    }
  })

  it('has the section sizes the process tag map lists', () => {
    const count = (g: string) => PROCESS_SENSORS.filter((s) => s.group === g).length
    expect(count('preheater')).toBe(39)
    expect(count('calciner')).toBe(6)
    expect(count('kiln')).toBe(7)
    expect(count('cooler')).toBe(65)
    expect(count('other')).toBe(7)
  })

  it('carries the tag map\'s signal assessment as data', () => {
    const q = (id: string) => (getSensor(PROCESS_DEVICE, id) as (typeof PROCESS_SENSORS)[number]).quality
    expect(q('D0')).toBe('usable')
    expect(q('D1')).toBe('unreliable')
    expect(q('D16')).toBe('flag')
    expect(q('D5')).toBe('drop')
    expect(q('D77')).toBe('flag')
    expect(q('D115')).toBe('unreliable')
  })

  it('writes the degree sign as a degree sign, not the export artefact', () => {
    for (const s of PROCESS_SENSORS) expect(s.unit ?? '').not.toMatch(/[\uff61-\uff9f]/)
    expect(getSensor(PROCESS_DEVICE, 'D72')?.unit).toBe('°C')
  })
})

describe('display labels', () => {
  it('uses the supplied name for sensors that have one', () => {
    expect(sensorLabel(LAB_DEVICE, 'D55')).toBe('Predicted C3S')
    expect(sensorLabel(LAB_DEVICE, 'D58')).toBe('Actual C3S (Lab)')
    expect(sensorLabel(PROCESS_DEVICE, 'D55')).toBe('Cooler Fan 9 Amps')
  })

  it('never falls back to a bare sensor id for a mapped sensor', () => {
    for (const s of [...LAB_SENSORS, ...PROCESS_SENSORS]) {
      expect(s.label).not.toBe(s.sensorId)
      expect(s.label).not.toMatch(/^D\d+$/)
    }
  })

  it('builds a label from category and position only where no name was supplied', () => {
    expect(sensorLabel(LAB_DEVICE, 'D52')).toBe('Model output parameter 1')
    expect(sensorLabel(LAB_DEVICE, 'D56')).toBe('Model output parameter 5')
  })

  it('gives every sensor in a category a distinct label', () => {
    for (const list of Object.values(LAB_SENSORS_BY_CATEGORY)) {
      expect(new Set(list.map((s) => s.label)).size).toBe(list.length)
    }
    expect(new Set(PROCESS_SENSORS.map((s) => s.label)).size).toBe(PROCESS_SENSORS.length)
  })

  it('does not let the same D-tag share a label across devices', () => {
    expect(sensorLabel(LAB_DEVICE, 'D55')).not.toBe(sensorLabel(PROCESS_DEVICE, 'D55'))
    expect(sensorLabel(LAB_DEVICE, 'D0')).not.toBe(sensorLabel(PROCESS_DEVICE, 'D0'))
  })

  it('lets an alias override a supplied name', async () => {
    // Overrides are applied when the registry is built, so rebuild it with one in place.
    const { vi } = await import('vitest')
    vi.resetModules()
    vi.doMock('../config/sensorAliases', () => ({
      SENSOR_ALIASES: { 'ADANI_LAB:D0': 'Raw Mix Silica', 'ADANI_RAW:D52': 'Fan 8 Pressure Drop' },
    }))
    const fresh = await import('../config/deviceMappings')
    expect(fresh.sensorLabel('ADANI_LAB', 'D0')).toBe('Raw Mix Silica')
    expect(fresh.sensorLabel('ADANI_RAW', 'D52')).toBe('Fan 8 Pressure Drop')
    // A different device's same tag is untouched.
    expect(fresh.sensorLabel('ADANI_RAW', 'D0')).toBe('Burning Zone Temp')
    vi.doUnmock('../config/sensorAliases')
    vi.resetModules()
  })
})
