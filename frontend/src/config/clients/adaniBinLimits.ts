/**
 * Adani Maratha: process limits by kiln-feed (TPH) bin, from the plant's limit table
 * `adani_lsl_usl_K05_round5.json` (generated 2026-10-27T11:48:58+05:30).
 *
 * How the file made them (its own words): "LSL/USL = mean +/- 1 sd of the golden rows after
 * 1.5xIQR trim", the golden period being chosen per bin (best SHC / TSR run of at least 180 min).
 * So a process sitting in its golden state is inside LSL–USL about 68 % of the time, which is why
 * the status thresholds are 68 % and 50 %, not 90 %.
 *
 * Bins are on kiln feed (`MT.431-FM1.F4:PV` = ADANI_RAW D74), edges 370 / 440 / 460 / 480 / 500
 * / 520 / 565 t/h; feed below 370 is excluded by the file. Only the parameters the Executive View
 * reports are carried, copied as the file states them: [LSL, USL, target, status]. Names are the
 * file's own and are mapped to ADANI_RAW tags by the tag map's labels (`adaniBinLimits`).
 *
 * The file's note: status DROP or UNRELIABLE means the tag should not be used as a set point.
 */

import { RAW_TAGS } from './adaniTagMaps'
import type { BinLimitsSpec, LimitStatus, TphBin } from './types'

const TPH_BINS: readonly TphBin[] = [
  { id: '370440', min: 370, max: 440 },
  { id: '440460', min: 440, max: 460 },
  { id: '460480', min: 460, max: 480 },
  { id: '480500', min: 480, max: 500 },
  { id: '500520', min: 500, max: 520 },
  { id: '520565', min: 520, max: 565 },
]

const BIN_LIMITS_SOURCE = 'adani_lsl_usl_K05_round5.json (mean ± 1 sd of each bin’s golden period)'

type Row = readonly [lsl: number, usl: number, target: number, status: LimitStatus]

