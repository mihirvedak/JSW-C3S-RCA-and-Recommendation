/**
 * JSW Cement, Nandyal — kiln line.
 *
 * Configured from two lists the plant supplied on 2026-10-31: the C3S model's tag list (inputs,
 * outputs, NCV tags) and the quality-laboratory device table (raw mill, ball mill, kiln feed,
 * clinker, the two calciner streams, with the plant's targets). Nothing beyond those lists is
 * assumed: a role they do not cover is left unmapped, and the dashboard says which features that
 * disables (see `notes` at the bottom and iosense.md, "JSW Cement").
 *
 * Laboratory-type devices (sparse samples, read whole): the XRF/XRD devices, the fuel laboratory,
 * the bomb calorimeters and the model's own output device. Process devices (a reading a minute):
 * the kiln, preheater, AFR and calciner-temperature DCS devices.
 *
 * The quality table also records a data status per tag (captured / not captured / manual entry not
 * being filled). Tags not yet captured are listed all the same, with the status in their meaning,
 * so the screen shows "no sample" against a named parameter rather than hiding it.
 */

import type { DeviceSpec, LineSpec, PlantSpec, SensorSpec, SpecLimitSpec } from './types'

export const FLSRAWMILL = 'FLSRAWMILL01'
export const FLSBALLMILL = 'FLSBALLMILL'
export const FLSKILNFEED = 'FLSKILNFEED'
export const FLSCLINKER = 'FLSCLINKER'
export const FLSCALC1 = 'FLSCALCINATION1'
export const FLSCALC2 = 'FLSCALCINATION2'
export const FLSCALC = 'FLSCALCINATION'
export const JSWCOAL = 'JSWCOAL_A1'
export const JSW_NCV_KC = 'JSWBMBCLRMTR_KC'
export const JSW_NCV_PC = 'JSWBMBCLRMTR_PC'
export const JSW_C3S = 'JSW_C3S'
export const ABBKLN = 'ABBKLN_A1'
export const ABBBHPH = 'ABBBHPH_A1'
export const ABBKLNAFR = 'ABBKLNAFRSGC_A1'
export const JSWCALN = 'JSWCALN_A1'

const ref = (devID: string) => (sensorId: string) => ({ devID, sensorId })
const rawMill = ref(FLSRAWMILL)
const kilnFeed = ref(FLSKILNFEED)
const clinker = ref(FLSCLINKER)
const coal = ref(JSWCOAL)
const c3s = ref(JSW_C3S)
const kiln = ref(ABBKLN)
const preheater = ref(ABBBHPH)
const afr = ref(ABBKLNAFR)

/** Data status wording from the quality table, carried in each tag's meaning. */
const NOT_CAPTURED = 'quality table: data not being captured yet'
const NOT_FILLED = 'manual entry, quality table: not being filled yet'
const SPARSE = 'quality table: expected ≥12 samples a day, getting 1 or none'

/* ------------------------------------------------------------------ *
 * Raw meal chemistry — the same D-tag layout on the raw mill, ball mill and kiln feed devices.
 * ------------------------------------------------------------------ */

/** [id, name, unit, meaning?] — the XRF block shared by FLSRAWMILL01, FLSBALLMILL and FLSKILNFEED. */
const MEAL_XRF = (group: string, prefix: string, sparse: boolean): SensorSpec[] => {
  const status = sparse ? SPARSE : undefined
  const row = (id: string, name: string, unit: string | null, meaning?: string): SensorSpec => ({
    id,
    name: `${prefix} ${name}`,
    unit,
    group,
    meaning: [meaning, status].filter(Boolean).join('; ') || undefined,
  })
  return [
    row('D7', 'SiO2', '%'),
    row('D8', 'Al2O3', '%'),
    row('D13', 'Fe2O3', '%'),
    row('D14', 'CaO', '%'),
    row('D15', 'MgO', '%'),
    row('D16', 'SO3', '%'),
    row('D17', 'Na2O', '%'),
    row('D18', 'K2O', '%'),
    { id: 'D213', name: `${prefix} Cl`, unit: '%', group, meaning: NOT_CAPTURED },
    row('D6', 'LSF', null, 'lime saturation factor'),
    row('D11', 'SM', null, 'silica modulus'),
    row('D10', 'AM', null, 'alumina modulus'),
    { id: 'D214', name: `${prefix} LOI`, unit: '%', group, meaning: `loss on ignition; ${NOT_CAPTURED}` },
  ]
}

