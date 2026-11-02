/**
 * Browser smoke test.
 *
 * The dashboard is driven through a real Chromium against the dev server. API responses
 * are served from payloads captured verbatim from the live platform (ADANI_LAB,
 * ADANI_RAW and insight INS_df1b3c1a11de), because no browser-usable session token is
 * available in this environment — see the notes in iosense.md.
 *
 * Run:  node src/tests/e2e.mjs [baseURL]
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5179'
const SHOTS = process.argv[3] ?? '/tmp/c3s-shots'
mkdirSync(SHOTS, { recursive: true })

/* ---- payloads captured from the live platform ---- */

/*
 * Two results captured verbatim from insight INS_df1b3c1a11de ("C3S RCA Action",
 * 2026-10-22). Only the event timestamps were moved onto the lab-fixture day below so the
 * events fall inside the plotted window; every other field is as returned.
 */
const RCA_RESULTS = [
  {
    "_id": "6ada4f3afcea51b839044867",
    "insightID": "INS_df1b3c1a11de",
    "applicationID": "690345825cf0d48c84c7e63a",
    "applicationAliasID": "applicationID_993090",
    "applicationType": "Workbench",
    "resultName": "C3S RCA Action",
    "result": {
      "rca": {
        "root_cause": {
          "Kiln feed LSF": "Kiln feed LSF high: 105.9 against target 105.0 (watch)",
          "SHC": "SHC low: 729 kcal/kg against target 773 kcal/kg (watch)",
          "Fuel ash": "Fuel ash low: 4.85 against target 5.01 (watch)",
          "TSR": "TSR low: 12.6% against 13.1% in this feed bin's best period"
        },
        "recommendations": {
          "Raw mix": "No proportions advised (material balance does not close).",
          "Kiln coal": "Reduce Kiln coal from 27.9 to 25.7 t/h (-2.2 t/h), limits 23.3 to 24.7 t/h.",
          "Solid AFR": "Increase Solid AFR from 15.3 to 15.8 t/h (+0.5 t/h), limits 13.7 to 15.8 t/h.",
          "Kiln feed": "Increase Kiln feed from 481.3 to 486.1 t/h (+4.8 t/h), limits 492.8 to 498.2 t/h."
        },
        "outcome": {
          "Fuel and feed": "TSR 12.6% to 13.5%, SHC 747 to 712 kcal/kg."
        },
        "time": "2026-08-18 19:30:00",
        "batch_end": "2026-08-18 19:45:00",
        "direction": "high",
        "c3s": 41.947379999999974,
        "c3s_gap": 2.0977300000000128,
        "primary_cause": null,
        "why": [
          "Kiln feed LSF high: 105.9 against target 105.0 (watch)",
          "SHC low: 729 kcal/kg against target 773 kcal/kg (watch)",
          "Fuel ash low: 4.85 against target 5.01 (watch)",
          "TSR low: 12.6% against 13.1% in this feed bin's best period"
        ],
        "do": [
          "Raw mix: no proportions advised (material balance does not close)",
          "Kiln coal: 27.9 to 25.7 t/h (-2.2)",
          "Solid AFR: 15.3 to 15.8 t/h (+0.5)",
          "Kiln feed: 481.3 to 486.1 t/h (+4.8)"
        ],
        "result": [
          "Fuel and feed: TSR 12.6% to 13.5%, SHC 747 to 712 kcal/kg"
        ],
        "notes": [
          "Kiln coal, PC coal, Kiln feed stay outside their K05 limits after this step (one step is capped by the plant's own 15-minute move); repeat after the next lab.",
          "Air-side effects (secondary air, O2, cooler) are not checked: no cooler tags in the Adani data."
        ]
      },
      "as_of": "2026-10-22 23:20"
    },
    "insightProperty": [],
    "metadata": {
      "dataSource": []
    },
    "tags": [
      "C3S RCA Action",
      "higher_than_target",
      "Adani"
    ],
    "invocationTime": "2026-08-18T14:00:00.000Z"
  },
  {
    "_id": "6ada4f380cf53ca8ed5e0fed",
    "insightID": "INS_df1b3c1a11de",
    "applicationID": "690345825cf0d48c84c7e63a",
    "applicationAliasID": "applicationID_993090",
    "applicationType": "Workbench",
    "resultName": "C3S RCA Action",
    "result": {
      "rca": {
        "root_cause": {
          "Fuel ash": "Fuel ash high: 6.15 against target 5.01 (cause)",
          "TSR": "TSR low: 13.1% against 13.1% in this feed bin's best period"
        },
        "recommendations": {
          "Kiln coal": "Reduce Kiln coal from 28.0 to 25.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h."
        },
        "outcome": {
          "Fuel and feed": "TSR 13.1% to 13.7%, SHC 741 to 709 kcal/kg."
        },
        "time": "2026-08-18 13:01:00",
        "batch_end": "2026-08-18 13:15:00",
        "direction": "low",
        "c3s": 37.344640000000005,
        "c3s_gap": -2.505009999999956,
        "primary_cause": "Fuel Ash Addition",
        "why": [
          "Fuel ash high: 6.15 against target 5.01 (cause)",
          "TSR low: 13.1% against 13.1% in this feed bin's best period"
        ],
        "do": [
          "Kiln coal: 28.0 to 25.6 t/h (-2.3)"
        ],
        "result": [
          "Fuel and feed: TSR 13.1% to 13.7%, SHC 741 to 709 kcal/kg"
        ],
        "notes": [
          "Kiln coal, Solid AFR, Kiln feed stay outside their K05 limits after this step (one step is capped by the plant's own 15-minute move); repeat after the next lab.",
          "Air-side effects (secondary air, O2, cooler) are not checked: no cooler tags in the Adani data."
        ]
      },
      "as_of": "2026-10-22 23:20"
    },
    "insightProperty": [],
    "metadata": {
      "dataSource": []
    },
    "tags": [
      "C3S RCA Action",
      "lower_than_target",
      "Adani"
    ],
    "invocationTime": "2026-08-18T07:45:00.000Z"
  },
]

/** Rows captured from getDataByStEt for ADANI_LAB over 2026-08-18. */
const LAB_ROWS = [
  { time: '2026-08-18T00:00:00.000Z', D56: 0, D55: 39.832, D57: 4.384, D52: 2.676, D54: 0, D53: 1.707 },
  { time: '2026-08-18T01:30:00.000Z', D52: 2.649, D56: 8.568, D53: 1.758, D58: 40.63, D55: 39.856, D57: 4.768, D54: 0.362 },
  { time: '2026-08-18T01:27:00.000Z', D1: 3.09, D17: 35.671, D23: 105.31, D13: 12.57, D16: 42.61, D10: 107.04, D34: 21.84, D45: 49.13, D44: 42.9, D3: 42.56, D0: 12.38, D4: 35.6427, D47: 32.6 },
  { time: '2026-08-18T03:23:00.000Z', D17: 35.6017, D3: 42.57, D29: 2.04, D33: 1.82, D32: 0.09, D31: 0.69, D30: 1.09, D26: 1.29, D27: 0.83, D28: 0.09, D10: 106.93, D44: 43.24, D45: 49.75, D0: 12.41 },
  { time: '2026-08-18T04:01:40.000Z', D48: 25.9, D51: 0.6, D50: 40.34, D49: 1854.2409 },
  { time: '2026-08-18T07:30:00.000Z', D52: 2.859, D55: 40.651, D54: 0.306, D56: 6.76, D57: 4.888, D58: 41.247, D53: 1.723 },
  { time: '2026-08-18T09:30:00.000Z', D56: 6.662, D52: 2.847, D58: 40.957, D55: 40.878, D54: 0.358, D57: 4.929, D53: 1.724 },
  { time: '2026-08-18T11:22:00.000Z', D4: 35.7033, D10: 105.23, D33: 1.85, D32: 0.09, D31: 0.62, D30: 1.1, D26: 1.26, D27: 0.63, D28: 0.09, D29: 1.98, D44: 42.21, D45: 49.46, D34: 21.84, D0: 12.6 },
  { time: '2026-08-18T11:30:00.000Z', D56: 10.774, D57: 5.189, D58: 40.087, D53: 1.747, D54: 0.571, D52: 2.871, D55: 40.734 },
  { time: '2026-08-18T13:30:00.000Z', D53: 1.772, D57: 5.403, D56: 12.472, D54: 0.665, D55: 40.015, D58: 37.4, D52: 2.966 },
  { time: '2026-08-18T15:30:00.000Z', D52: 2.851, D53: 1.688, D58: 39.381, D57: 4.824, D56: 6.147, D55: 40.24, D54: 0.285 },
  { time: '2026-08-18T17:30:00.000Z', D57: 5.335, D52: 2.838, D53: 1.722, D56: 14.623, D54: 0.775, D58: 40.259, D55: 39.7 },
  { time: '2026-08-18T18:29:24.000Z', D46: 4207.8598 },
  { time: '2026-08-18T19:30:00.000Z', D55: 40.116, D52: 2.844, D58: 42.3, D53: 1.738, D57: 5.258, D54: 0.676, D56: 12.605 },
  { time: '2026-08-18T21:15:00.000Z', D54: 0.365, D55: 40.051, D58: 39.72, D52: 2.922, D53: 1.737, D56: 7.147, D57: 5.024 },
  { time: '2026-08-18T23:30:00.000Z', D57: 4.927, D56: 5.774, D53: 1.725, D45: 49.93, D58: 40.986, D44: 43.25, D23: 105.66, D10: 107.15, D55: 39.861, D34: 21.82, D37: 63.27, D0: 12.48 },
]

/*
 * A result in the newer format that carries `zone` (insight INS_df1b3c1a11de, "C3S RCA
 * Action Zone", 2026-10-26). As above, only the event timestamps were moved onto the
 * fixture day.
 */
const RCA_ZONE_RESULT = {
  "_id": "6adee6b96ef9b41b70f92fa7",
  "insightID": "INS_df1b3c1a11de",
  "resultName": "C3S RCA Action Zone",
  "result": {
    "rca": {
      "root_cause": {
        "Overlimed": "lime level 44.6 against target 43.0 (C3S 43.6, free lime 1.74%).",
        "Kiln feed LSF high": "105.5 against normal 104.5 (watch).",
        "TSR low": "6.4% against bin target 13.2% (below LSL 12.7%; K05 bin 478 to 501 t/h).",
        "Kiln coal high": "28.6 t/h against bin target 24.0 t/h (above USL 24.7 t/h; K05 bin 478 to 501 t/h).",
        "PC coal low": "18.7 t/h against bin target 19.9 t/h (below LSL 19.5 t/h; K05 bin 478 to 501 t/h).",
        "Solid AFR low": "6.7 t/h against bin target 14.9 t/h (below LSL 13.7 t/h; K05 bin 478 to 501 t/h).",
        "Kiln share of coal high": "61.8% against normal 49.9% (beyond limit).",
        "Coal per t clinker low": "0.151 t/t against normal 0.166 t/t (watch).",
        "Fuel ash high": "5.18% of clinker against normal 4.89% (watch).",
        "Note 9": "Fuel ash split against normal (% of clinker): coal ash quality +0.10, coal rate per t clinker -0.46, AFR ash (inferred) +0.79; coal ash 29.0% against 28.4%.",
        "Cause not confirmed": "these are observed deviations, not proven causes.",
        "Ash fed": "kiln coal 9636 kg/h (normal 8194), PC coal 5946 kg/h (normal 8134), AFR 2557 kg/h (13.2 t/h x 19.4% inferred, not measured); coal ash 33.0% (normal 32.3%)."
      },
      "recommendations": { "Raw mix": "Bauxite 0.9% to 1.1% (+1.0 t/h)." },
      "outcome": {
        "Raw mix": "LSF 105.5 to 104.9, C3S -1.6 (to 42.0 on its own), closes 100% of the gap (predicted)."
      },
      "time": "2026-08-18 21:00:00",
      "batch_end": "2026-08-18 21:07:00",
      "zone": "Overlimed",
      "direction": "high",
      "c3s": 43.6,
      "fcao": 1.74,
      "level": 44.57,
      "c3s_gap": 0.6,
      "targets": { "c3s": 43, "c3s_band": [41.5, 44.5], "lime_level": 43, "free_lime": 1.5, "free_lime_band": [1.2, 1.8] },
      "lime_level_definition": "lime level = C3S + 4.071 x (free lime - 1.5), the C3S the clinker would have at the target free lime",
      "primary_cause": null,
      "confirmed_cause": false,
      "why": ["Overlimed: lime level 44.6 against target 43.0 (C3S 43.6, free lime 1.74%)"],
      "do": ["Raw mix: Limestone 96.7% to 96.5% (-1.0 t/h)", "Raw mix: Bauxite 0.9% to 1.1% (+1.0 t/h)"],
      "result": ["Raw mix: LSF 105.5 to 104.9, C3S -1.6 (to 42.0 on its own), closes 100% of the gap (predicted)"],
      "notes": [
        "K05 bin 478 to 501 t/h, bin target (LSL to USL): kiln feed 495.9 (492.8 to 498.2), kiln coal 24.0 (23.3 to 24.7), PC coal 19.9 (19.5 to 20.0), solid AFR 14.9 (13.7 to 15.8) t/h; total SHC 677 (667 to 688) kcal/kg; TSR 13.2 (12.7 to 13.7)%.",
        "No fuel or feed change: this zone is a lime-level (raw mix) problem and less fuel would not help it."
      ]
    },
    "as_of": "2026-10-26 11:03"
  },
  "tags": ["C3S RCA Action Zone", "higher_than_target", "Adani"],
  "invocationTime": "2026-05-15T19:30:00.000Z"
}

const PROCESS_ROWS = Array.from({ length: 60 }, (_, i) => ({
  time: new Date(Date.parse('2026-08-18T00:00:00.000Z') + i * 24 * 60 * 1000).toISOString(),
  D0: 1225 + Math.sin(i / 4) * 18,
  D2: -4.72 + Math.cos(i / 5) * 0.4,
  D55: 371.46 + Math.sin(i / 3) * 9,
  D13: 3469 + Math.cos(i / 6) * 60,
}))

/*
 * Minute-resolution kiln-operation tags over the fixture day, served only by the Trend Analysis
 * steps: the shared process rows above are 24 min apart and carry few of these tags. BZT D0,
 * Kiln Inlet O2 D71, Kiln RPM D73, Kiln feed D74, PC Coal D75, Kiln Coal D66, PC Outlet Temp
 * D77, Secondary Air D117, Solid AFR D118, TAD Temperature D122, and the 12 cooler fan flows.
 */