/** Bin id → parameter (file name) → limits. A parameter absent from a bin has no limit there. */
const ROWS: Readonly<Record<string, Readonly<Record<string, Row>>>> = {
  '370440': {
    'Kiln feed': [413.504, 431.733, 424.829, 'USABLE'],
    'Kiln RPM': [3.027, 3.126, 3.07, 'DROP'],
    'Kiln Coal': [20.981, 22.248, 21.572, 'USABLE'],
    'PC Coal': [17.511, 17.864, 17.699, 'USABLE'],
    'Solid AFR': [12.016, 14.404, 13.178, 'USABLE'],
    'Burning Zone Temp': [1103.318, 1215.989, 1173.927, 'USABLE'],
    'TAD Temperature': [853.868, 875.861, 866.348, 'USABLE'],
    'Secondary Air Temp': [926.573, 972.041, 949.73, 'USABLE'],
    'Cooler Fan 1 Flow': [184.046, 189.881, 187.103, 'USABLE'],
    'Cooler Fan 2 Flow': [191.053, 200.452, 195.234, 'USABLE'],
    'Cooler Fan 3 Flow': [330.333, 360.007, 349.731, 'USABLE'],
    'Cooler Fan 4 Flow': [292.594, 305.141, 297.881, 'USABLE'],
    'Cooler Fan 5 Flow': [708.349, 720.056, 713.656, 'USABLE'],
    'Cooler Fan 6 Flow': [2264.86, 2264.917, 2264.89, 'USABLE'],
    'Cooler Fan 7 Flow': [3519.808, 3519.91, 3519.865, 'USABLE'],
    'Cooler Fan 9 Flow': [3154.17, 3372.262, 3264.11, 'USABLE'],
    'Cooler Fan 10 Flow': [3190.459, 3423.866, 3304.616, 'USABLE'],
    'Cooler Fan 11 Flow': [2829.922, 2910.013, 2877.472, 'USABLE'],
    'Cooler Fan 12 Flow': [1000.283, 1134.228, 1077.141, 'USABLE'],
    'Cooler Fan 13 Flow': [1141.173, 1227.019, 1180.593, 'USABLE'],
  },
  '440460': {
    'Kiln feed': [448.404, 453.944, 451.72, 'USABLE'],
    'Kiln RPM': [3.22, 3.222, 3.221, 'DROP'],
    'Kiln Coal': [20.766, 22.443, 21.349, 'USABLE'],
    'PC Coal': [22.129, 24.148, 23.903, 'USABLE'],
    'Solid AFR': [8.214, 9.687, 9.108, 'USABLE'],
    'Burning Zone Temp': [1162.124, 1201.377, 1180.533, 'USABLE'],
    'TAD Temperature': [886.937, 930.853, 902.194, 'USABLE'],
    'Secondary Air Temp': [1054.306, 1106.539, 1079.813, 'USABLE'],
    'PC Outlet Temp': [50.492, 54.746, 52.22, 'FLAG'],
    'Cooler Fan 1 Flow': [188.127, 192.739, 190.382, 'USABLE'],
    'Cooler Fan 2 Flow': [185.186, 191.655, 188.263, 'USABLE'],
    'Cooler Fan 3 Flow': [330.151, 359.552, 343.774, 'USABLE'],
    'Cooler Fan 4 Flow': [293.642, 309.791, 301.394, 'USABLE'],
    'Cooler Fan 5 Flow': [708.369, 719.333, 713.137, 'USABLE'],
    'Cooler Fan 6 Flow': [1129.357, 1244.576, 1194.024, 'USABLE'],
    'Cooler Fan 7 Flow': [2132.807, 2255.629, 2205.105, 'USABLE'],
    'Cooler Fan 9 Flow': [2972.504, 3174.692, 3067.829, 'USABLE'],
    'Cooler Fan 10 Flow': [2839.921, 3227.433, 3013.891, 'USABLE'],
    'Cooler Fan 11 Flow': [972.452, 1162.38, 1066.565, 'USABLE'],
    'Cooler Fan 12 Flow': [1143.455, 1231.566, 1192.607, 'USABLE'],
    'Cooler Fan 13 Flow': [1219.106, 1307.122, 1258.488, 'USABLE'],
  },
  '460480': {
    'Kiln feed': [465.111, 471.468, 468.709, 'USABLE'],
    'Kiln RPM': [3.062, 3.104, 3.081, 'DROP'],
    'Kiln Coal': [21.885, 24.066, 22.887, 'USABLE'],
    'PC Coal': [20.016, 21.88, 21.215, 'USABLE'],
    'Solid AFR': [10.841, 14.519, 12.909, 'USABLE'],
    'Burning Zone Temp': [1119.06, 1207.808, 1183.878, 'USABLE'],
    'TAD Temperature': [822.868, 845.845, 833.201, 'USABLE'],
    'Secondary Air Temp': [1024.557, 1086.458, 1058.727, 'USABLE'],
    'Cooler Fan 1 Flow': [191.562, 200.055, 196.686, 'USABLE'],
    'Cooler Fan 2 Flow': [199.158, 207.433, 203.692, 'USABLE'],
    'Cooler Fan 3 Flow': [341.045, 367.005, 356.948, 'USABLE'],
    'Cooler Fan 4 Flow': [297.384, 310.12, 303.705, 'USABLE'],
    'Cooler Fan 5 Flow': [718.637, 725.565, 722.246, 'USABLE'],
    'Cooler Fan 6 Flow': [1123.627, 1215.44, 1153.512, 'USABLE'],
    'Cooler Fan 7 Flow': [3519.846, 3519.933, 3519.892, 'USABLE'],
    'Cooler Fan 9 Flow': [1440.244, 1735.969, 1588.845, 'USABLE'],
    'Cooler Fan 10 Flow': [2162.622, 2277.347, 2215.431, 'USABLE'],
    'Cooler Fan 11 Flow': [2702.805, 2779.755, 2735.166, 'USABLE'],
    'Cooler Fan 12 Flow': [955.68, 1102.142, 1036.413, 'USABLE'],
    'Cooler Fan 13 Flow': [1086.914, 1178.434, 1136.23, 'USABLE'],
  },
  '480500': {
    'Kiln feed': [485.178, 490.394, 487.417, 'USABLE'],
    'Kiln RPM': [3.367, 3.429, 3.398, 'DROP'],
    'Kiln Coal': [20.769, 22.461, 21.614, 'USABLE'],
    'PC Coal': [19.378, 19.473, 19.428, 'USABLE'],
    'Solid AFR': [13.533, 15.11, 14.617, 'USABLE'],
    'Burning Zone Temp': [1145.656, 1181.78, 1164.058, 'USABLE'],
    'TAD Temperature': [850.769, 918.719, 879.1, 'USABLE'],
    'Secondary Air Temp': [1073.14, 1115.114, 1094.477, 'USABLE'],
    'Cooler Fan 1 Flow': [194.395, 200.363, 196.665, 'USABLE'],
    'Cooler Fan 2 Flow': [197.463, 209.435, 204.268, 'USABLE'],
    'Cooler Fan 3 Flow': [361.225, 378.221, 370.338, 'USABLE'],
    'Cooler Fan 4 Flow': [304.008, 313.474, 308.401, 'USABLE'],
    'Cooler Fan 5 Flow': [729.302, 739.639, 735.693, 'USABLE'],
    'Cooler Fan 6 Flow': [1044.742, 1324.942, 1133.536, 'USABLE'],
    'Cooler Fan 7 Flow': [3519.853, 3519.956, 3519.902, 'USABLE'],
    'Cooler Fan 9 Flow': [1434.484, 1648.902, 1539.586, 'USABLE'],
    'Cooler Fan 10 Flow': [2148.725, 2279.234, 2197.36, 'USABLE'],
    'Cooler Fan 11 Flow': [2776.635, 2823.955, 2798.983, 'USABLE'],
    'Cooler Fan 12 Flow': [992.445, 1142.299, 1047.847, 'USABLE'],
    'Cooler Fan 13 Flow': [1103.836, 1218.474, 1144.937, 'USABLE'],
  },
  '500520': {
    'Kiln feed': [502.285, 511.849, 505.085, 'USABLE'],
    'Kiln RPM': [3.319, 3.495, 3.448, 'DROP'],
    'Kiln Coal': [20.508, 22.623, 21.783, 'USABLE'],
    'PC Coal': [28.588, 29.354, 28.747, 'USABLE'],
    'Solid AFR': [14.509, 16.802, 15.743, 'USABLE'],
    'Burning Zone Temp': [1060.758, 1111.558, 1091.015, 'USABLE'],
    'TAD Temperature': [853.742, 871.597, 861.929, 'USABLE'],
    'Secondary Air Temp': [1055.355, 1089.313, 1073.022, 'USABLE'],
    'Cooler Fan 1 Flow': [190.971, 197.602, 193.389, 'USABLE'],
    'Cooler Fan 2 Flow': [237.944, 244.212, 241.262, 'USABLE'],
    'Cooler Fan 3 Flow': [347.716, 355.63, 351.293, 'USABLE'],
    'Cooler Fan 4 Flow': [311.672, 324.764, 317.627, 'USABLE'],
    'Cooler Fan 5 Flow': [746.981, 761.316, 754.517, 'USABLE'],
    'Cooler Fan 6 Flow': [1621.24, 1656.312, 1636.854, 'USABLE'],
    'Cooler Fan 7 Flow': [1477.452, 1510.343, 1494.54, 'USABLE'],
    'Cooler Fan 9 Flow': [1830.05, 1911.712, 1875.062, 'USABLE'],
    'Cooler Fan 10 Flow': [1439.122, 1550.438, 1505.044, 'USABLE'],
    'Cooler Fan 11 Flow': [1229.949, 1254.853, 1244.067, 'USABLE'],
    'Cooler Fan 12 Flow': [1223.82, 1258.789, 1239.418, 'USABLE'],
    'Cooler Fan 13 Flow': [1437.356, 1474.041, 1456.885, 'USABLE'],
  },
  '520565': {
    'Kiln feed': [525.475, 527.93, 526.785, 'USABLE'],
    'Kiln RPM': [3.643, 3.818, 3.79, 'DROP'],
    'Kiln Coal': [24.593, 26.521, 25.585, 'USABLE'],
    'PC Coal': [27.007, 27.731, 27.237, 'USABLE'],
    'Solid AFR': [10.579, 14.086, 12.479, 'USABLE'],
    'Burning Zone Temp': [1131.546, 1160.559, 1148.714, 'USABLE'],
    'TAD Temperature': [890.635, 912.4, 902.536, 'USABLE'],
    'Secondary Air Temp': [1068.831, 1092.876, 1082.9, 'USABLE'],
    'Cooler Fan 1 Flow': [196.069, 202.399, 199.155, 'USABLE'],
    'Cooler Fan 2 Flow': [243.183, 248.584, 245.685, 'USABLE'],
    'Cooler Fan 3 Flow': [375.038, 386.74, 381.107, 'USABLE'],
    'Cooler Fan 4 Flow': [317.778, 329.538, 322.737, 'USABLE'],
    'Cooler Fan 5 Flow': [761.025, 771.986, 765.839, 'USABLE'],
    'Cooler Fan 6 Flow': [1624.256, 1742.334, 1678.943, 'USABLE'],
    'Cooler Fan 7 Flow': [1600.995, 1643.835, 1621.874, 'USABLE'],
    'Cooler Fan 9 Flow': [1850.702, 1981.405, 1910.85, 'USABLE'],
    'Cooler Fan 10 Flow': [1618.736, 1757.686, 1692.938, 'USABLE'],
    'Cooler Fan 11 Flow': [916.358, 938.601, 928.74, 'USABLE'],
    'Cooler Fan 12 Flow': [1240.111, 1275.655, 1256.636, 'USABLE'],
    'Cooler Fan 13 Flow': [1456.008, 1493.687, 1478.753, 'USABLE'],
  },
}