const RAW_MILL_LAB: DeviceSpec = {
  devID: FLSRAWMILL,
  kind: 'lab',
  label: 'Raw mill laboratory',
  groups: [{ id: 'raw_mill', label: 'Raw Mill (Raw Meal) Quality' }],
  sensors: [
    { id: 'D216', name: 'Raw mill limestone', unit: '%', group: 'raw_mill', meaning: `LS proportion; ${NOT_FILLED}` },
    { id: 'D217', name: 'Raw mill WF-3 alkali slag', unit: '%', group: 'raw_mill', meaning: NOT_FILLED },
    { id: 'D218', name: 'Raw mill WF-4 red mud', unit: '%', group: 'raw_mill', meaning: NOT_FILLED },
    { id: 'D219', name: 'Raw mill WF-5 laterite', unit: '%', group: 'raw_mill', meaning: NOT_FILLED },
    { id: 'D19', name: 'Raw mill residue 90 µ', unit: '%', group: 'raw_mill', meaning: `target < 22 %; ${NOT_FILLED}` },
    { id: 'D20', name: 'Raw mill residue 212 µ', unit: '%', group: 'raw_mill', meaning: `target < 4 %; ${NOT_FILLED}` },
    ...MEAL_XRF('raw_mill', 'Raw mill', false),
  ],
}

const BALL_MILL_LAB: DeviceSpec = {
  devID: FLSBALLMILL,
  kind: 'lab',
  label: 'Ball mill laboratory',
  groups: [{ id: 'ball_mill', label: 'Ball Mill (Raw Meal) Quality' }],
  sensors: [
    { id: 'D19', name: 'Ball mill residue 90 µ', unit: '%', group: 'ball_mill', meaning: `target < 22 %; ${NOT_FILLED}` },
    { id: 'D20', name: 'Ball mill residue 212 µ', unit: '%', group: 'ball_mill', meaning: `target < 2 %; ${NOT_FILLED}` },
    ...MEAL_XRF('ball_mill', 'Ball mill', false),
    // D161 "Remarks" is free text and is not a sensor the dashboard can chart.
  ],
}

const KILN_FEED_LAB: DeviceSpec = {
  devID: FLSKILNFEED,
  kind: 'lab',
  label: 'Kiln feed laboratory',
  groups: [{ id: 'kiln_feed', label: 'Kiln Feed Quality' }],
  sensors: [
    { id: 'D19', name: 'Kiln feed residue 90 µ', unit: '%', group: 'kiln_feed', meaning: `target < 22 %; ${NOT_FILLED}` },
    { id: 'D20', name: 'Kiln feed residue 212 µ', unit: '%', group: 'kiln_feed', meaning: `target < 3.2 %; ${NOT_FILLED}` },
    ...MEAL_XRF('kiln_feed', 'Kiln feed', true),
  ],
}

/* ------------------------------------------------------------------ *
 * Clinker
 * ------------------------------------------------------------------ */

