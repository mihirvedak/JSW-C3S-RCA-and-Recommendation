/**
 * Adani Cement, Line 1.
 *
 * Two devices: `ADANI_LAB` (laboratory and model outputs, one contiguous D-block per material
 * stream) and `ADANI_RAW` (124 process signals a minute). Names, units and sections come from the
 * two tag maps the plant supplied (`adaniTagMaps.ts`); the bin limit table from
 * `adani_lsl_usl_K05_round5.json` (`adaniBinLimits.ts`); the spec limits, kiln filling formula
 * and the data cut-off from the plant's requests of 2026-10-28 (see iosense.md).
 */

import logo from '../../assets/adani-cement-logo.png'
import { LAB_TAGS, PROCESS_SECTION_LABELS, PROCESS_SECTION_ORDER, RAW_TAGS } from './adaniTagMaps'
import { adaniBinLimits } from './adaniBinLimits'
import type { DeviceSpec, LineSpec, PlantSpec, SensorSpec } from './types'

export const ADANI_LAB = 'ADANI_LAB'
export const ADANI_RAW = 'ADANI_RAW'

const lab = (sensorId: string) => ({ devID: ADANI_LAB, sensorId })
const raw = (sensorId: string) => ({ devID: ADANI_RAW, sensorId })

/* ------------------------------------------------------------------ *
 * ADANI_LAB — category bands supplied by the brief. Inclusive on both ends.
 * ------------------------------------------------------------------ */

const LAB_GROUPS = [
  { id: 'raw_mix', label: 'Raw Mix Quality' },
  { id: 'kiln_feed', label: 'Kiln Feed Quality' },
  { id: 'hot_meal_1', label: 'Hot Meal Quality — Stream 1' },
  { id: 'hot_meal_2', label: 'Hot Meal Quality — Stream 2' },
  { id: 'clinker', label: 'Clinker Quality' },
  { id: 'coal', label: 'Coal Quality' },
  { id: 'afr', label: 'Alternative Fuel (AFR) Quality' },
  { id: 'model_output', label: 'Model Outputs & Lab C3S' },
] as const

const LAB_BANDS: ReadonlyArray<{ from: number; to: number; group: string }> = [
  { from: 0, to: 12, group: 'raw_mix' },
  { from: 13, to: 25, group: 'kiln_feed' },
  { from: 26, to: 29, group: 'hot_meal_1' },
  { from: 30, to: 33, group: 'hot_meal_2' },
  { from: 34, to: 45, group: 'clinker' },
  { from: 46, to: 47, group: 'coal' },
  { from: 48, to: 51, group: 'afr' },
]

/**
 * The model-output block D52–D58 sits outside the tag map. Two of its tags are named by the
 * original mapping brief; the other five carry data but no name, and are listed as such.
 */
const MODEL_NAMED: Readonly<Record<string, string>> = {
  D55: 'Predicted C3S',
  D58: 'Actual C3S (Lab)',
}

function labSensors(): SensorSpec[] {
  const out: SensorSpec[] = []
  for (const band of LAB_BANDS) {
    for (let i = band.from; i <= band.to; i++) {
      const id = `D${i}`
      const tag = LAB_TAGS[id]
      if (!tag) continue
      out.push({ id, name: tag.label, unit: tag.unit, group: band.group, meaning: tag.meaning })
    }
  }
  for (const [id, name] of Object.entries(MODEL_NAMED)) out.push({ id, name, unit: '%', group: 'model_output' })
  return out
}

const LAB_DEVICE: DeviceSpec = {
  devID: ADANI_LAB,
  kind: 'lab',
  label: 'Laboratory',
  groups: LAB_GROUPS,
  sensors: labSensors(),
  unnamed: ['D52', 'D53', 'D54', 'D56', 'D57'].map((id) => ({ id, group: 'model_output' })),
}

/* ------------------------------------------------------------------ *
 * ADANI_RAW — every signal of the process tag map, with its section and grading.
 * ------------------------------------------------------------------ */

const PROCESS_DEVICE: DeviceSpec = {
  devID: ADANI_RAW,
  kind: 'process',
  label: 'Process',
  groups: PROCESS_SECTION_ORDER.map((id) => ({ id, label: PROCESS_SECTION_LABELS[id] })),
  sensors: Object.entries(RAW_TAGS).map(([id, t]) => ({
    id,
    name: t.label,
    unit: t.unit,
    group: t.section,
    quality: t.quality,
  })),
}

const FAN_FLOW = /^Cooler Fan (\d+) Flow$/
const coolerFanFlows = Object.entries(RAW_TAGS)
  .filter(([, t]) => FAN_FLOW.test(t.label))
  .sort(([, a], [, b]) => Number(FAN_FLOW.exec(a.label)![1]) - Number(FAN_FLOW.exec(b.label)![1]))
  .map(([id]) => raw(id))