const COOLER_FLOWS = ['D9', 'D13', 'D17', 'D21', 'D25', 'D29', 'D33', 'D37', 'D41', 'D45', 'D49', 'D57']
const KILN_ROWS = Array.from({ length: 24 * 60 }, (_, i) => ({
  time: new Date(Date.parse('2026-08-18T00:00:00.000Z') + i * 60 * 1000).toISOString(),
  D0: 1450 + Math.sin(i / 18) * 25,
  D66: 26 + Math.sin(i / 20) * 1.5,
  D71: 3.2 + Math.cos(i / 22) * 0.4,
  D73: 4.2 + Math.sin(i / 40) * 0.1,
  D74: 488 + Math.cos(i / 30) * 6,
  D75: 19.5 + Math.sin(i / 25) * 0.6,
  D77: 875 + Math.cos(i / 16) * 8,
  D117: 1050 + Math.sin(i / 21) * 30,
  D118: 12 + Math.cos(i / 15) * 2,
  D122: 860 + Math.sin(i / 19) * 15,
  ...Object.fromEntries(COOLER_FLOWS.map((id, k) => [id, 20 + k + Math.sin(i / 12 + k) * 0.8])),
}))

/*
 * The zone result again at 10:00, with the action the live insight wrote when it sends the event
 * to the SHC optimizer (see redesign.test.ts) beside the raw-mix move.
 */
const SHC_ACTION =
  'Do not change LSF yet. Compare actual vs expected clinker ash using fuel quality, AFR ash and fuel consumption. Coal rate per t clinker is the main ash driver. SHC optimizer: go to the kiln SHC optimizer. SHC now 852 kcal/kg vs target 703, reduce by 149.'
const RCA_SHC_RESULT = {
  ...RCA_ZONE_RESULT,
  _id: '6adee6b96ef9b41b70f9shc1',
  result: {
    ...RCA_ZONE_RESULT.result,
    rca: {
      ...RCA_ZONE_RESULT.result.rca,
      time: '2026-08-18 10:00:00',
      batch_end: '2026-08-18 10:07:00',
      recommendations: { 'Raw mix': 'Bauxite 0.9% to 1.1% (+1.0 t/h).', Action: SHC_ACTION },
      do: ['Raw mix: Bauxite 0.9% to 1.1% (+1.0 t/h)', SHC_ACTION],
    },
  },
}

/** Merge rows that share a timestamp, so one instant is one row as the real route returns. */
function mergeRows(...sets) {
  const byTime = new Map()
  for (const r of sets.flat()) byTime.set(r.time, { ...byTime.get(r.time), ...r })
  return [...byTime.values()]
}

/*
 * Clinker free lime (D43) for four of the lab samples that carry actual C3S (D58). The captured
 * lab rows have no D43; these values are chosen so the samples land in known zones
 * (07:30Z good clinker, 11:30Z under burnt, 13:30Z underlimed) and are served only by the steps
 * that ask for them.
 */
const FREE_LIME = {
  '2026-08-18T07:30:00.000Z': 1.62,
  '2026-08-18T11:30:00.000Z': 1.95,
  '2026-08-18T13:30:00.000Z': 1.35,
  '2026-08-18T23:30:00.000Z': 1.74,
}
const LAB_ROWS_WITH_FREE_LIME = LAB_ROWS.map((r) => (FREE_LIME[r.time] != null ? { ...r, D43: FREE_LIME[r.time] } : r))

function lastDP(rows, sensors) {
  const data = {}
  for (const s of sensors) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][s] != null) {
        data[s] = { time: rows[i].time, value: rows[i][s] }
        break
      }
    }
    if (!data[s]) data[s] = []
  }
  return data
}

/* ---- run ---- */

const errors = []
const API_GLOB = '**/api/**'
/** Set while deliberately exercising a failure path, so its 404 is not counted. */
let expectingFailures = false

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })

page.on('console', (m) => {
  if (m.type() === 'error' && !expectingFailures) errors.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

/**
 * Mock of the platform's API, behaving like the real one where it matters: the range
 * route returns only rows inside the requested [sTime, eTime], and the insight route
 * honours the requested page. `opts.failInsight` / `opts.failProcess` exercise partial
 * failure; `opts.rcaResults` replaces the insight's results; `opts.kilnRows` adds
 * {@link KILN_ROWS} to the process device; `opts.freeLime` adds clinker free lime to the lab rows;
 * `opts.extraLab` adds lab rows.
 */
const apiHandler = (opts = {}) => async (route) => {
  const rcaResults = opts.rcaResults ?? RCA_RESULTS
  const url = route.request().url()
  const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  if (url.includes('/bruce/insightResult/')) {
    if (opts.failInsight) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, errors: ['Insight not found'] }),
      })
    }
    const { pagination } = JSON.parse(route.request().postData() ?? '{}')
    const pageNo = pagination?.page ?? 1
    return json({
      success: true,
      data: {
        data: pageNo === 1 ? rcaResults : [],
        totalCount: rcaResults.length,
        pagination: { page: pageNo, count: pagination?.count ?? 100, totalPages: 1 },
      },
    })
  }
  if (url.includes('/deviceData/lastDP')) {
    const { devID, sensors } = JSON.parse(route.request().postData() ?? '{}')
    const rows = devID === 'ADANI_LAB' ? LAB_ROWS : PROCESS_ROWS
    return json({ success: true, data: { devID, data: lastDP(rows, sensors ?? []) } })
  }
  const range = /getDataByStEt\/(\w+)\/(\d+)\/(\d+)/.exec(url)
  if (range) {
    const [, devID, s, e] = range
    if (devID === 'ADANI_RAW' && opts.failProcess) {
      return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>502 Bad Gateway</html>' })
    }
    const source =
      devID === 'ADANI_LAB'
        ? [...(opts.freeLime ? LAB_ROWS_WITH_FREE_LIME : LAB_ROWS), ...(opts.extraLab ?? [])]
        : opts.kilnRows ? mergeRows(PROCESS_ROWS, KILN_ROWS) : PROCESS_ROWS
    const rows = source.filter((r) => {
      const t = Date.parse(r.time)
      return t >= Number(s) && t <= Number(e)
    })
    return json({ success: true, data: [...rows].reverse() })
  }
  return json({ success: false, errors: [`unexpected route ${url}`] })
}

await page.route(API_GLOB, apiHandler())

/** Select an RCA event on the analysis tab by stepping the RCA panel's Older / Newer controls. */
async function pickEvent(time) {
  const meta = () => page.locator('.rca__meta').innerText().catch(() => '')
  const newer = page.getByRole('button', { name: 'Newer RCA event' })
  const older = page.getByRole('button', { name: 'Older RCA event' })
  for (let i = 0; i < 50 && (await newer.isEnabled()); i++) await newer.click()
  for (let i = 0; i < 50 && !(await meta()).includes(time); i++) {
    if (!(await older.isEnabled())) break
    await older.click()
  }
  if (!(await meta()).includes(time)) throw new Error(`no RCA event at ${time} in range`)
}

async function openTab(name) {
  await page.getByRole('tab', { name, exact: true }).click()
  await page.waitForTimeout(700)
}

const step = async (name, fn) => {
  process.stdout.write(`• ${name} … `)
  try {
    await fn()
    console.log('ok')
  } catch (err) {
    console.log('FAIL')
    errors.push(`${name}: ${err.message}`)
  }
}

// 1 — login gate
await page.goto(BASE, { waitUntil: 'networkidle' })
await step('login gate renders', async () => {
  await page.getByRole('heading', { name: 'C3S Quality Intelligence' }).waitFor({ timeout: 10_000 })
  await page.getByPlaceholder('Bearer eyJhbGciOi…').waitFor()
})
await page.screenshot({ path: `${SHOTS}/01-login.png` })

// 2 — authenticate and load. The fixtures are Adani's devices, so the Adani line is selected
// (the default for a new visitor is the first plant listed, JSW).
await page.evaluate(() => {
  localStorage.setItem('bearer_token', 'Bearer e2e-test-token')
  localStorage.setItem('c3s.line', JSON.stringify({ plantId: 'adani', lineId: 'line1' }))
})
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

await step('dashboard header renders', async () => {
  await page.locator('.appbar__titles h1').waitFor({ timeout: 10_000 })
  // The Adani Cement logo, loaded, at the top left of the bar.
  const logo = page.getByRole('img', { name: 'Adani Cement' })
  await logo.waitFor()
  const loaded = await logo.evaluate((img) => img.complete && img.naturalWidth > 0)
  if (!loaded) throw new Error('the logo image did not load')
  const box = await logo.boundingBox()
  if (!box || box.x > 40 || box.y > 30 || box.height < 30) throw new Error(`logo should sit at the top left: ${JSON.stringify(box)}`)
})

await step('Executive View is the first tab, at the top left, and is selected on load', async () => {
  const tabs = page.getByRole('tab')
  const names = await tabs.allInnerTexts()
  if (names[0] !== 'Executive View') throw new Error(`first tab should be Executive View, got: ${names.join(' | ')}`)
  if (!names.includes('C3S Analysis')) throw new Error('the existing dashboard tab is missing')
  if ((await tabs.first().getAttribute('aria-selected')) !== 'true') throw new Error('Executive View is not selected on load')
  const a = await tabs.nth(0).boundingBox()
  const b = await tabs.nth(1).boundingBox()
  const bar = await page.locator('.appbar').boundingBox()
  if (!a || !b || !bar) throw new Error('tab geometry unavailable')
  if (a.x >= b.x) throw new Error('Executive View is not the left-most tab')
  if (a.y < bar.y + bar.height - 1 || a.y > bar.y + bar.height + 60) throw new Error('tab strip is not directly under the header')
  if ((await page.locator('.exec').count()) !== 1) throw new Error('the Executive View is not rendered')
  if ((await page.locator('.kpis').count()) !== 0) throw new Error('analysis content leaked into the Executive View')
})

await step('switching tabs shows each view on its own', async () => {
  await openTab('C3S Analysis')
  if ((await page.locator('.analysis__main').count()) !== 1) throw new Error('C3S Analysis did not render its two-column section')
  if ((await page.locator('.exec').count()) !== 0) throw new Error('Executive View still rendered on the analysis tab')
  if ((await page.getByRole('tab', { name: 'C3S Analysis' }).getAttribute('aria-selected')) !== 'true') throw new Error('analysis tab not selected')
})

await step('timeline plots both series', async () => {
  await page.locator('.highcharts-container').waitFor({ timeout: 15_000 })
  // Series 0 is the predicted line, series 1 the actual lab line.
  if ((await page.locator('.highcharts-series-0 .highcharts-graph').count()) === 0) throw new Error('no predicted line')
  if ((await page.locator('.highcharts-series-1 .highcharts-graph').count()) === 0) throw new Error('no actual line')
  const legend = await page.locator('.legend').innerText()
  if (!legend.includes('Actual C3S (Lab)') || !legend.includes('Predicted C3S')) {
    throw new Error(`legend should name the series, got: ${legend}`)
  }
  if (/\bD5[58]\b/.test(legend)) throw new Error('legend shows a raw sensor id')
  if (await page.locator('.highcharts-plot-band').count()) throw new Error('a band was drawn but the insight supplies none')
})

// Flags are computed against the acceptable band, which the insight no longer supplies.
await step('no out-of-band flags are drawn without a band', async () => {
  // With no band there is nothing to compare against, so no point is coloured as out of range.
  if ((await page.locator('.highcharts-plot-band').count()) !== 0) throw new Error('band drawn with no band to compare against')
})

await page.screenshot({ path: `${SHOTS}/02a-viewport-top.png` })

await step('the dashboard fills the viewport width', async () => {
  const root = await page.locator('#root').boundingBox()
  if (!root) throw new Error('#root not found')
  const vw = page.viewportSize().width
  if (root.width < vw - 2) {
    throw new Error(`#root is ${root.width}px in a ${vw}px viewport — a width cap is still applied`)
  }
})

await step('the sticky header does not cover the first content row', async () => {
  const bar = await page.locator('.appbar').boundingBox()
  const panel = await page.locator('.panel').first().boundingBox()
  if (!bar || !panel) throw new Error('layout boxes unavailable')
  if (panel.y < bar.y + bar.height - 1) {
    throw new Error('first panel starts underneath the sticky header')
  }
})

await step('the trend header stats use readable names and keep the full reference in the tooltip', async () => {
  const labels = await page.locator('.stat__label').allInnerTexts()
  for (const want of ['Predicted C3S', 'Actual C3S (Lab)', 'Prediction error']) {
    if (!labels.some((l) => l.includes(want))) throw new Error(`missing stat "${want}" in: ${labels.join(' | ')}`)
  }
  // C3S is reported as actual and predicted only; the clinker Bogue C3S (D44) is not shown.
  if (labels.some((l) => l.includes('Clinker C3S'))) throw new Error(`a third C3S is shown: ${labels.join(' | ')}`)
  if (labels.some((l) => /ADANI_|\bD\d+\b/.test(l))) throw new Error(`a stat label shows a raw reference: ${labels.join(' | ')}`)
  const titles = (await page.locator('.stat').evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''))).join(' ')
  for (const want of ['ADANI_LAB:D55', 'ADANI_LAB:D58']) {
    if (!titles.includes(want)) throw new Error(`missing tooltip reference ${want}`)
  }
  if (titles.includes('ADANI_LAB:D44')) throw new Error('D44 is still referenced')
})

await step('no emoji or decorative icons are rendered', async () => {
  const text = await page.locator('body').innerText()
  const hit = text.match(/\p{Extended_Pictographic}/u)
  if (hit) throw new Error(`emoji found: ${hit[0]}`)
  if ((await page.locator('.panel__icon').count()) !== 0) throw new Error('icon slots still rendered')
})

await step('the removed explanatory text and controls are not rendered', async () => {
  const text = await page.locator('body').innerText()
  for (const gone of [
    'Drag to zoom into a time span',
    'lab samples ·',
    'predictions awaiting a lab result',
    'matched within',
    'Each value is the latest laboratory sample',
    'parameters reporting in the selected range',
    'Hide parameters with no measurement',
    'Alignment is visual only',
    'Group assignment',
  ]) {
    if (text.includes(gone)) throw new Error(`"${gone}" is still on the page`)
  }
  if (await page.locator('.seg, .timeline__stats, .lab__toolbar, .lab__note, .process__note, .process__marker-note').count()) {
    throw new Error('a removed element is still in the DOM')
  }
})