const CLINKER_LAB: DeviceSpec = {
  devID: FLSCLINKER,
  kind: 'lab',
  label: 'Clinker laboratory',
  groups: [{ id: 'clinker', label: 'Clinker Quality' }],
  sensors: [
    { id: 'D26', name: 'Clinker litre weight', unit: 'g', group: 'clinker', meaning: NOT_FILLED },
    { id: 'D6', name: 'Clinker SiO2', unit: '%', group: 'clinker', meaning: SPARSE },
    { id: 'D8', name: 'Clinker Al2O3', unit: '%', group: 'clinker', meaning: SPARSE },
    { id: 'D11', name: 'Clinker Fe2O3', unit: '%', group: 'clinker', meaning: SPARSE },
    { id: 'D15', name: 'Clinker CaO', unit: '%', group: 'clinker', meaning: SPARSE },
    { id: 'D17', name: 'Clinker MgO', unit: '%', group: 'clinker', meaning: SPARSE },
    { id: 'D19', name: 'Clinker SO3', unit: '%', group: 'clinker', meaning: `Bogue SO3 term; target < 1.00 %; ${SPARSE}` },
    { id: 'D20', name: 'Clinker Na2O', unit: '%', group: 'clinker', meaning: SPARSE },
    { id: 'D22', name: 'Clinker K2O', unit: '%', group: 'clinker', meaning: SPARSE },
    { id: 'D23', name: 'Clinker Cl', unit: '%', group: 'clinker', meaning: `target 0.05 %; ${SPARSE}` },
    { id: 'D24', name: 'Clinker free lime', unit: '%', group: 'clinker', meaning: `Bogue CaO − FCaO; RCA free-lime zone / underburnt; target < 1.5 %; ${NOT_CAPTURED}` },
    { id: 'D28', name: 'Clinker oxide sum', unit: '%', group: 'clinker', meaning: NOT_CAPTURED },
    { id: 'D5', name: 'Clinker LSF', unit: null, group: 'clinker', meaning: `target 92–95; ${NOT_CAPTURED}` },
    { id: 'D13', name: 'Clinker SM', unit: null, group: 'clinker', meaning: `target 2.2–2.3; ${NOT_CAPTURED}` },
    { id: 'D10', name: 'Clinker AM', unit: null, group: 'clinker', meaning: `target 1.3–1.5; ${NOT_CAPTURED}` },
    { id: 'D18', name: 'Clinker C3S (XRD)', unit: '%', group: 'clinker', meaning: `laboratory C3S: trains the Ridge model, last-lab level, RCA C3S zone; target 50 ± 2 %; ${NOT_CAPTURED}` },
    { id: 'D16', name: 'Clinker C2S', unit: '%', group: 'clinker', meaning: `target 20–25 %; ${NOT_CAPTURED}` },
    { id: 'D14', name: 'Clinker C3A', unit: '%', group: 'clinker', meaning: `target 6–8 %; ${NOT_CAPTURED}` },
    { id: 'D21', name: 'Clinker C4AF', unit: '%', group: 'clinker', meaning: `target 11–13 %; ${NOT_CAPTURED}` },
    { id: 'D29', name: 'Clinker liquid content', unit: '%', group: 'clinker', meaning: `LC, target 27.5–28.5 %; ${NOT_CAPTURED}` },
    { id: 'D30', name: 'Clinker alkali / sulphur ratio', unit: null, group: 'clinker', meaning: `target 0.6–1.0; ${NOT_CAPTURED}` },
    { id: 'D31', name: 'Clinker alkalies as Na2O', unit: '%', group: 'clinker', meaning: NOT_CAPTURED },
  ],
}

/* ------------------------------------------------------------------ *
 * Calcination — two hot-meal streams, their averages, and the calciner temperatures (DCS).
 * ------------------------------------------------------------------ */

const calcinerStream = (devID: string, n: 1 | 2): DeviceSpec => {
  const group = `calciner_${n}`
  const p = `Calciner ${n}`
  return {
    devID,
    kind: 'lab',
    label: `${p} hot meal laboratory`,
    groups: [{ id: group, label: `${p} Hot Meal Quality` }],
    sensors: [
      { id: 'D15', name: `${p} cyclone V/VI LOI`, unit: '%', group, meaning: NOT_FILLED },
      { id: 'D16', name: `${p} calcination`, unit: '%', group, meaning: 'derived: (kiln feed LOI − cyclone LOI) / kiln feed LOI; target 90–94 %; quality table: manual-entry method update needed' },
      { id: 'D5', name: `${p} hot meal SO3`, unit: '%', group, meaning: `target < 2.00 %; ${SPARSE}` },
      { id: 'D8', name: `${p} hot meal Na2O`, unit: '%', group, meaning: SPARSE },
      { id: 'D9', name: `${p} hot meal K2O`, unit: '%', group, meaning: SPARSE },
      { id: 'D11', name: `${p} hot meal Cl`, unit: '%', group, meaning: `target < 1.00 %; ${SPARSE}` },
      { id: 'D17', name: `${p} volatile threshold`, unit: null, group, meaning: 'derived: 2 × Cl + SO3; target < 4.00; quality table: parser update needed' },
      { id: 'D18', name: `${p} alkali / sulphur ratio`, unit: null, group, meaning: `derived: (K2O/94 + Na2O/62 − Cl/71) / (SO3/80); ${NOT_CAPTURED}` },
    ],
  }
}