const TABLE = Object.fromEntries(
  Object.entries(ROWS).map(([bin, params]) => [
    bin,
    Object.fromEntries(Object.entries(params).map(([name, r]) => [name, { lsl: r[0], usl: r[1], target: r[2], status: r[3] }])),
  ]),
)

/**
 * The rows the Executive View reports, in this order, by the file's parameter name: the kiln
 * operation set the plant asked for, then the cooler fans one by one (the file has no total, and
 * no flow for fan 8).
 */
const BIN_PARAMETERS: readonly string[] = [
  'Burning Zone Temp',
  'Secondary Air Temp',
  'TAD Temperature',
  'PC Outlet Temp',
  'Solid AFR',
  'PC Coal',
  'Kiln Coal',
  'Kiln RPM',
  'Kiln feed',
  ...[1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13].map((n) => `Cooler Fan ${n} Flow`),
]

/** The file's rows as the bin-limits spec of the Adani process device. */
export function adaniBinLimits(processDevice: string): BinLimitsSpec {
  // The file's parameter names → ADANI_RAW D-tags, by the tag map's labels. Unmatched names are left out.
  const byLabel = new Map(Object.entries(RAW_TAGS).map(([id, t]) => [t.label.toLowerCase(), id]))
  const parameters = BIN_PARAMETERS.flatMap((name) => {
    const id = byLabel.get(name.toLowerCase())
    return id ? [{ name, ref: { devID: processDevice, sensorId: id } }] : []
  })
  return {
    binRole: 'kilnFeed',
    bins: TPH_BINS,
    source: BIN_LIMITS_SOURCE,
    thresholds: { good: 68, attention: 50 },
    parameters,
    table: TABLE,
  }
}