await step('the RCA panel counts the analysed deviations and steps through them, newest first', async () => {
  await page.locator('.event-nav').waitFor()
  if ((await page.locator('.panel', { hasText: 'Last RCA Events' }).count()) !== 0) throw new Error('the Last RCA Events panel should be gone')
  const nav = await page.locator('.event-nav').innerText()
  if (!nav.includes('2 in range') || !nav.includes('1 of 2')) throw new Error(`event stepper: ${nav}`)
  if (await page.getByRole('button', { name: 'Newer RCA event' }).isEnabled()) throw new Error('the newest event has nothing newer')
  if (!(await page.getByRole('button', { name: 'Older RCA event' }).isEnabled())) throw new Error('an older event exists')
})

// Rows are newest-first, so row 0 is the 19:30 high-C3S event (no primary cause) and
// row 1 is the 13:01 low-C3S event whose primary cause is Fuel Ash Addition.
await step('defaults to the newest deviation and shows its recommendations', async () => {
  await page.locator('.rec').waitFor()
  const body = await page.locator('.rca').innerText()
  if (!body.includes('The insight names no primary cause')) throw new Error('missing-primary-cause state not stated plainly')
  // The summary carries exactly four facts, and no validation boilerplate.
  const dts = await page.locator('.rca__meta dt').allInnerTexts()
  if (dts.map((t) => t.toLowerCase()).join('|') !== 'event time|predicted c3s|actual c3s (lab)|free lime') {
    throw new Error(`RCA summary fields: ${dts.join(' | ')}`)
  }
  if (/not confirmed|validat/i.test(body)) throw new Error('validation statements should not be shown')
  const rec = await page.locator('.rec').innerText()
  const items = await page.locator('.rec__action').count()
  if (items < 2) throw new Error(`expected the insight's recommendations, got ${items}`)
  if (!/Kiln coal/.test(rec) || !/27\.9\s*→\s*25\.7/.test(rec)) throw new Error(`current → suggested not shown: ${rec}`)
  if (rec.includes('No set-point change is recommended')) throw new Error('says "no change" although the insight advises changes')
  if (/confidence\D{0,12}\d/i.test(body + rec) || /\d+ ?% confidence/i.test(body + rec)) {
    throw new Error('a confidence score was rendered but the insight supplies none')
  }
  // Recommendations sit directly under RCA, at the same width.
  const [a, b] = await Promise.all([
    page.locator('.panel', { hasText: 'Root Cause Analysis' }).first().boundingBox(),
    page.locator('.panel', { has: page.locator('.rec') }).boundingBox(),
  ])
  if (!a || !b || Math.abs(a.width - b.width) > 1 || Math.abs(a.x - b.x) > 1 || b.y < a.y + a.height - 1) {
    throw new Error(`Recommendations should sit under RCA at the same width: ${JSON.stringify({ a, b })}`)
  }
})

await step('selecting the primary-cause event renders why, action, outcome and notes', async () => {
  await pickEvent('13:01')
  await page.waitForTimeout(200)

  const body = await page.locator('.rca').innerText()
  const rec = await page.locator('.rec').innerText()
  if (!body.includes('Fuel Ash Addition')) throw new Error('primary cause not shown')
  // Headings are upper-cased by CSS, so compare case-insensitively.
  if (!/Primary cause and evidence/i.test(body)) throw new Error('missing section Primary cause and evidence')
  if (!/Expected outcome/i.test(rec)) throw new Error('missing section Expected outcome')
  // The insight's notes are not shown under Recommendations.
  if (/Rationale and constraints/i.test(rec) || rec.includes('repeat after the next lab')) {
    throw new Error('Recommendations should not show the rationale and constraints')
  }
  if (!body.includes('Fuel ash high')) throw new Error('root cause text not shown')
  if (!rec.includes('Kiln coal')) throw new Error('recommendation label not shown')
  if (!/Operating limits/i.test(rec)) throw new Error('recommendation limits not shown')
  if (!(await page.locator('.rca__item-label .badge', { hasText: 'cause' }).count())) {
    throw new Error('the "(cause)" grade from the insight is not shown')
  }
  if (/confidence\D{0,12}\d/i.test(body) || /\d+ ?% confidence/i.test(body)) {
    throw new Error('a confidence score was rendered but the insight supplies none')
  }
})

await page.screenshot({ path: `${SHOTS}/02-dashboard.png`, fullPage: true })

await step('lab quality shows the supplied parameter names and units, never a bare sensor id', async () => {
  await page.locator('.lab__grid').waitFor()
  const names = async () =>
    (await page.locator('.lab-cell__name').allInnerTexts()).map((n) => n.replace(/alias not set/i, '').trim())

  // Raw mix: every parameter is named by the lab tag map, so nothing is marked "alias not set".
  const raw = await names()
  for (const want of ['Raw mix SiO2', 'Raw mix Al2O3', 'Raw mix LSF', 'Raw mix AM']) {
    if (!raw.includes(want)) throw new Error(`missing "${want}" in: ${raw.join(' | ')}`)
  }
  if (raw.some((n) => /^D\d+\b/.test(n))) throw new Error(`raw sensor ids shown as names: ${raw.join(', ')}`)
  if (await page.locator('.unverified').count()) throw new Error('a mapped parameter is marked "alias not set"')
  const cell = await page.locator('.lab-cell', { hasText: 'Raw mix SiO2' }).innerText()
  if (!cell.includes('%')) throw new Error(`unit missing on a lab value: ${cell}`)

  await page.locator('.lab__tab', { hasText: 'Clinker Quality' }).click()
  await page.waitForTimeout(300)
  const clinker = await names()
  if (!clinker.includes('Clinker Free CaO')) throw new Error(`missing "Clinker Free CaO" in: ${clinker.join(' | ')}`)
  // D44 / D45 (clinker Bogue C3S) are hidden: C3S is reported as actual and predicted only.
  for (const gone of ['Clinker C3S', 'Clinker C3S (uncorrected)']) {
    if (clinker.includes(gone)) throw new Error(`"${gone}" should not be shown`)
  }

  // The model outputs the lab tag map does not cover are the only ones still without a name.
  await page.locator('.lab__tab', { hasText: 'Model Outputs' }).click()
  await page.waitForTimeout(300)
  const model = await names()
  for (const want of ['Predicted C3S', 'Actual C3S (Lab)', 'Model Outputs & Lab C3S parameter 1']) {
    if (!model.includes(want)) throw new Error(`missing "${want}" in: ${model.join(' | ')}`)
  }
  if ((await page.locator('.unverified').count()) === 0) throw new Error('unnamed model outputs should be marked')
})
await page.screenshot({ path: `${SHOTS}/03-lab.png` })

await step('process monitor is device-scoped and labelled without raw ids', async () => {
  await page.locator('.process__items').waitFor()
  const items = await page.locator('.process__item-name').allInnerTexts()
  const bare = items.filter((n) => /^D\d+$/.test(n.trim()))
  if (bare.length) throw new Error(`raw sensor ids listed as names: ${bare.join(', ')}`)

  // Grouped by the equipment section the process tag map gives each signal.
  const headings = (await page.locator('.process__group').allInnerTexts()).map((h) => h.replace(/\d+$/, '').trim())
  // Headings are upper-cased by CSS.
  if (headings.join('|').toLowerCase() !== 'calciner|kiln|cooler') {
    throw new Error(`expected sections in tag-map order Calciner|Kiln|Cooler, got: ${headings.join('|')}`)
  }
  for (const want of ['Burning Zone Temp', 'Calciner CO Str2', 'Cooler Fan 10 Flow', 'Cooler Fan 9 Amps']) {
    if (!items.includes(want)) throw new Error(`missing process signal "${want}" in: ${items.join(' | ')}`)
  }
  const burning = await page.locator('.process__item', { hasText: 'Burning Zone Temp' }).innerText()
  if (!burning.includes('°C')) throw new Error(`unit missing on a process value: ${burning}`)

  const cooler = page.locator('.process__item', { hasText: 'Cooler Fan 9 Amps' }).first()
  if ((await cooler.getAttribute('title')) !== 'ADANI_RAW:D55') throw new Error('process item not device-scoped')
  await cooler.click()
  await page.waitForTimeout(300)
  const detail = await page.locator('.process__detail').innerText()
  if (!detail.includes('Cooler Fan 9 Amps')) throw new Error('ADANI_RAW:D55 should be Cooler Fan 9 Amps')
  if (detail.includes('Predicted C3S')) throw new Error('D-tag collision leaked across devices')
})
await page.screenshot({ path: `${SHOTS}/04-process.png` })

/* ---- time-range picker helpers ---- */

/** "2026-08-18T08:00" -> the picker's "MM/DD/YYYY" and "HH:mm" fields. */
const toFields = (iso) => {
  const [d, t] = iso.split('T')
  const [y, m, day] = d.split('-')
  return { date: `${m}/${day}/${y}`, time: t }
}
const pickerField = (label) => page.getByLabel(label, { exact: true })
async function openPicker() {
  if (!(await page.locator('.trp__pop').count())) await page.locator('.trp__trigger').click()
  await page.locator('.trp__pop').waitFor()
}
async function closePicker() {
  if (await page.locator('.trp__pop').count()) await page.keyboard.press('Escape')
}
async function typeRange(from, to) {
  const a = toFields(from)
  const b = toFields(to)
  await pickerField('Start date').fill(a.date)
  await pickerField('Start time').fill(a.time)
  await pickerField('End date').fill(b.date)
  await pickerField('End time').fill(b.time)
}
const applyBtn = () => page.getByRole('button', { name: 'Apply' })
async function choosePreset(name) {
  await openPicker()
  await page.getByRole('button', { name: name, exact: true }).click()
  await page.waitForTimeout(900)
  await closePicker()
}
/** The range on screen, read from the picker's own fields: { start: 'MM/DD/YYYY HH:mm', end: ... }. */
async function windowFields() {
  await openPicker()
  return {
    start: `${await pickerField('Start date').inputValue()} ${await pickerField('Start time').inputValue()}`,
    end: `${await pickerField('End date').inputValue()} ${await pickerField('End time').inputValue()}`,
  }
}
const plantDate = () =>
  new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit', year: 'numeric' })

await step('the dashboard opens on the last 7 days', async () => {
  const trigger = (await page.locator('.trp__trigger').innerText()).trim()
  if (trigger !== 'Last 7 Days') throw new Error(`default range should be Last 7 Days, got ${trigger}`)
})

await step('range switch refetches without error', async () => {
  await choosePreset('Last 24 Hours')
  await page.locator('.highcharts-container').waitFor()
})

await step('custom start/end drives the fetched window', async () => {
  // Capture the epochs the app actually requests from the range endpoint.
  const requested = []
  page.on('request', (r) => {
    const m = /getDataByStEt\/(\w+)\/(\d+)\/(\d+)/.exec(r.url())
    if (m) requested.push({ devID: m[1], start: Number(m[2]), end: Number(m[3]) })
  })

  await openPicker()

  // 18 Aug 2026 08:00 → 20:00 Asia/Kolkata = 02:30 → 14:30 UTC.
  await typeRange('2026-08-18T08:00', '2026-08-18T20:00')
  requested.length = 0
  await applyBtn().click()
  await page.waitForTimeout(1200)

  const lab = requested.find((r) => r.devID === 'ADANI_LAB')
  if (!lab) throw new Error('no range request was issued after Apply')

  const wantStart = Date.parse('2026-08-18T02:30:00.000Z')
  const wantEnd = Date.parse('2026-08-18T14:30:00.000Z')
  if (lab.start !== wantStart) throw new Error(`start ${lab.start} !== ${wantStart}`)
  if (lab.end !== wantEnd) throw new Error(`end ${lab.end} !== ${wantEnd}`)

  // The picker must report the window that was actually used.
  const w = await windowFields()
  if (w.start !== '08/18/2026 08:00' || w.end !== '08/18/2026 20:00') {
    throw new Error(`picker does not show the chosen range: ${JSON.stringify(w)}`)
  }
})

await step('an end before the start is refused', async () => {
  await openPicker()
  await pickerField('End date').fill('08/18/2026')
  await pickerField('End time').fill('06:00')
  await applyBtn().click()
  await page.waitForTimeout(300)
  const err = await page.locator('.trp__error').innerText()
  if (!/after the start/i.test(err)) throw new Error(`expected a validation error, got: ${err}`)
  if (!(await page.locator('.trp__pop').count())) throw new Error('panel closed on an invalid range')
})

await step('a bad time or date is reported, and a mistyped date reverts on blur', async () => {
  await pickerField('End time').fill('25:99')
  await applyBtn().click()
  const err = await page.locator('.trp__error').innerText()
  if (!/24-hour time/i.test(err)) throw new Error(`expected a time validation error, got: ${err}`)

  const before = await pickerField('Start date').inputValue()
  await pickerField('Start date').fill('13/45/2026')
  await pickerField('Start date').blur()
  const after = await pickerField('Start date').inputValue()
  if (after !== before) throw new Error(`invalid date should revert to ${before}, got ${after}`)

  // A time typed loosely is tidied on blur.
  await pickerField('End time').fill('9:05')
  await pickerField('End time').blur()
  if ((await pickerField('End time').inputValue()) !== '09:05') throw new Error('time was not normalised to HH:mm')
})

await step('the control shows the zone, the presets and the data they are anchored to', async () => {
  await openPicker()
  const badge = await page.locator('.trp__tz').innerText()
  if (!/GMT\+5:30/.test(badge)) throw new Error(`expected a GMT+5:30 badge, got: ${badge}`)
  const presets = await page.locator('.trp__preset').allInnerTexts()
  for (const want of ['Last 1 Hour', 'Last 6 Hours', 'Last 12 Hours', 'Last 24 Hours', 'Today', 'Yesterday', 'This Week', 'This Month']) {
    if (!presets.includes(want)) throw new Error(`missing preset "${want}" in: ${presets.join(' | ')}`)
  }
  const note = await page.locator('.trp__anchor').innerText()
  if (!note.includes('19 Aug 2026, 05:00')) throw new Error(`anchor note should state the newest data: ${note}`)
})