const CALCINER_1_LAB = calcinerStream(FLSCALC1, 1)
const CALCINER_2_LAB = calcinerStream(FLSCALC2, 2)

const CALCINER_AVG_LAB: DeviceSpec = {
  devID: FLSCALC,
  kind: 'lab',
  label: 'Calcination (combined)',
  groups: [{ id: 'calciner_avg', label: 'Calcination — Combined' }],
  sensors: [
    { id: 'D14', name: 'Kiln feed LOI (calcination basis)', unit: '%', group: 'calciner_avg', meaning: NOT_FILLED },
    { id: 'D15', name: 'Average calciner SO3', unit: '%', group: 'calciner_avg', meaning: 'derived: mean of the two streams; target < 2.00 %' },
    { id: 'D16', name: 'Average calcination', unit: '%', group: 'calciner_avg', meaning: 'derived: mean of the two streams; target 90–94 %' },
    { id: 'D17', name: 'Average calciner temperature', unit: '°C', group: 'calciner_avg', meaning: 'derived: mean of the two streams; target < 980 °C' },
  ],
}

/* ------------------------------------------------------------------ *
 * Fuel laboratory and calorimeters
 * ------------------------------------------------------------------ */

const FUEL_LAB: DeviceSpec = {
  devID: JSWCOAL,
  kind: 'lab',
  label: 'Fuel laboratory',
  groups: [{ id: 'fuel', label: 'Fuel Quality' }],
  sensors: [
    { id: 'D12', name: 'Kiln coal ash', unit: '%', group: 'fuel', meaning: 'physics ash' },
    { id: 'D17', name: 'PC coal ash', unit: '%', group: 'fuel', meaning: 'physics ash' },
    { id: 'D22', name: 'AFR NCV', unit: 'kcal/kg', group: 'fuel', meaning: 'historical RCA only; default 3100 until a lab NCV is cached' },
  ],
}

const NCV_KC: DeviceSpec = {
  devID: JSW_NCV_KC,
  kind: 'lab',
  label: 'Bomb calorimeter (kiln coal)',
  groups: [{ id: 'fuel', label: 'Fuel Quality' }],
  sensors: [{ id: 'D18', name: 'Kiln coal NCV', unit: 'kcal/kg', group: 'fuel', meaning: 'historical RCA only; default 5100 until a lab NCV is cached' }],
}

const NCV_PC: DeviceSpec = {
  devID: JSW_NCV_PC,
  kind: 'lab',
  label: 'Bomb calorimeter (PC coal)',
  groups: [{ id: 'fuel', label: 'Fuel Quality' }],
  sensors: [{ id: 'D18', name: 'PC coal NCV', unit: 'kcal/kg', group: 'fuel', meaning: 'historical RCA only; default 5100 until a lab NCV is cached' }],
}

/**
 * The model's output device. Written by two jobs: JSW_S5 (physics: ash and the old physics C3S)
 * and JSW_S9 (Bogue + Ridge C3S and its residual), over MQTT topic `devicesIn/JSW_C3S/data`.
 * Sparse like a laboratory device, so read the same way.
 */
const MODEL_OUT: DeviceSpec = {
  devID: JSW_C3S,
  kind: 'lab',
  label: 'C3S model outputs',
  groups: [{ id: 'model_output', label: 'Model Outputs' }],
  sensors: [
    { id: 'D0', name: 'Kiln coal ash used', unit: null, group: 'model_output' },
    { id: 'D1', name: 'PC coal ash used', unit: null, group: 'model_output' },
    // The tag list names the device of this row "JSW_S5", the writer; read as JSW_C3S like its neighbours (to confirm).
    { id: 'D2', name: 'Low-NOx ash used', unit: null, group: 'model_output' },
    { id: 'D3', name: 'AFR ash', unit: 'kg/kg', group: 'model_output' },
    { id: 'D4', name: 'Total ash', unit: null, group: 'model_output' },
    { id: 'D5', name: 'Old physics C3S', unit: '%', group: 'model_output' },
    { id: 'D6', name: 'Scaled AFR ash', unit: '%', group: 'model_output' },
    { id: 'D7', name: 'Predicted C3S (Bogue + Ridge)', unit: '%', group: 'model_output' },
    { id: 'D8', name: 'Ridge residual', unit: '%', group: 'model_output' },
  ],
}

