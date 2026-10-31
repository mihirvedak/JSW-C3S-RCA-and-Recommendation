/**
 * JSW Cement, Nandyal — kiln line.
 *
 * Configured from the tag list supplied on 2026-10-31 (inputs read by the C3S model and the RCA,
 * the outputs the model writes, and the NCV tags). Nothing beyond that list is assumed: a role
 * the list does not cover is left unmapped, and the dashboard says which features that disables
 * (see `notes` at the bottom and iosense.md, "JSW Cement").
 *
 * Nine devices. The laboratory-type ones (sparse samples, read whole) are the XRD/XRF devices,
 * the fuel laboratory, the bomb calorimeters and the model's own output device; the process
 * ones (a reading a minute) are the kiln, preheater and AFR DCS devices.
 */

import type { DeviceSpec, LineSpec, PlantSpec } from './types'

export const FLSCLINKER = 'FLSCLINKER'
export const FLSKILNFEED = 'FLSKILNFEED'
export const JSWCOAL = 'JSWCOAL_A1'
export const JSW_NCV_KC = 'JSWBMBCLRMTR_KC'
export const JSW_NCV_PC = 'JSWBMBCLRMTR_PC'
export const JSW_C3S = 'JSW_C3S'
export const ABBKLN = 'ABBKLN_A1'
export const ABBBHPH = 'ABBBHPH_A1'
export const ABBKLNAFR = 'ABBKLNAFRSGC_A1'

const ref = (devID: string) => (sensorId: string) => ({ devID, sensorId })
const clinker = ref(FLSCLINKER)
const kilnFeed = ref(FLSKILNFEED)
const coal = ref(JSWCOAL)
const c3s = ref(JSW_C3S)
const kiln = ref(ABBKLN)
const preheater = ref(ABBBHPH)
const afr = ref(ABBKLNAFR)

/* ------------------------------------------------------------------ *
 * Laboratory-type devices
 * ------------------------------------------------------------------ */

const CLINKER_LAB: DeviceSpec = {
  devID: FLSCLINKER,
  kind: 'lab',
  label: 'Clinker laboratory',
  groups: [{ id: 'clinker', label: 'Clinker Quality' }],
  sensors: [
    { id: 'D18', name: 'Clinker C3S (XRD)', unit: '%', group: 'clinker', meaning: 'laboratory C3S: trains the Ridge model, last-lab level, RCA C3S zone' },
    { id: 'D24', name: 'Clinker free lime', unit: '%', group: 'clinker', meaning: 'Bogue CaO − FCaO; RCA free-lime zone / underburnt' },
    { id: 'D19', name: 'Clinker SO3', unit: '%', group: 'clinker', meaning: 'Bogue SO3 term' },
  ],
}

const KILN_FEED_LAB: DeviceSpec = {
  devID: FLSKILNFEED,
  kind: 'lab',
  label: 'Kiln feed laboratory',
  groups: [{ id: 'kiln_feed', label: 'Kiln Feed Quality' }],
  sensors: [
    { id: 'D14', name: 'Raw meal CaO', unit: '%', group: 'kiln_feed', meaning: 'Bogue K0' },
    { id: 'D7', name: 'Raw meal SiO2', unit: '%', group: 'kiln_feed', meaning: 'Bogue K0' },
    { id: 'D8', name: 'Raw meal Al2O3', unit: '%', group: 'kiln_feed', meaning: 'Bogue K0' },
    { id: 'D13', name: 'Raw meal Fe2O3', unit: '%', group: 'kiln_feed', meaning: 'Bogue K0' },
    { id: 'D214', name: 'Raw meal LOI', unit: '%', group: 'kiln_feed', meaning: 'oxide dry-basis factor' },
  ],
}

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
  sensors: [{ id: 'D63', name: 'Kiln feed', unit: 't/h', group: 'preheater', meaning: 'running gate, ash per clinker' }],
}

const AFR_DCS: DeviceSpec = {
  devID: ABBKLNAFR,
  kind: 'process',
  label: 'AFR feeding',
  groups: [{ id: 'calciner', label: 'Calciner' }],
  sensors: [{ id: 'D2', name: 'Solid AFR', unit: 't/h', group: 'calciner', meaning: 'AFR ash, TSR, SHC' }],
}

const KILN_LINE: LineSpec = {
  id: 'kiln',
  name: 'Kiln line',
  insightId: 'INS_c3snandyalrca',
  devices: [CLINKER_LAB, KILN_FEED_LAB, FUEL_LAB, NCV_KC, NCV_PC, MODEL_OUT, KILN_DCS, PREHEATER_DCS, AFR_DCS],
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
    // Raw meal chemistry (Bogue inputs).
    rawMealCaO: kilnFeed('D14'),
    rawMealSiO2: kilnFeed('D7'),
    rawMealAl2O3: kilnFeed('D8'),
    rawMealFe2O3: kilnFeed('D13'),
    rawMealLoi: kilnFeed('D214'),
    // Fuel quality.
    coalAsh: coal('D12'),
    pcCoalAsh: coal('D17'),
    afrNcv: coal('D22'),
    coalNcv: { devID: JSW_NCV_KC, sensorId: 'D18' },
    pcCoalNcv: { devID: JSW_NCV_PC, sensorId: 'D18' },
  },
  /** The dashboard shows one predicted C3S (D7); the superseded physics C3S (D5) stays in the registry. */
  hidden: [c3s('D5')],
  /*
   * Adani's cap of 50 % (its model occasionally emits impossible values) would drop Nandyal's
   * Bogue + Ridge C3S, which runs around 60 %. 80 % is a physical ceiling for Bogue C3S; the
   * plant has not stated a cap of its own (see notes).
   */
  predictedC3SMax: 80,
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
    'No kiln speed, burning zone, secondary / tertiary air, kiln inlet O2 or cooler fan tags were supplied: the kiln-operation trends, kiln filling degree and cooler flow are not shown until they are.',
    'No kiln feed LSF / SM / AM tags were supplied (only the oxides): RCA findings about LSF cannot be tied to a tag.',
    'No AFR ash laboratory tag was supplied (the model writes its own AFR ash to JSW_C3S:D3 / D6).',
    'No LSL / USL were supplied for any parameter, and no kiln-feed bin limit table: the compliance table shows only the C3S and free-lime rows, with the limits the RCA insight itself reports.',
    'Shift pattern not supplied: the default A 06–14 / B 14–22 / C 22–06 is used.',
    'The tag list gives the device of "Low-NOx ash used" as JSW_S5 (the writer); it is read as JSW_C3S:D2 here.',
    'No plausibility cap for predicted C3S was supplied: values above 80 % are treated as missing (Adani uses 50 %).',
  ],
}

export const JSW: PlantSpec = {
  id: 'jsw',
  name: 'JSW Cement',
  brand: { alt: 'JSW Cement' },
  dataEnd: null,
  lines: [KILN_LINE],
}