await step('a "Last" preset is anchored to the newest sample, applies at once and stays open', async () => {
  await page.getByRole('button', { name: 'Last 24 Hours', exact: true }).click()
  await page.waitForTimeout(1000)
  if ((await page.locator('.trp__trigger').innerText()).trim() !== 'Last 24 Hours') throw new Error('trigger does not name the preset')
  const w = await windowFields()
  if (w.end !== '08/19/2026 05:00') throw new Error(`window should end at the newest sample: ${JSON.stringify(w)}`)
  if (!(await page.locator('.trp__pop').count())) throw new Error('panel closed after choosing a preset')
  const active = await page.locator('.trp__preset.is-active').allInnerTexts()
  if (active.length !== 1 || active[0] !== 'Last 24 Hours') throw new Error(`active preset wrong: ${active}`)
  if (!(await applyBtn().isDisabled())) throw new Error('Apply should wait for an edit')
})

await step('calendar presets are plant-local calendar days taken from the current date', async () => {
  const todayLabel = plantDate()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await page.waitForTimeout(1000)
  if ((await page.locator('.trp__trigger').innerText()).trim() !== 'Today') throw new Error('trigger should read Today')
  const w = await windowFields()
  if (w.start !== `${todayLabel} 00:00` || w.end !== `${todayLabel} 23:59`) {
    throw new Error(`Today should span 00:00-23:59 of ${todayLabel}: ${JSON.stringify(w)}`)
  }
  // Yesterday is the single day before it.
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
  await page.waitForTimeout(800)
  if ((await page.locator('.trp__trigger').innerText()).trim() !== 'Yesterday') throw new Error('trigger should read Yesterday')
})

await step('picking a range on the calendar fills the fields, then Apply commits it', async () => {
  await page.getByRole('button', { name: 'Last 24 Hours', exact: true }).click()
  await page.waitForTimeout(800)
  await pickerField('Start date').fill('08/10/2026') // moves the calendar to August
  if (!(await page.locator('.trp__cal-title').innerText()).includes('Aug 2026')) throw new Error('calendar did not follow the typed date')
  if (await applyBtn().isDisabled()) throw new Error('Apply should enable after an edit')

  const hint = () => page.locator('.trp__hint').innerText()
  if (!/start date/i.test(await hint())) throw new Error('should be asking for a start date')
  await page.getByRole('button', { name: '08/12/2026', exact: true }).click()
  if (!/end date/i.test(await hint())) throw new Error('should now ask for an end date')
  await page.getByRole('button', { name: '08/14/2026', exact: true }).click()
  if (!/start date/i.test(await hint())) throw new Error('should return to asking for a start date')
  if ((await pickerField('Start date').inputValue()) !== '08/12/2026') throw new Error('start date not set from the calendar')
  if ((await pickerField('End date').inputValue()) !== '08/14/2026') throw new Error('end date not set from the calendar')

  // Picking the later day first still yields an ordered range.
  await page.getByRole('button', { name: '08/20/2026', exact: true }).click()
  await page.getByRole('button', { name: '08/18/2026', exact: true }).click()
  if ((await pickerField('Start date').inputValue()) !== '08/18/2026' || (await pickerField('End date').inputValue()) !== '08/20/2026') {
    throw new Error('a range picked backwards should be re-ordered')
  }
  const marked = await page.locator('.trp__day.is-start, .trp__day.is-end').count()
  if (marked !== 2) throw new Error(`expected the two range ends to be marked, got ${marked}`)

  await pickerField('Start time').fill('06:00')
  await pickerField('End time').fill('18:30')
  await applyBtn().click()
  await page.waitForTimeout(1000)
  if (await page.locator('.trp__pop').count()) throw new Error('panel should close on Apply')
  const trig = (await page.locator('.trp__trigger').innerText()).trim()
  if (trig !== '18 Aug, 06:00 – 20 Aug, 18:30') throw new Error(`trigger should show the range, got: ${trig}`)
  const w = await windowFields()
  if (w.start !== '08/18/2026 06:00' || w.end !== '08/20/2026 18:30') throw new Error(`window not applied: ${JSON.stringify(w)}`)
  await closePicker()
})

await step('"Now" sets the end, and Cancel, Escape and a click outside discard edits', async () => {
  await openPicker()
  await pickerField('End date').fill('08/21/2026')
  await page.getByRole('button', { name: 'Now', exact: true }).click()
  const nowDate = new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit', year: 'numeric',
  })
  if ((await pickerField('End date').inputValue()) !== nowDate) throw new Error('Now did not set the end to today')

  const trigBefore = (await page.locator('.trp__trigger').innerText()).trim()
  await page.getByRole('button', { name: 'Cancel' }).click()
  if (await page.locator('.trp__pop').count()) throw new Error('Cancel should close the panel')
  if ((await page.locator('.trp__trigger').innerText()).trim() !== trigBefore) throw new Error('Cancel must not change the range')

  await openPicker()
  await page.keyboard.press('Escape')
  if (await page.locator('.trp__pop').count()) throw new Error('Escape should close the panel')

  await openPicker()
  await page.mouse.click(5, 600)
  if (await page.locator('.trp__pop').count()) throw new Error('a click outside should close the panel')
})

await openPicker()
await page.screenshot({ path: `${SHOTS}/07-time-picker-open.png` })
await closePicker()
await page.waitForTimeout(200)
await page.screenshot({ path: `${SHOTS}/07-time-picker-closed.png` })

// Fixture times (IST wall clock): events at 13:01 and 19:30 on 18 Aug 2026.
const labCount = (sensor, fromIso, toIso) =>
  LAB_ROWS.filter((r) => r[sensor] != null && Date.parse(r.time) >= Date.parse(fromIso) && Date.parse(r.time) <= Date.parse(toIso)).length

async function applyRange(from, to) {
  await openPicker()
  await typeRange(from, to)
  await applyBtn().click()
  await page.waitForTimeout(900)
}

await step('the global picker drives the chart, KPIs, lab grid and deviation list together', async () => {
  // 14:00–20:00 IST = 08:30–14:30 UTC: contains only the 19:30 IST event.
  await applyRange('2026-08-18T14:00', '2026-08-18T20:00')
  await page.locator('.highcharts-container').waitFor()
  const wantActual = labCount('D58', '2026-08-18T08:30:00Z', '2026-08-18T14:30:00Z')
  const plotted = await page.locator('.highcharts-series-1 .highcharts-point').count()
  if (plotted !== wantActual) {
    throw new Error(`chart plots ${plotted} lab samples, the fixture window has ${wantActual}`)
  }
  const nav = await page.locator('.event-nav').innerText()
  if (!nav.includes('1 in range') || !nav.includes('1 of 1')) throw new Error(`events not windowed: ${nav}`)
  if (!(await page.locator('.rca__meta').innerText()).includes('19:30')) throw new Error('expected exactly the 19:30 event')

  // The stats describe the window: the latest actual C3S inside it is the 13:30Z sample (37.40).
  const stat = await page.locator('.stat', { hasText: 'Actual C3S (Lab)' }).innerText()
  if (!stat.includes('37.40')) throw new Error(`stat is not the in-window value: ${stat}`)
})

await step('event times are shown in plant time and line up with the axis', async () => {
  const meta = await page.locator('.rca__meta').innerText()
  if (!/19:30/.test(meta)) throw new Error(`RCA event time should read 19:30 IST, got: ${meta}`)
  // The event (19:30 IST = 14:00Z) must pair with a lab sample inside +/-4 h, not 5.5 h away.
  const lab = await page.locator('.rca__meta div', { hasText: 'Actual C3S (lab)' }).locator('dd').innerText()
  if (!/\d+\.\d+%/.test(lab)) throw new Error(`event not aligned to a lab sample: ${lab}`)
})

await step('a range with no deviations says so instead of showing stale ones', async () => {
  await applyRange('2026-08-18T08:00', '2026-08-18T12:00')
  const txt = await page.locator('.app__main').innerText()
  if (!txt.includes('No analysed deviations in the selected range')) throw new Error('empty-range message missing')
  if (txt.includes('Fuel Ash Addition')) throw new Error('a deviation outside the range is still shown')
})

await step('chart axis labels carry dates on a multi-day range', async () => {
  await applyRange('2026-08-10T00:00', '2026-08-19T00:00')
  const ticks = await page
    .locator('.highcharts-xaxis-labels text')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()).filter(Boolean))
  // Day-sized steps on a 9-day range: the labels are dates, not bare clock times.
  if (!ticks.length || !ticks.some((t) => /[A-Z][a-z]{2}/.test(t))) {
    throw new Error(`ticks should include the date: ${ticks.join(' | ')}`)
  }
  if (ticks.some((t) => /\b(AM|PM)\b/.test(t))) throw new Error(`axis should use a 24-hour clock: ${ticks.join(' | ')}`)
})

await step('the C3S trend zooms horizontally and can be reset', async () => {
  await applyRange('2026-08-18T00:00', '2026-08-19T06:00')
  await page.locator('.highcharts-container').waitFor()
  const labels = () =>
    page.locator('.highcharts-xaxis-labels text').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()).filter(Boolean).sort().join('|'))
  const resetBtn = page.getByRole('button', { name: 'Reset zoom' })

  const full = await labels()
  if (await resetBtn.count()) throw new Error('reset shown before any zoom')

  // Earlier steps scroll the page; a drag that starts under the sticky header zooms nothing.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  const box = await page.locator('.highcharts-plot-background').boundingBox()
  if (!box) throw new Error('plot area not found')
  const y = box.y + box.height / 2

  // Drag-zoom into the middle of the range.
  await page.mouse.move(box.x + box.width * 0.4, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const dragged = await labels()
  if (dragged === full) throw new Error('drag did not zoom the x axis')
  if (!(await resetBtn.count())) throw new Error('no reset control after zooming')

  // The wheel zooms further about the cursor.
  await page.mouse.move(box.x + box.width * 0.5, y)
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(500)
  if ((await labels()) === dragged) throw new Error('wheel did not zoom')

  // Choosing an event keeps the user's zoom.
  const before = await labels()
  const step1 = page.locator('.event-nav button:not([disabled])').first()
  if (await step1.count()) await step1.click()
  await page.waitForTimeout(400)
  if ((await labels()) !== before) throw new Error('selecting an event reset the zoom')

  await resetBtn.click()
  await page.waitForTimeout(500)
  if ((await labels()) !== full) throw new Error('reset did not restore the selected range')
  if (await resetBtn.count()) throw new Error('reset control still shown at full range')
})

await step('picker fields re-seed from the window after a preset change', async () => {
  await choosePreset('Last 6 Hours')
  await openPicker()
  const from = await pickerField('Start date').inputValue()
  if (from === '08/10/2026') throw new Error(`picker still holds the earlier custom start: ${from}`)
  await closePicker()
})

// ---------------- Executive View ----------------
// Fixture: lab rows on 18 Aug 2026 (UTC), default window = 24 h ending at the newest sample
// (23:30Z = 05:00 IST on 19 Aug), so the last two completed shifts are B (14:00-22:00 IST) and
// A (06:00-14:00 IST) on 18 Aug; shift C (22:00-06:00) is still in progress.
const nActual = LAB_ROWS.filter((r) => r.D58 != null).length
const nPredicted = LAB_ROWS.filter((r) => r.D55 != null).length
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const inZ = (r, from, to) => Date.parse(r.time) >= Date.parse(from) && Date.parse(r.time) < Date.parse(to)

await openTab('Executive View')
await choosePreset('Last 24 Hours')

await step('the Executive View lays out as the sketch: histogram, trend, compliance, shifts', async () => {
  await page.locator('.histogram__chart').waitFor({ timeout: 15_000 })
  await page.locator('.exec .highcharts-container').nth(1).waitFor({ timeout: 15_000 })
  const box = async (title) => (await page.locator('.panel', { hasText: title }).first().boundingBox())
  const hist = await box('C3S Distribution')
  const trend = await box('Actual vs Predicted C3S')
  const comp = await box('Specification Compliance')
  const shifts = await box('Last Two Completed Shifts')
  if (!hist || !trend || !comp || !shifts) throw new Error('a section is missing')
  if (!(hist.x < trend.x && comp.x < shifts.x)) throw new Error('left column should hold histogram + table, right column trend + shifts')
  if (!(hist.y < comp.y && trend.y < shifts.y)) throw new Error('histogram/trend should sit above the table/shifts')
  if (Math.abs(hist.y - trend.y) > 4) throw new Error('histogram and trend should share the top row')
})

await step('the histogram shows only the selected dataset and follows the toggle', async () => {
  const badge = () => page.locator('.panel', { hasText: 'C3S Distribution' }).locator('.badge').first().innerText()
  // Each label is "<count><zero-width space><share>%", so the leading integer is the bar's count.
  const counts = () =>
    page.locator('.histogram__chart .highcharts-data-label').evaluateAll((els) =>
      els.reduce((sum, el) => sum + (parseInt((el.textContent ?? '').trim(), 10) || 0), 0))
  const pressed = (name) => page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed')

  if (!(await badge()).includes(`n = ${nActual}`)) throw new Error(`Actual should show n = ${nActual}, got ${await badge()}`)
  if ((await pressed('Actual')) !== 'true' || (await pressed('Predicted')) !== 'false') throw new Error('toggle state wrong')
  if ((await counts()) !== nActual) throw new Error(`actual bars sum to ${await counts()}, expected ${nActual}`)
  if ((await page.locator('.histogram__chart .highcharts-series').count()) !== 1) throw new Error('more than one dataset is drawn')

  await page.getByRole('button', { name: 'Predicted', exact: true }).click()
  await page.waitForTimeout(500)
  if (!(await badge()).includes(`n = ${nPredicted}`)) throw new Error(`Predicted should show n = ${nPredicted}, got ${await badge()}`)
  if ((await pressed('Predicted')) !== 'true' || (await pressed('Actual')) !== 'false') throw new Error('toggle did not move')
  if ((await counts()) !== nPredicted) throw new Error(`predicted bars sum to ${await counts()}, expected ${nPredicted}`)
  if ((await page.locator('.histogram__chart .highcharts-series').count()) !== 1) throw new Error('both datasets drawn after toggling')

  const axes = await page.locator('.histogram__chart').innerText()
  if (!axes.includes('C3S (%)') || !axes.includes('Samples')) throw new Error('axis titles missing')
  await page.getByRole('button', { name: 'Actual', exact: true }).click()
  await page.waitForTimeout(300)
})