/* ------------------------------------------------------------------ *
 * Process devices (DCS)
 * ------------------------------------------------------------------ */

const KILN_DCS: DeviceSpec = {
  devID: ABBKLN,
  kind: 'process',
  label: 'Kiln DCS',
  groups: [
    { id: 'kiln', label: 'Kiln' },
    { id: 'calciner', label: 'Calciner' },
  ],
  sensors: [
    { id: 'D154', name: 'Kiln coal', unit: 't/h', group: 'kiln', meaning: 'fuel ash, SHC, TSR' },
    { id: 'D155', name: 'PC coal', unit: 't/h', group: 'calciner', meaning: 'calciner coal: fuel ash, SHC, TSR' },
    { id: 'D156', name: 'Low-NOx coal', unit: 't/h', group: 'calciner', meaning: 'fuel ash, SHC' },
  ],
}

const PREHEATER_DCS: DeviceSpec = {
  devID: ABBBHPH,
  kind: 'process',
  label: 'Preheater DCS',
  groups: [{ id: 'preheater', label: 'Preheater' }],
  sensors: [{ id: 'D63', name: 'Kiln feed', unit: 't/h', group: 'preheater', meaning: 'running gate, ash per clinker; the quality table pairs the clinker sample with this at the hour start' }],
}

const AFR_DCS: DeviceSpec = {
  devID: ABBKLNAFR,
  kind: 'process',
  label: 'AFR feeding',
  groups: [{ id: 'calciner', label: 'Calciner' }],
  sensors: [{ id: 'D2', name: 'Solid AFR', unit: 't/h', group: 'calciner', meaning: 'AFR ash, TSR, SHC' }],
}

/*
 * Calciner temperatures. Named as DCS tags, but live (2026-11-01) they carry one value every 1–2 h on
 * the hour, arrive as text like the laboratory, and stopped on 16 Oct with the laboratory feeds: they
 * come through the quality-table parser, so they are read and charted as laboratory samples.
 */
const CALCINER_DCS: DeviceSpec = {
  devID: JSWCALN,
  kind: 'lab',
  label: 'Calciner temperatures',
  groups: [{ id: 'calciner_avg', label: 'Calcination — Combined' }],
  sensors: [
    { id: 'D0', name: 'Calciner 1 temperature', unit: '°C', group: 'calciner_avg', meaning: 'target < 980 °C; quality table: cyclone 1 tag in ABB still to be confirmed' },
    { id: 'D1', name: 'Calciner 2 temperature', unit: '°C', group: 'calciner_avg', meaning: 'target < 980 °C; quality table: cyclone 1 tag in ABB still to be confirmed' },
  ],
}

/* ------------------------------------------------------------------ *
 * The plant's targets, from the column headers of the quality table (2026-10-31). One-sided
 * targets ("< 1.00 %") set the one limit they state; "±" targets set both.
 * ------------------------------------------------------------------ */