const LINE_1: LineSpec = {
  id: 'line1',
  name: 'Line 1',
  insightId: 'INS_df1b3c1a11de',
  devices: [LAB_DEVICE, PROCESS_DEVICE],
  roles: {
    predictedC3S: lab('D55'),
    actualC3S: lab('D58'),
    freeLime: lab('D43'),
    // Kiln operation.
    kilnFeed: raw('D74'),
    kilnCoal: raw('D66'),
    pcCoal: raw('D75'),
    solidAfr: raw('D118'),
    kilnRpm: raw('D73'),
    burningZoneTemp: raw('D0'),
    secondaryAirTemp: raw('D117'),
    tertiaryAirTemp: raw('D122'),
    kilnInletO2: raw('D71'),
    kilnInletTemp: raw('D72'),
    pcOutletTemp: raw('D77'),
    coolerGrateSpeed: raw('D59'),
    // Laboratory chemistry.
    kilnFeedLsf: lab('D23'),
    kilnFeedSm: lab('D24'),
    kilnFeedAm: lab('D25'),
    rawMixLsf: lab('D10'),
    rawMixSm: lab('D11'),
    rawMixAm: lab('D12'),
    rawMealSiO2: lab('D13'),
    rawMealAl2O3: lab('D14'),
    rawMealFe2O3: lab('D15'),
    rawMealCaO: lab('D16'),
    rawMealLoi: lab('D17'),
    clinkerSO3: lab('D38'),
    // Fuel quality.
    coalAsh: lab('D47'),
    afrAsh: lab('D48'),
    coalNcv: lab('D46'),
    afrNcv: lab('D49'),
  },
  coolerFanFlows,
  /*
   * C3S is reported as Actual C3S (Lab, D58) and Predicted C3S (D55) only; the clinker Bogue C3S
   * values (corrected D44, uncorrected D45) are other derivations of the same quantity and are
   * kept out so no screen shows a third C3S. They stay in the registry.
   */
  hidden: [lab('D44'), lab('D45')],
  /** PC Outlet Temp is not charted, at the plant's request (2026-10-28). */
  trendExcluded: [raw('D77')],
  /*
   * Kiln filling degree, as the plant specified it (2026-10-28): 22.56 × (feed / 448) × (3.31 / rpm),
   * anchored on the worked example 448 t/h at 3.31 rpm = 22.56 %. Norm 14–16 %, flagged above 18 %.
   */
  kilnFilling: {
    anchor: { percent: 22.56, feed: 448, rpm: 3.31 },
    norm: { lo: 14, hi: 16 },
    flagAbove: 18,
    speedTarget: 19,
    minRpm: 0.5,
  },
  /*
   * Specification limits supplied by the plant (2026-10-28), each with the basis it was given on.
   * Plant notes: lab C3S historically runs a little below the band (median 42.2 against target 43)
   * and free lime above it (median 1.76 against 1.5). AFR ash limits are from the furnace lab
   * (n = 86, mean 27.4 %); the model's inferred D56 must not be used for them.
   */
  specLimits: [
    { role: 'actualC3S', lsl: 41.5, usl: 44.5, basis: 'Plant: 43 ± 1.5' },
    { role: 'predictedC3S', lsl: 41.5, usl: 44.5, basis: 'Same C3S spec' },
    { role: 'coalAsh', lsl: 30.5, usl: 34.8, basis: 'History p5–p95 (n=2,101)' },
    { role: 'afrAsh', lsl: 24.1, usl: 30.8, basis: 'AFR furnace lab ash, n=86' },
    { ref: lab('D37'), lsl: 62.9, usl: 63.7, basis: 'History p5–p95' }, // Clinker CaO
    { ref: lab('D35'), lsl: 5.37, usl: 5.79, basis: 'History p5–p95' }, // Clinker Al2O3
    { role: 'freeLime', lsl: 1.2, usl: 1.8, basis: 'Plant: 1.5 ± 0.3' },
    { role: 'kilnFeedLsf', lsl: 102.8, usl: 106.6, basis: 'History p5–p95 (n=4,044)' },
    { role: 'kilnFeedSm', lsl: 2.15, usl: 2.48, basis: 'History p5–p95' },
    { role: 'kilnFeedAm', lsl: 1.13, usl: 1.44, basis: 'History p5–p95' },
  ],
  binLimits: adaniBinLimits(ADANI_RAW),
}

export const ADANI: PlantSpec = {
  id: 'adani',
  name: 'Adani Cement',
  brand: { logo, alt: 'Adani Cement' },
  /** Plant request (2026-10-28): nothing after 28 Aug 2026, 03:00 plant time is loaded. */
  dataEnd: '2026-08-28T03:00',
  shcOptimizerUrl:
    'https://demo.iosense.io/launchpad/view?id=6ad86ac0fe275c6e1f553ae2&entityName=Kiln%20SHC%20Optimiser%20&fromLink=true&isHidden=false',
  lines: [LINE_1],
}