await step('the trend shows actual and predicted correctly (not swapped) with a legend', async () => {
  const exec = page.locator('.exec')
  if ((await exec.locator('.highcharts-series-0 .highcharts-graph').count()) === 0) throw new Error('no predicted line')
  if ((await exec.locator('.highcharts-series-1 .highcharts-graph').count()) === 0) throw new Error('no actual line')
  const legend = await exec.locator('.legend').innerText()
  if (!legend.includes('Actual C3S (Lab)') || !legend.includes('Predicted C3S')) throw new Error(`legend wrong: ${legend}`)

  // Hover the first lab sample: its tooltip must pair D58 as Actual and D55 as Predicted.
  const first = LAB_ROWS.find((r) => r.D58 != null && r.D55 != null)
  const dot = exec.locator('.highcharts-series-1 .highcharts-point').first()
  const b = await dot.boundingBox()
  await page.mouse.move(b.x + b.width / 2 - 15, b.y + b.height / 2)
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 })
  await page.waitForTimeout(500)
  const tip = (await page.locator('.highcharts-tooltip').first().textContent()) ?? ''
  if (!new RegExp(`Predicted C3S\\s*${first.D55.toFixed(2)}%`).test(tip)) throw new Error(`predicted should be D55 ${first.D55.toFixed(2)}: ${tip}`)
  if (!new RegExp(`Actual C3S \\(Lab\\)\\s*${first.D58.toFixed(2)}%`).test(tip)) throw new Error(`actual should be D58 ${first.D58.toFixed(2)}: ${tip}`)
})

/** Readings a compliance row is taken over, from its sub-line ("10 samples", "1411 readings judged"). */
const compN = async (name) => {
  const sub = await page.locator('.comp tbody tr', { has: page.locator('.comp__name', { hasText: name }) }).first().locator('.comp__limits').innerText()
  return Number(/(\d+) (?:samples?|readings?)/.exec(sub)?.[1] ?? NaN)
}

await step('the compliance table has only Parameter, Below LSL, LSL – USL and Above USL, and states unset limits', async () => {
  const table = page.locator('.comp')
  if ((await table.count()) !== 1) throw new Error('there should be one compliance table')
  const head = (await table.locator('thead th').allInnerTexts()).map((h) => h.trim())
  if (head.join('|') !== 'Parameter|Below LSL %|LSL – USL % ↓|Above USL %') throw new Error(`columns: ${head.join(' | ')}`)
  const names = await table.locator('.comp__name').allInnerTexts()
  for (const want of ['Actual C3S (Lab)', 'Predicted C3S', 'Coal Ash', 'AFR Ash (furnace)', 'Clinker CaO', 'Clinker Al2O3', 'Clinker Free CaO', 'Kiln feed LSF', 'Kiln feed SM', 'Kiln feed AM', 'Burning Zone Temp', 'Kiln Coal', 'Cooler Fan 1 Flow']) {
    if (!names.includes(want)) throw new Error(`missing parameter "${want}" in: ${names.join(' | ')}`)
  }
  const text = await table.innerText()
  if (/\bD\d+\b/.test(text)) throw new Error('a raw sensor id is shown in the compliance table')
  // Laboratory rows carry the plant's limits and the basis they were given on.
  if ((await table.locator('.comp__unset', { hasText: 'Limits not configured' }).count()) !== 0) throw new Error('every lab row has limits now')
  const c3s = table.locator('tr[data-param="ADANI_LAB:D58"]')
  if (!(await c3s.locator('.comp__limits').innerText()).includes('LSL 41.5 · USL 44.5 % · Plant: 43 ± 1.5')) throw new Error('actual C3S should show its limits and basis')
  // Its split is the fixture's own lab C3S against 41.5–44.5.
  const vals = LAB_ROWS.filter((r) => r.D58 != null).map((r) => r.D58)
  const share = (k) => ((k / vals.length) * 100).toFixed(2)
  const want = [share(vals.filter((v) => v < 41.5).length), share(vals.filter((v) => v >= 41.5 && v <= 44.5).length), share(vals.filter((v) => v > 44.5).length)]
  const got = await c3s.locator('td').allInnerTexts()
  if (got.join('|') !== want.join('|')) throw new Error(`actual C3S below / within / above: ${got.join(' | ')} (want ${want.join(' | ')})`)
  // A row with no sample in the range says so instead of showing 0 %.
  if (!(await table.locator('tr[data-param="ADANI_LAB:D24"]').innerText()).includes('No samples in the selected range')) throw new Error('kiln feed SM has no sample in the fixture')
  // The default fixture has no kiln feed, so no process reading can be judged.
  if ((await table.locator('tr[data-param^="ADANI_RAW:"] .comp__within').count()) !== 0) throw new Error('a process percentage is shown although nothing could be classified')
  if (!(await table.locator('tr[data-param="ADANI_RAW:D0"]').innerText()).includes('No reading at a binned kiln feed')) throw new Error('BZT should say its readings were not at a binned feed')
  if ((await compN('Actual C3S (Lab)')) !== nActual) throw new Error('actual sample count wrong')
  if ((await compN('Predicted C3S')) !== nPredicted) throw new Error('predicted sample count wrong')
})

await step('process rows are judged against their kiln-feed bin and sorted by the share in range', async () => {
  // Minute data: kiln feed 488 ± 6 t/h (482–494, all in the 480–500 bin), kiln coal 26 ± 1.5 t/h.
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ kilnRows: true }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const table = page.locator('.comp')
  await table.locator('.comp__within').first().waitFor({ timeout: 15_000 })
  // Kiln coal 24.5–27.5 t/h against the 480–500 bin's 20.77–22.46: 0 % in range, 100 % above, red.
  const coal = table.locator('tr[data-param="ADANI_RAW:D66"]')
  const cells = await coal.locator('td').allInnerTexts()
  if (cells.join('|') !== '0.00|0.00|100.00') throw new Error(`kiln coal below / within / above: ${cells.join(' | ')}`)
  if (!(await coal.locator('.comp__within').getAttribute('class')).includes('comp__within--out')) throw new Error('kiln coal should be red')
  if (!(await coal.locator('.comp__limits').innerText()).includes('LSL – USL of the kiln-feed bin')) throw new Error('process rows should say their limits come from the kiln-feed bin')
  // Sorted by the share in range, highest first, before the rows that could not be classified.
  const within = (await table.locator('.comp__within').allInnerTexts()).map(Number)
  if (within.some((v, i) => i > 0 && v > within[i - 1])) throw new Error(`not sorted by LSL – USL %: ${within.join(', ')}`)
  // Readings ~10× from every target (fan flows here are ~20–32): said so, not reported as 0 %.
  if (!(await table.locator('tr[data-param="ADANI_RAW:D9"]').innerText()).includes('Units may not match the limit table')) throw new Error('fan 1 flow should warn about units')
  if (!(await table.locator('tr[data-param="ADANI_RAW:D73"]').innerText()).includes('table: drop')) throw new Error('Kiln RPM should carry the table’s DROP grading')
  await page.locator('.panel', { hasText: 'Specification Compliance' }).screenshot({ path: `${SHOTS}/18-compliance.png` })
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
})

await step('the global time picker drives the histogram, trend and compliance table', async () => {
  // 14:00-20:00 IST = 08:30-14:30 UTC
  await applyRange('2026-08-18T14:00', '2026-08-18T20:00')
  const wantA = labCount('D58', '2026-08-18T08:30:00Z', '2026-08-18T14:30:00Z')
  const wantP = labCount('D55', '2026-08-18T08:30:00Z', '2026-08-18T14:30:00Z')
  const badge = await page.locator('.panel', { hasText: 'C3S Distribution' }).locator('.badge').first().innerText()
  if (!badge.includes(`n = ${wantA}`)) throw new Error(`histogram did not follow the range: ${badge} (want ${wantA})`)
  if ((await compN('Actual C3S (Lab)')) !== wantA) throw new Error('compliance sample count did not follow the range')
  if ((await compN('Predicted C3S')) !== wantP) throw new Error('predicted sample count did not follow the range')
  const plotted = await page.locator('.exec .highcharts-series-1 .highcharts-point').count()
  if (plotted !== wantA) throw new Error(`trend plots ${plotted} lab samples, expected ${wantA}`)
  await choosePreset('Last 24 Hours')
})

await step('the last two completed shifts use the right windows and exclude the shift in progress', async () => {
  await page.locator('.shift').first().waitFor({ timeout: 15_000 })
  const blocks = page.locator('.shift')
  if ((await blocks.count()) !== 2) throw new Error(`expected two shift blocks, got ${await blocks.count()}`)
  const t0 = await blocks.nth(0).innerText()
  const t1 = await blocks.nth(1).innerText()
  if (!/Shift B/.test(t0) || !/Shift A/.test(t1)) throw new Error('expected Shift B then Shift A')
  if (/Shift C/.test(t0 + t1)) throw new Error('the shift still in progress must not be reported')
  if (!t0.includes('18 Aug, 14:00 – 22:00') || !t1.includes('18 Aug, 06:00 – 14:00')) throw new Error(`shift ranges wrong:\n${t0.slice(0, 120)}\n${t1.slice(0, 120)}`)
  if (!/LAST SHIFT/i.test(t0) || !/PREVIOUS SHIFT/i.test(t1)) throw new Error('last / previous labelling wrong')
})

await step('each shift shows only its time, the RCA for it and its recommendations', async () => {
  const blocks = page.locator('.shift')
  for (let i = 0; i < 2; i++) {
    const text = await blocks.nth(i).innerText()
    // Headings are upper-cased by CSS, so compare case-insensitively.
    if (!/root cause analysis/i.test(text) || !/recommendations/i.test(text)) throw new Error(`shift ${i}: RCA or recommendations missing: ${text}`)
    if (!text.includes('1 RCA event')) throw new Error(`shift ${i}: should count its one RCA event: ${text}`)
    for (const gone of [/C3S observations/i, /Lab samples/i, /Mean error/i, /validat/i, /Event report/i, /deviations? analysed/i]) {
      if (gone.test(text)) throw new Error(`shift ${i} still shows ${gone}: ${text}`)
    }
  }
  // Shift A holds the Fuel Ash cause, shown with the insight's own grading, and its kiln-coal move.
  const a = await blocks.nth(1).innerText()
  if (!/Fuel ash/i.test(a) || !/cause/i.test(a)) throw new Error('Shift A should show the insight-graded Fuel ash cause')
  if (!/Reduce Kiln coal/i.test(a) || !a.includes('→')) throw new Error(`Shift A should show the kiln-coal recommendation with its values: ${a}`)
})

await step('shift recommendations are tied to the range end, not to the current time', async () => {
  // Ending the range at 22:00 IST makes Shift B complete exactly then; the last two become B and A.
  await applyRange('2026-08-18T06:00', '2026-08-18T22:00')
  const blocks = page.locator('.shift')
  await blocks.first().waitFor()
  const first = await blocks.nth(0).innerText()
  if (!/Shift B/.test(first)) throw new Error('a shift ending exactly at the range end should count as completed')
  // Ending at 21:00 leaves B in progress, so the last two are A and the previous night's C.
  await applyRange('2026-08-18T06:00', '2026-08-18T21:00')
  await page.waitForTimeout(500)
  const ids = (await page.locator('.shift__title').allInnerTexts()).join('|')
  if (ids !== 'Shift A|Shift C') throw new Error(`with B in progress the last two should be A and C, got ${ids}`)
  await choosePreset('Last 24 Hours')
})

/*
 * A shift summary in the shape the live insight writes "C3S RCA Shift" results (seen 2026-10-28,
 * Shift C of 24 Jul): the shift as a nested object, the insight's recommended actions, an SHC flag,
 * and a report repeated as `event_report` and `note`. Moved onto Shift B of the fixture day. It also
 * carries a zone and a C3S value, to prove it is never read as an RCA event.
 */
const SHIFT_REPORT_TEXT =
  'Shift B, 18 August, 14:00 – 22:00. 3 laboratory C3S samples (actual mean 40.58%). 1 RCA event: Underlimed (1). Recommended actions: Improve cooler airflow using the SHC optimizer.; Hold: re-check last free lime and SAT / burning zone at the next lab. Do not cut coal.'
const SHIFT_SUMMARY_B = {
  _id: 'shift-b-live-shape',
  insightID: 'INS_df1b3c1a11de',
  resultName: 'C3S RCA Shift',
  tags: ['shift'],
  invocationTime: '2026-08-18T16:30:00.000Z',
  result: {
    rca: {
      kind: 'shift',
      deviations: 1,
      shc_optimizer: true,
      event_report: SHIFT_REPORT_TEXT,
      note: SHIFT_REPORT_TEXT,
      shift: { code: 'B', name: 'Shift B', start: '2026-08-18 14:00:00', end: '2026-08-18 22:00:00', label: '18 August, 14:00 – 22:00' },
      recommended_actions: [
        'Improve cooler airflow using the SHC optimizer.',
        'Hold: re-check last free lime and SAT / burning zone at the next lab. Do not cut coal.',
      ],
      c3s: 41.9,
      zone: 'Overlimed',
    },
    as_of: '2026-08-18 22:05',
  },
}

await step('a shift with the insight’s summary shows its complete recommendations, without the report text or raw fields', async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ rcaResults: [...RCA_RESULTS, SHIFT_SUMMARY_B] }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.locator('.shift').first().waitFor()
  const card = page.locator('.shift', { hasText: 'Shift B' })
  const b = await card.innerText()
  for (const want of ['Improve cooler airflow using the SHC optimizer.', 're-check last free lime and SAT / burning zone at the next lab. Do not cut coal.']) {
    if (!b.includes(want)) throw new Error(`shift B misses the insight's action "${want}": ${b}`)
  }
  if (!(await card.locator('.shift__action .badge', { hasText: 'Hold' }).count())) throw new Error('the hold action should carry a Hold tag')
  for (const gone of ['Event report', 'Shc optimizer', 'Recommended actions:', '2026-08-18 14:00:00', 'code']) {
    if (b.includes(gone)) throw new Error(`shift B shows "${gone}": ${b}`)
  }
  // The SHC link sits on the action that calls for it, once.
  const links = card.locator('a.shc-link')
  if ((await links.count()) !== 1) throw new Error(`expected one SHC link, got ${await links.count()}`)
  const host = await links.first().evaluate((a) => a.closest('.shift__action')?.textContent ?? '')
  if (!host.includes('Improve cooler airflow')) throw new Error(`SHC link on the wrong line: ${host}`)
  // The RCA comes from the shift's events.
  if (!/root cause analysis/i.test(b)) throw new Error('shift B should show the RCA')
  // Shift A has no summary: its recommendations come from its events.
  const a = await page.locator('.shift', { hasText: 'Shift A' }).innerText()
  if (!/Reduce Kiln coal/i.test(a)) throw new Error(`shift A should fall back to its events' actions: ${a}`)
  // The summary is not an RCA event: the analysis tab still counts only the two events.
  await openTab('C3S Analysis')
  const nav = await page.locator('.event-nav').innerText()
  if (!nav.includes('2 in range')) throw new Error(`a shift summary was read as an event: ${nav}`)
  await openTab('Executive View')
  await card.screenshot({ path: `${SHOTS}/16-shift-summary.png` })
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
})