const TARGET = 'Plant target (quality table)'
const SPEC_LIMITS: SpecLimitSpec[] = [
  { role: 'actualC3S', lsl: 48, usl: 52, basis: `${TARGET}: 50 ± 2` },
  { role: 'predictedC3S', lsl: 48, usl: 52, basis: 'Same C3S target' },
  { role: 'freeLime', lsl: null, usl: 1.5, basis: `${TARGET}: < 1.5` },
  { role: 'clinkerSO3', lsl: null, usl: 1.0, basis: `${TARGET}: < 1.00` },
  { ref: clinker('D5'), lsl: 92, usl: 95, basis: TARGET },
  { ref: clinker('D13'), lsl: 2.2, usl: 2.3, basis: TARGET },
  { ref: clinker('D10'), lsl: 1.3, usl: 1.5, basis: TARGET },
  { ref: clinker('D16'), lsl: 20, usl: 25, basis: TARGET },
  { ref: clinker('D14'), lsl: 6, usl: 8, basis: TARGET },
  { ref: clinker('D21'), lsl: 11, usl: 13, basis: TARGET },
  { ref: clinker('D29'), lsl: 27.5, usl: 28.5, basis: TARGET },
  { ref: clinker('D30'), lsl: 0.6, usl: 1.0, basis: TARGET },
  { role: 'kilnFeedLsf', lsl: 98, usl: 102, basis: `${TARGET}: 100 ± 2` },
  { role: 'kilnFeedSm', lsl: 2.2, usl: 2.4, basis: `${TARGET}: 2.3 ± 0.1` },
  { role: 'kilnFeedAm', lsl: 1.2, usl: 1.4, basis: `${TARGET}: 1.3 ± 0.1` },
  { ref: kilnFeed('D8'), lsl: 3.5, usl: 3.6, basis: TARGET },
  { ref: kilnFeed('D13'), lsl: 3.0, usl: 3.1, basis: TARGET },
  { role: 'rawMixLsf', lsl: 98, usl: 102, basis: `${TARGET}: 100 ± 2` },
  { role: 'rawMixSm', lsl: 1.8, usl: 2.0, basis: TARGET },
  { role: 'rawMixAm', lsl: 0.9, usl: 1.1, basis: TARGET },
  { ref: rawMill('D8'), lsl: 3.5, usl: 3.6, basis: TARGET },
  { ref: rawMill('D13'), lsl: 3.0, usl: 3.1, basis: TARGET },
  { ref: { devID: FLSCALC, sensorId: 'D16' }, lsl: 90, usl: 94, basis: TARGET },
  { ref: { devID: FLSCALC, sensorId: 'D15' }, lsl: null, usl: 2.0, basis: `${TARGET}: < 2.00` },
  { ref: { devID: FLSCALC, sensorId: 'D17' }, lsl: null, usl: 980, basis: `${TARGET}: < 980 °C` },
]

const KILN_LINE: LineSpec = {
  id: 'kiln',
  name: 'Kiln line',
  insightId: 'INS_c3snandyalrca',
  devices: [
    RAW_MILL_LAB,
    BALL_MILL_LAB,
    KILN_FEED_LAB,
    CLINKER_LAB,
    CALCINER_1_LAB,
    CALCINER_2_LAB,
    CALCINER_AVG_LAB,
    FUEL_LAB,
    NCV_KC,
    NCV_PC,
    MODEL_OUT,
    KILN_DCS,
    PREHEATER_DCS,
    AFR_DCS,
    CALCINER_DCS,
  ],
  roles: {
    predictedC3S: c3s('D7'),
    actualC3S: clinker('D18'),
    freeLime: clinker('D24'),
    clinkerSO3: clinker('D19'),
    // Kiln operation.
    kilnFeed: preheater('D63'),
    kilnCoal: kiln('D154'),
    pcCoal: kiln('D155'),
    lowNoxCoal: kiln('D156'),
    solidAfr: afr('D2'),
    // Kiln feed chemistry (Bogue inputs and moduli).
    rawMealCaO: kilnFeed('D14'),
    rawMealSiO2: kilnFeed('D7'),
    rawMealAl2O3: kilnFeed('D8'),
    rawMealFe2O3: kilnFeed('D13'),
    rawMealLoi: kilnFeed('D214'),
    kilnFeedLsf: kilnFeed('D6'),
    kilnFeedSm: kilnFeed('D11'),
    kilnFeedAm: kilnFeed('D10'),
    // Raw mix moduli: the raw mill's product (the ball mill is listed as a second stream).
    rawMixLsf: rawMill('D6'),
    rawMixSm: rawMill('D11'),
    rawMixAm: rawMill('D10'),
    // Fuel quality.
    coalAsh: coal('D12'),
    pcCoalAsh: coal('D17'),
    afrNcv: coal('D22'),
    coalNcv: { devID: JSW_NCV_KC, sensorId: 'D18' },
    pcCoalNcv: { devID: JSW_NCV_PC, sensorId: 'D18' },
  },
  /** The dashboard shows one predicted C3S (D7); the superseded physics C3S (D5) stays in the registry. */
  hidden: [c3s('D5')],
  /** Every process tag supplied so far, charted on Trend Analysis in this order. */
  processTrends: [
    preheater('D63'),
    kiln('D154'),
    kiln('D155'),
    kiln('D156'),
    afr('D2'),
  ],
  /** The quality parameters charted on Trend Analysis, in this order. */
  labTrends: [
    clinker('D18'),
    c3s('D7'),
    clinker('D24'),
    clinker('D19'),
    clinker('D5'),
    clinker('D13'),
    clinker('D10'),
    kilnFeed('D6'),
    kilnFeed('D11'),
    kilnFeed('D10'),
    kilnFeed('D14'),
    kilnFeed('D7'),
    rawMill('D6'),
    { devID: FLSCALC, sensorId: 'D16' },
    { devID: FLSCALC, sensorId: 'D15' },
    { devID: FLSCALC, sensorId: 'D17' },
    { devID: JSWCALN, sensorId: 'D0' },
    { devID: JSWCALN, sensorId: 'D1' },
    coal('D12'),
    coal('D17'),
  ],
  /*
   * Adani's cap of 50 % (its model occasionally emits impossible values) would drop Nandyal's
   * Bogue + Ridge C3S if it runs high. 80 % is a physical ceiling for Bogue C3S; the plant's
   * clinker target is 50 ± 2 % and it has stated no cap of its own (see notes).
   */
  predictedC3SMax: 80,
  specLimits: SPEC_LIMITS,
  outputs: {
    topic: 'devicesIn/JSW_C3S/data',
    writes: [
      { ref: c3s('D0'), name: 'Kiln coal ash used', writer: 'JSW_S5' },
      { ref: c3s('D1'), name: 'PC coal ash used', writer: 'JSW_S5' },
      { ref: c3s('D2'), name: 'Low-NOx ash used', writer: 'JSW_S5' },
      { ref: c3s('D3'), name: 'AFR ash kg/kg', writer: 'JSW_S5' },
      { ref: c3s('D4'), name: 'Total ash', writer: 'JSW_S5' },
      { ref: c3s('D5'), name: 'Old physics C3S', writer: 'JSW_S5' },
      { ref: c3s('D6'), name: 'Scaled AFR ash %', writer: 'JSW_S5' },
      { ref: c3s('D7'), name: 'Bogue + Ridge C3S', writer: 'JSW_S9' },
      { ref: c3s('D8'), name: 'Ridge residual', writer: 'JSW_S9' },
    ],
  },
  notes: [
    'No kiln speed, burning zone, secondary / tertiary air, kiln inlet O2 or cooler fan tags were supplied: the kiln-operation trends, kiln filling degree and cooler flow are not shown until they are. Calciner temperatures (JSWCALN_A1 D0 / D1) are listed but their ABB source tag is still to be confirmed.',
    'The quality table marks the clinker C3S (FLSCLINKER:D18) and free lime (D24) as "data not being captured" and the kiln-feed XRF as 1 or no samples a day against 12 expected: until the laboratory feed is fixed the C3S trend, zones and timeline will be thin.',
    'No AFR ash laboratory tag was supplied (the model writes its own AFR ash to JSW_C3S:D3 / D6).',
    'Specification limits come from the targets in the quality table headers; no kiln-feed bin limit table was supplied, so the compliance table judges laboratory rows only.',
    'Shift pattern not supplied: the default A 06–14 / B 14–22 / C 22–06 is used.',
    'The tag list gives the device of "Low-NOx ash used" as JSW_S5 (the writer); it is read as JSW_C3S:D2 here.',
    'No plausibility cap for predicted C3S was supplied: values above 80 % are treated as missing (Adani uses 50 %).',
    'FLSBALLMILL:D161 "Remarks" is free text and is not listed as a sensor.',
  ],
}

export const JSW: PlantSpec = {
  id: 'jsw',
  name: 'JSW Cement',
  brand: { alt: 'JSW Cement' },
  dataEnd: null,
  lines: [KILN_LINE],
}