await step('the shift section’s day picker lists only days with RCA results and shows that day’s shifts', async () => {
  const panel = page.locator('.panel', { has: page.locator('.shift-day') })
  const picker = panel.locator('select.shift-day')
  await picker.waitFor()
  // The two fixture events (13:01 and 19:30 plant time) are both on 18 Aug.
  const options = await picker.locator('option').allInnerTexts()
  if (options.join('|') !== 'Last two completed|18 Aug 2026 · 2 RCA events') throw new Error(`day options: ${options.join(' | ')}`)
  const picker_box = await picker.boundingBox()
  const head_box = await panel.locator('.panel__head').boundingBox()
  if (picker_box.x + picker_box.width < head_box.x + head_box.width - 40) throw new Error('the day picker should sit in the header’s right corner')

  await picker.selectOption({ label: '18 Aug 2026 · 2 RCA events' })
  await page.waitForTimeout(800)
  const title = await panel.locator('.panel__title').innerText()
  if (!title.includes('Shifts on 18 Aug 2026')) throw new Error(`title: ${title}`)
  const ids = (await panel.locator('.shift__title').allInnerTexts()).join('|')
  if (ids !== 'Shift A|Shift B') throw new Error(`the day’s shifts with RCA, in order, should be A then B; got ${ids}`)
  const ordinal = await panel.locator('.shift__ordinal').first().innerText()
  if (!/shift 1 of 2 with rca results/i.test(ordinal)) throw new Error(`ordinal: ${ordinal}`)
  await panel.screenshot({ path: `${SHOTS}/17-shift-day.png` })

  await picker.selectOption('last')
  await page.waitForTimeout(500)
  if (!(await panel.locator('.panel__title').innerText()).includes('Last Two Completed Shifts')) throw new Error('back to the last two completed')
})

await openTab('C3S Analysis')

await step('mobile layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(600)

  const result = await page.evaluate(() => {
    const docW = document.documentElement.clientWidth
    const overflow = document.documentElement.scrollWidth - docW
    // Content inside a deliberately scrollable box (the event table, the sensor list)
    // may extend past the viewport without making the page scroll sideways.
    const inScroller = (el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX
        if (ox === 'auto' || ox === 'scroll') return true
      }
      return false
    }

    const culprits = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (inScroller(el)) continue
      if (r.right > docW + 1) {
        culprits.push(
          `${el.tagName.toLowerCase()}.${String(el.className || '').trim().split(/\s+/)[0]}` +
            ` right=${Math.round(r.right)} w=${Math.round(r.width)}`,
        )
      }
    }
    return { overflow, culprits: culprits.slice(0, 6) }
  })

  if (result.overflow > 2) {
    throw new Error(
      `horizontal overflow of ${result.overflow}px — ${result.culprits.join(' | ') || 'no element identified'}`,
    )
  }
})
await step('on a phone the picker opens inside the viewport with Apply reachable', async () => {
  await page.locator('.trp__trigger').click()
  await page.locator('.trp__pop').waitFor()
  const vw = page.viewportSize().width
  const pop = await page.locator('.trp__pop').boundingBox()
  if (!pop) throw new Error('popover not measurable')
  if (pop.x < -1 || pop.x + pop.width > vw + 1) throw new Error(`popover spills the ${vw}px viewport: x=${pop.x} w=${pop.width}`)
  await applyBtn().scrollIntoViewIfNeeded()
  const apply = await applyBtn().boundingBox()
  if (!apply || apply.x < 0 || apply.x + apply.width > vw) throw new Error('Apply is not reachable on a phone')
  if ((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) > 2) {
    throw new Error('opening the picker made the page scroll sideways')
  }
  await page.screenshot({ path: `${SHOTS}/05-mobile-picker.png` })
  await closePicker()
})
await step('the Executive View has no horizontal overflow on a phone', async () => {
  await openTab('Executive View')
  await page.waitForTimeout(800)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 2) throw new Error(`horizontal overflow of ${overflow}px on the Executive View`)
  const stacked = await page.evaluate(() => {
    const a = document.querySelector('.exec__col:nth-child(1)')?.getBoundingClientRect()
    const b = document.querySelector('.exec__col:nth-child(2)')?.getBoundingClientRect()
    return !!a && !!b && b.top >= a.bottom - 1
  })
  if (!stacked) throw new Error('columns should stack on a phone')
  await page.screenshot({ path: `${SHOTS}/05-mobile-executive.png`, fullPage: true })
  await openTab('C3S Analysis')
})
await page.screenshot({ path: `${SHOTS}/05-mobile.png` })
await page.setViewportSize({ width: 1600, height: 1100 })

await step('the RCA panel shows the clinker zone in the central colours', async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ rcaResults: [RCA_ZONE_RESULT, ...RCA_RESULTS] }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await openTab('C3S Analysis')

  await pickEvent('21:00')
  const badge = page.locator('.rca .zone-badge[data-zone="Overlimed"]')
  if ((await badge.count()) !== 1) throw new Error('Overlimed zone not shown in the RCA panel')
  // The central palette: Overlimed is orange (#f07c1b) everywhere.
  const border = await badge.evaluate((el) => getComputedStyle(el).borderTopColor)
  if (border !== 'rgb(240, 124, 27)') throw new Error(`Overlimed should use the central orange, got ${border}`)
  // The whiteboard's highs and lows, from the insight's own root causes.
  const moves = await page.locator('.rca__moves').innerText()
  for (const want of ['Kiln coal ↑', 'TSR ↓', 'Solid AFR ↓']) if (!moves.includes(want)) throw new Error(`highs/lows miss "${want}": ${moves}`)

  // Older results without a zone get no zone badge: "Undetermined" is not shown.
  await pickEvent('19:30')
  if ((await page.locator('.rca .zone-badge').count()) !== 0) throw new Error('an older result with no zone should get no zone badge')
  if ((await page.locator('.rca').innerText()).includes('Undetermined')) throw new Error('"Undetermined" should not be shown')
  await page.locator('.panel', { hasText: 'Root Cause Analysis' }).first().screenshot({ path: `${SHOTS}/09-rca-zone.png` })
})

/* ---- C3S Analysis redesign ---- */

await step('plant and line selectors come from the configuration and are live', async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ rcaResults: [RCA_ZONE_RESULT, ...RCA_RESULTS], kilnRows: true, freeLime: true }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await openTab('C3S Analysis')
  const plant = page.locator('.scopebar label', { hasText: 'Plant' }).locator('select')
  const line = page.locator('.scopebar label', { hasText: 'Line' }).locator('select')
  if (await plant.isDisabled()) throw new Error('plant selector is disabled')
  if (await line.isDisabled()) throw new Error('line selector is disabled')
  const lines = await line.locator('option').allInnerTexts()
  if (lines.join('|') !== 'Line 1') throw new Error(`lines offered: ${lines.join('|')} (only configured lines may be offered)`)
  if (!(await line.getAttribute('title')).includes('INS_df1b3c1a11de')) throw new Error('line does not name its insight')
  // The selectors sit in one bar directly above the 48-hour timeline, not in the header.
  if ((await page.locator('.appbar select, .appbar .trp').count()) !== 0) throw new Error('selectors are still in the header')
  if ((await page.locator('.scopebar .trp').count()) !== 1) throw new Error('time range is not in the scope bar')
  const bar = await page.locator('.scopebar').boundingBox()
  const timeline = await page.locator('.panel', { hasText: 'RCA Classification' }).first().boundingBox()
  const gap = timeline.y - (bar.y + bar.height)
  if (gap < 0 || gap > 24) throw new Error(`scope bar should sit just above the timeline (gap ${gap}px)`)
  await page.locator('.scopebar').screenshot({ path: `${SHOTS}/15-scopebar.png` })
})

await step('the 48-hour timeline has 192 coloured 15-minute intervals and a legend', async () => {
  await page.locator('.rtl__bar').waitFor({ timeout: 10_000 })
  const segs = page.locator('.rtl__seg')
  if ((await segs.count()) !== 192) throw new Error(`timeline has ${await segs.count()} intervals`)
  const zones = await segs.evaluateAll((els) => els.map((e) => e.getAttribute('data-zone')))
  const allowed = ['Good clinker', 'Overlimed', 'Under burnt', 'Overburnt', 'Underlimed', 'Not classified']
  const bad = zones.filter((z) => !allowed.includes(z))
  if (bad.length) throw new Error(`unknown classes: ${bad.join(', ')}`)
  // Intervals with no prediction are never shown as good clinker.
  if (!zones.includes('Not classified')) throw new Error('missing intervals should read "Not classified"')
  if ((await page.locator('.rtl').innerText()).includes('Undetermined')) throw new Error('"Undetermined" should not be shown')
  const legend = await page.locator('.rtl__foot .zone-legend li').allInnerTexts()
  for (const want of allowed) if (!legend.some((l) => l.startsWith(want))) throw new Error(`legend misses ${want}`)
  const total = legend.reduce((n, l) => n + Number(l.match(/(\d+)\s*$/)?.[1] ?? 0), 0)
  if (total !== 192) throw new Error(`legend counts add up to ${total}`)
  // The insight's own event is Overlimed, in the central orange.
  const ev = page.locator('button.rtl__seg[data-zone="Overlimed"]')
  if ((await ev.count()) !== 1) throw new Error('the Overlimed RCA event is not a selectable interval')
  const fill = await ev.evaluate((el) => getComputedStyle(el).backgroundColor)
  if (fill !== 'rgb(240, 124, 27)') throw new Error(`Overlimed interval colour ${fill}`)
  // Predictions without an RCA event are classified from lab free lime with the insight
  // targets: the fixture's predictions (C3S ≈ 40) give lime levels of 40.1–40.8, below the
  // 41.5 band, so they are underlimed.
  if (!zones.includes('Underlimed')) throw new Error('no prediction was classified from lab free lime and the targets')
  await page.locator('.rtl').screenshot({ path: `${SHOTS}/12-timeline.png` })
})

await step('hovering an interval shows its time, prediction, class and RCA status', async () => {
  await page.locator('button.rtl__seg[data-zone="Overlimed"]').hover()
  const tip = await page.locator('.rtl__tip').innerText()
  for (const want of ['Predicted C3S', 'Overlimed', 'RCA run at 21:00', 'classification from the insight']) {
    if (!tip.includes(want)) throw new Error(`tooltip misses "${want}": ${tip}`)
  }
  await page.mouse.move(5, 5)
})

await step('selecting a timeline interval with an RCA event selects it everywhere', async () => {
  await pickEvent('13:01')
  await page.locator('button.rtl__seg[data-zone="Overlimed"]').click()
  await page.waitForTimeout(300)
  const meta = await page.locator('.rca__meta').innerText()
  if (!meta.includes('18 Aug 2026, 21:00')) throw new Error(`RCA panel did not follow the timeline: ${meta}`)
  if ((await page.locator('.rca .zone-badge[data-zone="Overlimed"]').count()) !== 1) throw new Error('RCA panel classification badge missing')
  if (!(await page.locator('.event-nav').innerText()).includes('1 of 3')) throw new Error('the event stepper did not follow')
  const rec = await page.locator('.rec').innerText()
  if (!/Limestone/.test(rec) || !/Bauxite/.test(rec)) throw new Error(`both raw-mix moves should be recommended: ${rec}`)
})

await step('the trend has no range buttons of its own; the scope bar sets the range', async () => {
  if ((await page.locator('.range-buttons').count()) !== 0) throw new Error('the 6h/12h/24h/48h buttons should be gone')
  const head = await page.locator('.panel', { hasText: 'Predicted vs Actual C3S' }).first().locator('.panel__head').innerText()
  if (/\b(6h|12h|24h|48h)\b/.test(head)) throw new Error(`range buttons still in the trend header: ${head}`)
})

await step('the RCA panel reads the named parameters at the event from minute data around it', async () => {
  // The Overlimed event (21:00) names kiln coal, PC coal, solid AFR and kiln feed.
  await pickEvent('21:00')
  const coal = page.locator('.rca__params tr', { hasText: 'Kiln Coal' })
  await coal.waitFor()
  await page.waitForFunction(() => !document.querySelector('.rca__params')?.textContent?.includes('loading'), null, { timeout: 10_000 })
  const value = await coal.locator('td').innerText()
  // KILN_ROWS: kiln coal 26 ± 1.5 t/h every minute.
  const v = Number(value.replace(/[^\d.]/g, ''))
  if (!(v > 24 && v < 28) || !value.includes('t/h')) throw new Error(`kiln coal at the event: "${value}"`)
  if ((await page.locator('.rca__params', { hasText: 'no reading' }).count()) !== 0) throw new Error('a named parameter still reads "no reading"')
})

await step('lab quality shows each parameter against its previous sample', async () => {
  if ((await page.locator('.lab-cell__prev').count()) === 0) throw new Error('no last-vs-previous shown')
})

await step('the C3S Analysis tab has no 4-day parameter analysis, and process monitoring follows the RCA panels', async () => {
  if ((await page.locator('.panel', { hasText: 'Last 4 Days Parameter Analysis' }).count()) !== 0) throw new Error('the 4-day panel should be gone')
  const titles = await page.locator('.analysis > .panel > .panel__head .panel__title, .analysis > .analysis__main .panel__title').allInnerTexts()
  const last = (await page.locator('.analysis > .panel .panel__title').allInnerTexts()).pop()
  if (last !== 'Process Monitoring') throw new Error(`last panel should be Process Monitoring, got ${last} (${titles.join(' | ')})`)
})
await page.screenshot({ path: `${SHOTS}/14-analysis-redesign.png`, fullPage: true })

/* ---- Trend Analysis ---- */

const rawRequests = []
const onRawRequest = (r) => {
  const m = /getDataByStEt\/ADANI_RAW\/(\d+)\/(\d+)/.exec(r.url())
  if (m) rawRequests.push([Number(m[1]), Number(m[2])])
}
// 21:00 plant time on the fixture day: the Overlimed event.
const ZONE_EVENT_MS = Date.parse('2026-08-18T15:30:00Z')

await step('the RCA panel link opens Trend Analysis on the selected event', async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ rcaResults: [RCA_ZONE_RESULT, ...RCA_RESULTS], kilnRows: true, freeLime: true }))
  // Listening from the reload: the analysis tab already loads the event's minute data (for the
  // RCA panel's values at the event), and Trend Analysis reuses it rather than fetching again.
  page.on('request', onRawRequest)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await openTab('C3S Analysis')

  await pickEvent('21:00')
  const link = page.getByRole('link', { name: /View process trends/ })
  await link.click()
  await page.locator('.etrend').waitFor({ timeout: 10_000 })
  await page.locator('.etrend__card .highcharts-root').first().waitFor({ timeout: 10_000 })

  if ((await page.getByRole('tab', { name: 'Trend Analysis' }).getAttribute('aria-selected')) !== 'true') {
    throw new Error('Trend Analysis tab is not selected after the link')
  }
  const meta = await page.locator('.etrend__meta').innerText()
  if (!meta.includes('18 Aug 2026, 21:00 (Asia/Kolkata)')) throw new Error(`event time not in plant time: ${meta}`)
  if (!meta.includes('20:00 – 21:30')) throw new Error(`trend window should be 20:00 – 21:30: ${meta}`)
  if (!meta.includes('Overlimed')) throw new Error('zone missing from the event summary')
  const picked = await page.locator('.etrend__picker select').inputValue()
  if (picked !== RCA_ZONE_RESULT._id) throw new Error(`picker shows ${picked}, not the selected event`)
})

await step('the trend window is 1 h before to 30 min after the event', async () => {
  const req = rawRequests.find(([s, e]) => e - s === 90 * 60 * 1000)
  if (!req) throw new Error(`no 90-minute process request: ${JSON.stringify(rawRequests)}`)
  if (req[0] !== ZONE_EVENT_MS - 3_600_000) throw new Error(`window starts at ${new Date(req[0]).toISOString()}`)
})

await step('an opened event keeps the whole selected range on the charts, with the event marked', async () => {
  if ((await page.getByRole('button', { name: 'Selected range', exact: true }).getAttribute('aria-pressed')) !== 'true') {
    throw new Error('an opened event should start on the selected range')
  }
  const cards = page.locator('.etrend__card')
  for (let i = 0; i < (await cards.count()); i++) {
    const card = cards.nth(i)
    const labels = (await card.locator('.highcharts-plot-line-label').allTextContents()).map((t) => t.trim())
    if (labels.filter((t) => t === 'Event 18 Aug 21:00').length !== 1) throw new Error(`card ${i} event label: ${labels.join(' | ')}`)
    // A 7-day axis is labelled by day, not by the event's quarter hours.
    const ticks = await card.locator('.highcharts-xaxis-labels text').allTextContents()
    if (!ticks.some((t) => /^\d{1,2} Aug$/.test(t.trim())) || ticks.includes('20:00')) throw new Error(`card ${i} axis is not the range: ${ticks.join(' ')}`)
    // Readings before and after the event: the line runs across most of the fixture day.
    const box = await card.locator('.highcharts-series-0 .highcharts-graph').boundingBox()
    const plot = await card.locator('.highcharts-plot-background').boundingBox()
    // The event line is the vertical plot line (the filling card also has a horizontal flag line).
    const lines = await card.locator('.highcharts-plot-line').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))
    const event = lines.find((r) => r.width <= 4 && r.height > 20)
    if (!box || !plot || !event || !(box.x < event.x - 2 && box.x + box.width > event.x + 2)) {
      throw new Error(`card ${i} should show data both sides of the event`)
    }
  }
  await page.getByRole('button', { name: 'Event window (−1 h / +30 min)' }).click()
  await page.locator('.etrend__card .highcharts-plot-line-label', { hasText: 'Event 21:00' }).first().waitFor({ timeout: 10_000 })
})

await step('process trends: one 4-column grid, no PC Outlet Temp, each with the event marked', async () => {
  const titles = await page.locator('.etrend__card-head h4').allInnerTexts()
  const want = [
    'Burning Zone Temp', 'Secondary Air Temp', 'Kiln filling degree', 'TAD Temperature',
    'Kiln Inlet O2', 'PC Coal', 'Kiln Coal', 'Kiln RPM', 'Cooler fan flow (total)',
    'Solid AFR', 'Kiln feed',
  ]
  if (titles.join('|') !== want.join('|')) throw new Error(`charted trends: ${titles.join('|')}`)
  if ((await page.locator('.etrend__grid').count()) !== 1) throw new Error('process trends should be one grid')
  // Four cards to a row at desktop width.
  const tops = await page.locator('.etrend__card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  if (!(tops[0] === tops[3] && tops[4] > tops[3])) throw new Error(`cards should run four to a row: ${tops.join(', ')}`)
  const card = (key) => page.locator(`.etrend__card[data-trend="${key}"]`)
  // Feed 488 ± 6 t/h at 4.2 ± 0.1 rpm: 22.56 × (feed / 448) × (3.31 / rpm) ≈ 19.4 %.
  const fill = Number((await card('kiln-fill').locator('.etrend__at strong').innerText()).replace(/[^\d.]/g, ''))
  if (!(fill > 18 && fill < 21)) throw new Error(`filling degree should be ~19.4 %, got ${fill}`)
  const fillText = await card('kiln-fill').innerText()
  // Figure labels are upper-cased by CSS, so compare case-insensitively.
  for (const want of ['22.56 × (feed / 448) × (3.31 / rpm)', 'Median', 'Above 18 %', 'Speed for 19 %', 'rpm']) {
    if (!fillText.toLowerCase().includes(want.toLowerCase())) throw new Error(`filling card misses "${want}": ${fillText}`)
  }
  const bandLabels = await card('kiln-fill').locator('.highcharts-plot-band-label, .highcharts-plot-line-label').allTextContents()
  if (!bandLabels.some((t) => t.includes('Norm 14–16')) || !bandLabels.some((t) => t.includes('Flag > 18'))) {
    throw new Error(`filling chart should show the norm band and the 18 % flag: ${bandLabels.join(' | ')}`)
  }
  if (!(await card('cooler-flow').innerText()).includes('Sum of 12 cooler fan flows')) throw new Error('cooler flow does not say what it sums')
  if (!(await card('ADANI_RAW:D73').innerText()).includes('tag map: drop')) throw new Error('Kiln RPM should carry its tag-map grading')
  const cards = page.locator('.etrend__card')
  for (let i = 0; i < (await cards.count()); i++) {
    const card = cards.nth(i)
    // SVG text: textContent, not innerText. The filling card also carries its 18 % flag line.
    const labels = (await card.locator('.highcharts-plot-line-label').allTextContents()).map((t) => t.trim())
    if (labels.filter((t) => t === 'Event 21:00').length !== 1) throw new Error(`card ${i} event label: ${labels.join(' | ')}`)
    const ticks = await card.locator('.highcharts-xaxis-labels text').allTextContents()
    if (ticks[0] !== '20:00' || ticks[ticks.length - 1] !== '21:30') throw new Error(`x axis not in plant time: ${ticks.join(' ')}`)
    if (!/\d/.test(await card.locator('.etrend__at').innerText())) throw new Error(`card ${i} has no value at the event`)
  }
  const sources = await page.locator('.etrend__card', { hasText: 'Kiln Coal' }).locator('.etrend__sources').innerText()
  if (!sources.includes('Root cause: Kiln coal high')) throw new Error(`Kiln Coal does not say why it is shown: ${sources}`)
})

await step('Trend Analysis draws actual and predicted C3S vs free lime over the insight zones', async () => {
  const zones = page.locator('.etrend .czones')
  await zones.locator('.czone__chart .highcharts-root').nth(1).waitFor({ timeout: 10_000 })
  if ((await page.locator('.analysis .czones').count()) !== 0) throw new Error('zone plots should live on Trend Analysis only')

  const targets = await zones.locator('.czones__targets').innerText()
  for (const want of ['C3S 43 (band 41.5–44.5)', 'free lime 1.5 (band 1.2–1.8)', '4.071 × (free lime − 1.5)']) {
    if (!targets.includes(want)) throw new Error(`targets line missing "${want}": ${targets}`)
  }
  const plots = zones.locator('.czones__plot')
  const heads = await plots.locator('h4').allInnerTexts()
  // Lab history up to the 21:00 event: three actual C3S samples with free lime; predictions
  // only pair with free lime from the 4 h before them.
  if (!heads[0].includes('Actual C3S (Lab)') || heads[0].includes('Clinker C3S')) throw new Error(`actual plot should use Actual C3S (Lab): ${heads[0]}`)
  if (!heads[0].includes('n=3 lab samples') || !heads[1].includes('n=5 predictions')) throw new Error(`pairs: ${heads.join(' / ')}`)
  for (let i = 0; i < 2; i++) {
    const legend = await plots.nth(i).locator('.highcharts-legend-item text').allTextContents()
    if (legend.join('|') !== 'Underlimed|Overburnt|Good clinker|Under burnt|Overlimed') throw new Error(`legend: ${legend.join('|')}`)
    if ((await plots.nth(i).locator('.highcharts-series.highcharts-polygon-series:not(.czone-target)').count()) !== 5) throw new Error(`plot ${i} should fill five zones`)
  }
  const counts = await plots.first().locator('.czone__counts').innerText()
  if (!/Good clinker\s*1/.test(counts) || !/Under burnt\s*1/.test(counts) || !/Underlimed\s*1/.test(counts)) throw new Error(`zone counts: ${counts}`)

  // The event is triggered on predicted C3S, so it is marked on the predicted plot only.
  const labels = async (i) => (await plots.nth(i).locator('.highcharts-data-label text').allTextContents()).join(' ')
  if (!(await labels(1)).includes('Event 18 Aug, 21:00')) throw new Error(`event not on the predicted plot: ${await labels(1)}`)
  if ((await labels(0)).includes('Event')) throw new Error('event should not be marked on the actual plot')
  const meta = await page.locator('.etrend__meta').innerText()
  if (!/Predicted C3S \(trigger\)\s*43\.60%/i.test(meta)) throw new Error(`event C3S should be labelled predicted: ${meta}`)
  await zones.screenshot({ path: `${SHOTS}/11-clinker-zones.png` })
})

await step('the last four laboratory samples are the ones at or before the event, newest first', async () => {
  const first = await page.locator('.etrend__table tbody th .etrend__param').allInnerTexts()
  if (!first[0].includes('Predicted C3S') || !first[1].includes('Actual C3S (Lab)')) {
    throw new Error(`predicted then actual C3S should lead the sample table: ${first.slice(0, 2).join(' | ')}`)
  }
  const c3s = page.locator('.etrend__table tbody tr').first()
  const cells = await c3s.locator('td').allInnerTexts()
  const want = [['40.24', '18 Aug, 21:00'], ['40.02', '18 Aug, 19:00'], ['40.73', '18 Aug, 17:00'], ['40.88', '18 Aug, 15:00']]
  want.forEach(([v, t], i) => {
    if (!cells[i]?.includes(v) || !cells[i]?.includes(t)) throw new Error(`sample ${i + 1}: "${cells[i]}" should be ${v} at ${t}`)
  })
  const params = await page.locator('.etrend__table tbody th .etrend__param').allInnerTexts()
  for (const want of ['Clinker Free CaO', 'Kiln feed LSF', 'Raw mix LSF']) {
    if (!params.some((p) => p.includes(want))) throw new Error(`missing "${want}" in samples: ${params.join(' | ')}`)
  }
  if (params.some((p) => /Cooler|Hot meal/.test(p))) throw new Error('unrelated parameters in the sample table')
})
await page.screenshot({ path: `${SHOTS}/10-trend-analysis.png`, fullPage: true })

await step('picking another event, here or on the analysis tab, reloads the trends for it', async () => {
  const select = page.locator('.etrend__picker select')
  await select.selectOption(RCA_RESULTS[1]._id)
  await page.locator('.highcharts-plot-line-label', { hasText: 'Event 13:01' }).first().waitFor({ timeout: 10_000 })

  // The selection is shared: the analysis tab follows, and a pick there populates this tab.
  await openTab('C3S Analysis')
  if (!(await page.locator('.rca__meta').innerText()).includes('13:01')) throw new Error('analysis tab lost the event picked on Trend Analysis')
  await pickEvent('19:30')
  // Its link opens Trend Analysis on that event.
  await page.getByRole('link', { name: /View process trends/ }).click()
  await page.locator('.highcharts-plot-line-label', { hasText: 'Event 18 Aug 19:30' }).first().waitFor({ timeout: 10_000 })
  if ((await page.locator('.etrend__picker select').inputValue()) !== RCA_RESULTS[0]._id) {
    throw new Error('Trend Analysis did not open on the event the RCA panel links from')
  }
  page.off('request', onRawRequest)
})

await step('opened from its tab, Trend Analysis shows the selected range with no RCA analysis', async () => {
  await openTab('Executive View')
  await openTab('Trend Analysis')
  await page.locator('.etrend__card .highcharts-root').first().waitFor({ timeout: 10_000 })
  if ((await page.locator('.etrend__picker select').inputValue()) !== '') throw new Error('the tab should open with no event')
  const meta = await page.locator('.etrend__meta').innerText()
  if (!/Process data for the selected range/i.test(meta) || !/One per 5 minutes/i.test(meta)) throw new Error(`range summary: ${meta}`)
  // Only the kiln-operation set: no RCA-named extras, zone plots, lab samples or event marks.
  const titles = await page.locator('.etrend__card-head h4').allInnerTexts()
  const want = [
    'Burning Zone Temp', 'Secondary Air Temp', 'Kiln filling degree', 'TAD Temperature',
    'Kiln Inlet O2', 'PC Coal', 'Kiln Coal', 'Kiln RPM', 'Cooler fan flow (total)',
  ]
  if (titles.join('|') !== want.join('|')) throw new Error(`range trends: ${titles.join('|')}`)
  if ((await page.locator('.etrend__table').count()) !== 0) throw new Error('lab samples shown without an event')
  // The zone plots cover the selected range: all four lab samples with free lime, no event marked.
  const zones = page.locator('.etrend .czones')
  await zones.locator('.czone__chart .highcharts-root').nth(1).waitFor({ timeout: 10_000 })
  const heads = await zones.locator('.czones__plot h4').allInnerTexts()
  if (!heads[0].includes('n=4 lab samples')) throw new Error(`range zone plot should hold the range's samples: ${heads.join(' / ')}`)
  const zoneLabels = await zones.locator('.highcharts-data-label text').allTextContents()
  if (zoneLabels.some((t) => t.includes('Event'))) throw new Error(`event marked on the range zone plots: ${zoneLabels.join(' ')}`)
  const caption = await zones.innerText()
  if (!caption.includes('Samples from the selected range') || caption.includes('red diamond')) throw new Error(`zone caption: ${caption}`)
  if ((await page.locator('.etrend__sources').count()) !== 0) throw new Error('RCA wording shown without an event')
  const marks = await page.locator('.etrend__card .highcharts-plot-line-label').allTextContents()
  if (marks.some((t) => t.includes('Event'))) throw new Error(`event marked with no event open: ${marks.join(' | ')}`)
  if ((await page.getByRole('button', { name: /Event window/ }).count()) !== 0) throw new Error('event-window toggle without an event')
  const at = await page.locator('.etrend__card[data-trend="ADANI_RAW:D0"] .etrend__at').innerText()
  // The newest reading in the range, at its end: 19 Aug, 05:00 plant time.
  if (!/latest/i.test(at) || !at.includes('19 Aug, 05:00')) throw new Error(`range card should give its newest reading: ${at}`)
  const ticks = await page.locator('.etrend__card[data-trend="ADANI_RAW:D0"] .highcharts-xaxis-labels text').allTextContents()
  if (!ticks.some((t) => /^\d{1,2} Aug$/.test(t.trim()))) throw new Error(`axis should span the range: ${ticks.join(' ')}`)
})

await step('opening an event here adds its analysis, and closing it returns to the range', async () => {
  await page.locator('.etrend__picker select').selectOption(RCA_ZONE_RESULT._id)
  await page.locator('.etrend__table').waitFor({ timeout: 10_000 })
  await page.locator('.highcharts-plot-line-label', { hasText: 'Event 18 Aug 21:00' }).first().waitFor({ timeout: 10_000 })
  if ((await page.locator('.etrend__card-head h4').count()) !== 11) throw new Error('the RCA-named tags should be added for the event')
  if (!(await page.locator('.etrend .czones').innerText()).includes('the 96 h up to the event')) throw new Error('event zone plots should cover the 96 h up to it')
  await page.getByRole('button', { name: 'Close event' }).click()
  await page.locator('.etrend__table').waitFor({ state: 'detached', timeout: 10_000 })
  if (!(await page.locator('.etrend .czones').innerText()).includes('the selected range')) throw new Error('closing should return the zone plots to the range')
  if ((await page.locator('.etrend__picker select').inputValue()) !== '') throw new Error('closing should clear the event')
  if ((await page.locator('.etrend__card-head h4').count()) !== 9) throw new Error('closing should drop the RCA-named tags')
})

await step('over a range longer than 7 days, charts cover the loaded days, and an older event gets its own 7 days', async () => {
  // 1 Aug to the cut-off: only the newest 7 days (from 21 Aug, 03:00) are loaded for the range.
  await openPicker()
  await typeRange('2026-08-01T00:00', '2026-08-28T03:00')
  await applyBtn().click()
  await page.waitForTimeout(1500)
  await openTab('Trend Analysis')
  await page.locator('.etrend__card').first().waitFor({ timeout: 10_000 })
  const foot = await page.locator('.etrend__foot').innerText()
  if (!foot.includes('its newest 7 days (from 21 Aug, 03:00)')) throw new Error(`range note: ${foot}`)
  // The fixture has process data on 18 Aug only, so the loaded week has none, and says which days it means.
  const empty = await page.locator('.etrend__card[data-trend="ADANI_RAW:D0"]').innerText()
  if (!empty.includes('No readings for this trend in the newest 7 days of the range')) throw new Error(`empty card: ${empty}`)

  // The 18 Aug event is older than the loaded week: its own 7 days are loaded and charted.
  await page.locator('.etrend__picker select').selectOption(RCA_ZONE_RESULT._id)
  await page.locator('.highcharts-plot-line-label', { hasText: 'Event 18 Aug 21:00' }).first().waitFor({ timeout: 15_000 })
  const note = await page.locator('.etrend__foot').innerText()
  if (!note.includes('the 7 days around the event (15 Aug, 09:00 – 22 Aug, 09:00)')) throw new Error(`event note: ${note}`)
  const card = page.locator('.etrend__card[data-trend="ADANI_RAW:D0"]')
  const graph = await card.locator('.highcharts-series-0 .highcharts-graph').boundingBox()
  const lines = await card.locator('.highcharts-plot-line').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))
  const event = lines.find((r) => r.width <= 4 && r.height > 20)
  const plot = await card.locator('.highcharts-plot-background').boundingBox()
  if (!graph || !event || !plot) throw new Error('no line or event mark')
  // The fixture day spans the event; on a 7-day axis it is a seventh of the plot, around the event.
  if (!(graph.x < event.x - 2 && graph.x + graph.width > event.x + 2)) throw new Error('readings should run both sides of the event')
  if (graph.width < plot.width / 10) throw new Error(`the data should not be a sliver: ${graph.width} of ${plot.width}px`)
  await page.locator('.etrend').screenshot({ path: `${SHOTS}/13-trend-long-range-event.png` })
})

await step('a predicted C3S above 50 % is never plotted', async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  // A model glitch at 12:00 plant time on the fixture day.
  await page.route(API_GLOB, apiHandler({ extraLab: [{ time: '2026-08-18T06:30:00.000Z', D55: 72.4 }] }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await openTab('Executive View')
  const trend = page.locator('.panel', { hasText: 'Actual vs Predicted C3S' })
  await trend.locator('.highcharts-root').first().waitFor({ timeout: 10_000 })
  const yLabels = (await trend.locator('.highcharts-yaxis-labels text').allTextContents()).map(Number).filter(Number.isFinite)
  if (!yLabels.length || Math.max(...yLabels) >= 50) throw new Error(`the trend reaches the 72.4 % prediction: y axis ${yLabels.join(' ')}`)
  const tooltips = await trend.locator('.highcharts-point').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? '').filter((l) => l.includes('72.4')))
  if (tooltips.length) throw new Error(`a 72.4 % point is drawn: ${tooltips[0]}`)
})

await step('only a recommendation the insight sends to the SHC optimizer links to it', async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ rcaResults: [RCA_ZONE_RESULT, RCA_SHC_RESULT, ...RCA_RESULTS], kilnRows: true, freeLime: true }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await openTab('C3S Analysis')
  await pickEvent('10:00')
  const actions = page.locator('.rec__action')
  await actions.first().waitFor()
  const rows = await actions.evaluateAll((els) =>
    els.map((e) => ({ text: e.textContent ?? '', links: [...e.querySelectorAll('a.shc-link')].map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]) })),
  )
  const shc = rows.filter((r) => r.text.includes('SHC optimizer'))
  if (shc.length !== 1) throw new Error(`expected one SHC action: ${rows.map((r) => r.text.slice(0, 40)).join(' | ')}`)
  const [href, target, rel] = shc[0].links[0] ?? []
  if (href !== 'https://demo.iosense.io/launchpad/view?id=6ad86ac0fe275c6e1f553ae2&entityName=Kiln%20SHC%20Optimiser%20&fromLink=true&isHidden=false' || target !== '_blank' || !/noopener/.test(rel ?? '')) {
    throw new Error(`SHC link: ${JSON.stringify(shc[0].links)}`)
  }
  if (rows.some((r) => !r.text.includes('SHC optimizer') && r.links.length)) throw new Error('the SHC link shows on another recommendation')
  if (!(await page.getByRole('link', { name: /Open SHC Optimizer/ }).isVisible())) throw new Error('SHC link not visible')
  // An event without such an action carries no link.
  await pickEvent('21:00')
  if ((await page.locator('a.shc-link').count()) !== 0) throw new Error('SHC link on an event that does not call for it')
  await page.locator('.analysis').screenshot({ path: `${SHOTS}/12-shc-link.png` })
})

await step('Trend Analysis has no horizontal overflow on a phone', async () => {
  await openTab('Trend Analysis')
  await page.locator('.etrend__card .highcharts-root').first().waitFor({ timeout: 10_000 })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 1) throw new Error(`page overflows by ${overflow}px`)
  await page.screenshot({ path: `${SHOTS}/10-trend-mobile.png`, fullPage: true })
  await page.setViewportSize({ width: 1600, height: 1100 })
})

await step('every tab follows a live window resize: no sideways scroll, no overlap, charts fill their box', async () => {
  const problems = []
  for (const tab of ['Executive View', 'C3S Analysis', 'Trend Analysis']) {
    await page.setViewportSize({ width: 1600, height: 1100 })
    await openTab(tab)
    await page.waitForTimeout(800)
    // Down to a small phone and back up again, without reloading.
    for (const width of [2560, 1366, 1180, 1024, 768, 600, 360, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.waitForTimeout(500)
      // Charts redraw a moment after their box changes; give a busy page up to 2 s more to settle
      // before calling a chart stuck at its old width.
      let found = []
      for (let attempt = 0; attempt < 5; attempt++) {
        found = await page.evaluate(() => {
          const out = []
          const vw = document.documentElement.clientWidth
          if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`)
          const shown = (el) => {
            const r = el.getBoundingClientRect()
            return r.width >= 2 && r.height >= 2 && getComputedStyle(el).position !== 'absolute'
          }
          // Panels and cards laid out side by side must not cover one another.
          for (const box of document.querySelectorAll('.exec, .exec__col, .analysis__main, .analysis__col, .etrend__grid, .grid, .process, .scopebar')) {
            const kids = [...box.children].filter(shown)
            for (let i = 0; i < kids.length; i++)
              for (let j = i + 1; j < kids.length; j++) {
                const a = kids[i].getBoundingClientRect()
                const b = kids[j].getBoundingClientRect()
                if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)
                  out.push(`${kids[i].className} overlaps ${kids[j].className}`)
              }
          }
          // A panel's content stays inside the panel.
          for (const p of document.querySelectorAll('.panel')) {
            if (shown(p) && p.scrollWidth > p.clientWidth + 2) out.push(`content spills out of ${p.querySelector('.panel__title')?.textContent?.trim() ?? p.className}`)
          }
          // Every chart was redrawn at its box's new width.
          for (const c of document.querySelectorAll('.highcharts-container')) {
            const host = c.parentElement
            const svg = c.querySelector('svg')
            if (!host || !svg || !shown(host)) continue
            const w = svg.getBoundingClientRect().width
            if (Math.abs(w - host.clientWidth) > 3) out.push(`chart ${Math.round(w)}px in a ${host.clientWidth}px box (${host.className})`)
          }
          return out
        })
        if (found.length === 0) break
        await page.waitForTimeout(400)
      }
      for (const f of found) problems.push(`${tab} @ ${width}: ${f}`)
    }
  }
  await page.setViewportSize({ width: 1600, height: 1100 })
  await openTab('Executive View')
  if (problems.length) throw new Error(problems.slice(0, 8).join('\n'))
})

await step('nothing after 28 Aug 2026, 03:00 plant time is requested', async () => {
  const CUTOFF = Date.parse('2026-08-28T03:00:00+05:30')
  const ends = []
  const onReq = (r) => {
    const m = /getDataByStEt\/\w+\/(\d+)\/(\d+)/.exec(r.url())
    if (m) ends.push(Number(m[2]))
  }
  page.on('request', onReq)
  await openTab('Executive View')
  await applyRange('2026-08-28T00:00', '2026-08-29T00:00')
  await page.waitForTimeout(1500)
  page.off('request', onReq)
  if (ends.length === 0) throw new Error('the range before the cut-off should still be fetched')
  const late = ends.filter((e) => e > CUTOFF)
  if (late.length) throw new Error(`requested past the cut-off: ${late.map((e) => new Date(e).toISOString()).join(', ')}`)
  await choosePreset('Last 24 Hours')
})

// 3 — error state when the insight is unavailable
await step('insight failure shows an explicit error, not fabricated findings', async () => {
  expectingFailures = true
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ failInsight: true }))

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const txt = await page.locator('.app__main').innerText()
  if (!txt.includes('RCA insight unavailable')) throw new Error('no unavailable state shown')
  if (txt.includes('Fuel Ash Addition')) throw new Error('stale/fabricated findings shown after failure')
  // The Executive View (the landing tab) must report it too, not say "no deviation analysed".
  if (!(await page.locator('.exec').count())) throw new Error('expected to land on the Executive View')
  if (/No deviation analysed|No deviations/.test(txt)) throw new Error('shifts claim "no deviations" although the insight failed')
  if ((await page.locator('.shift').count()) !== 0) throw new Error('shift reports shown without the insight')
})
await page.screenshot({ path: `${SHOTS}/06-rca-error.png` })

await step('a failing process feed does not blank the C3S trend', async () => {
  expectingFailures = true
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route(API_GLOB, apiHandler({ failProcess: true }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // Executive View first: the C3S views and the shifts survive; only the burning-zone row is affected.
  if ((await page.locator('.exec .highcharts-series-1 .highcharts-graph').count()) === 0) throw new Error('Executive trend vanished with the process feed')
  if ((await page.locator('.histogram__chart').count()) === 0) throw new Error('histogram vanished with the process feed')
  const comp = await page.locator('.panel', { hasText: 'Specification Compliance' }).innerText()
  if (!comp.includes('Process data unavailable')) throw new Error(`the bin table should report the process failure: ${comp}`)
  if ((await page.locator('.shift').count()) !== 2) throw new Error('shift reports should still render without the process feed')
  await openTab('C3S Analysis')
  if ((await page.locator('.highcharts-series-1 .highcharts-graph').count()) === 0) throw new Error('C3S trend vanished with the process feed')
  const txt = await page.locator('.app__main').innerText()
  if (!txt.includes('Process data unavailable')) throw new Error('process failure not reported')
  if (!txt.includes('Root Cause Analysis')) throw new Error('RCA section missing')
  if ((await page.locator('.rca__meta').count()) === 0) throw new Error('RCA findings vanished with the process feed')
})
await page.screenshot({ path: `${SHOTS}/08-process-error.png` })

await browser.close()

console.log(`\nScreenshots: ${SHOTS}`)
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('\nAll browser checks passed with no console errors.')
