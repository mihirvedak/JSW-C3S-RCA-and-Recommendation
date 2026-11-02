/**
 * Browser check for the JSW Cement line.
 *
 * No session token for the JSW account is available in this environment, so the platform is
 * simulated: each of the line's fifteen devices answers with SYNTHETIC rows in the platform's real
 * response shape (these are not plant values), and the RCA insight `INS_c3snandyalrca` answers in
 * the schema `INS_df1b3c1a11de` returns today (the JSW insight's own schema is still to be
 * verified). What this proves is the configuration: the dashboard reads the right device and
 * sensor for every role, keeps same-numbered tags on different devices apart, and says plainly
 * which features are off because JSW has not supplied the tags or limits for them.
 *
 * Run:  node src/tests/e2e-jsw.mjs [baseURL] [screenshotDir]
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5179'
const SHOTS = process.argv[3] ?? '/tmp/c3s-shots-jsw'
mkdirSync(SHOTS, { recursive: true })

const HOUR = 3_600_000
const MIN = 60_000
/** Newest synthetic sample: 30 Oct 2026, 06:00 UTC (11:30 plant). */
const END = Date.parse('2026-10-30T06:00:00Z')
const iso = (ms) => new Date(ms).toISOString()
/** Plant-local wall clock as the insight writes it. */
const plant = (ms) => new Date(ms + 5.5 * HOUR).toISOString().slice(0, 19).replace('T', ' ')

/* ------------------------------ synthetic device rows ------------------------------ */

/** rows(start, end, step, fn): one row per step, newest first as the platform returns them. */
function rows(start, end, step, fn) {
  const out = []
  for (let t = end; t >= start; t -= step) out.push({ time: iso(t), ...fn(t) })
  return out
}

const wave = (t, base, amp, periodH) => base + amp * Math.sin((t / HOUR / periodH) * 2 * Math.PI)
/** The kiln feed laboratory's last sample: 15 days before the newest C3S. */
const KILN_FEED_STOP = END - 15 * 24 * HOUR

/** Every device of the JSW line, by id: the samples it carries, as a function of the window asked for. */
const RAW = {
  // Clinker XRD/XRF: a sample about every 2 h. D18 lab C3S, D24 free lime, D19 SO3.
  // Two impossible lab C3S readings, as the plant has seen them: 95.5 % and −3.2 %.
  FLSCLINKER: (s, e) => rows(s, e, 2 * HOUR, (t) => ({ D18: t === END - 4 * HOUR ? 95.5 : t === END - 10 * HOUR ? -3.2 : +wave(t, 61, 2, 36).toFixed(2), D24: +wave(t, 1.4, 0.5, 20).toFixed(2), D19: 0.9, D6: 21.8, D8: 5.4, D11: 3.9, D15: 65.1, D5: 93.5, D13: 2.25, D10: 1.4, D16: 18.2, D14: 7.6, D21: 11.9 })),
  // Kiln feed XRF: every 2 h, offset, and — as reported for Nandyal — nothing after 15 days before the
  // newest C3S. D7 SiO2 (a D7 that is NOT the predicted C3S). D6 LSF, D11 SM, D10 AM.
  FLSKILNFEED: (s, e) => rows(s, Math.min(e, KILN_FEED_STOP) - 17 * MIN, 2 * HOUR, (t) => ({ D14: 43.1, D7: 13.6, D8: 3.2, D13: 2.1, D15: 1.9, D16: 0.3, D17: 0.2, D18: 0.6, D6: +wave(t, 100, 1.5, 30).toFixed(1), D11: 2.31, D10: 1.29 })),
  // Raw mill and ball mill XRF: the same layout as the kiln feed, every 2 h.
  FLSRAWMILL01: (s, e) => rows(s, e - 40 * MIN, 2 * HOUR, (t) => ({ D7: 13.4, D8: 3.5, D13: 3.0, D14: 43.0, D6: +wave(t, 100.5, 2, 24).toFixed(1), D11: 1.9, D10: 1.0 })),
  FLSBALLMILL: (s, e) => rows(s, e - 50 * MIN, 4 * HOUR, () => ({ D7: 13.5, D8: 3.4, D13: 3.1, D14: 42.9, D6: 99.8, D11: 1.95, D10: 1.02 })),
  // Calciner hot meal, two streams and their averages; calciner temperatures on the DCS.
  FLSCALCINATION1: (s, e) => rows(s, e - 25 * MIN, 2 * HOUR, () => ({ D5: 1.6, D8: 0.3, D9: 1.1, D11: 0.4, D16: 92.1 })),
  FLSCALCINATION2: (s, e) => rows(s, e - 25 * MIN, 2 * HOUR, () => ({ D5: 1.8, D8: 0.3, D9: 1.2, D11: 0.5, D16: 91.4 })),
  FLSCALCINATION: (s, e) => rows(s, e - 25 * MIN, 2 * HOUR, () => ({ D15: 1.7, D16: 91.75, D17: 905 })),
  // Calciner temperatures: on the hour every 2 h, with the laboratory feed (as live).
  JSWCALN_A1: (s, e) => rows(s, Math.floor(e / (2 * HOUR)) * 2 * HOUR, 2 * HOUR, (t) => ({ D0: +wave(t, 900, 15, 30).toFixed(0), D1: +wave(t, 910, 15, 40).toFixed(0) })),
  // Fuel lab: daily.
  JSWCOAL_A1: (s, e) => rows(s, e, 24 * HOUR, () => ({ D12: 31.2, D17: 33.8, D22: 3150 })),
  // Bomb calorimeters: daily. Both D18 — neither is the clinker C3S.
  JSWBMBCLRMTR_KC: (s, e) => rows(s, e, 24 * HOUR, () => ({ D18: 5120 })),
  JSWBMBCLRMTR_PC: (s, e) => rows(s, e, 24 * HOUR, () => ({ D18: 4980 })),
  // Model outputs: every 15 min. D7 predicted C3S, D5 the superseded physics C3S (hidden).
  // And one impossible prediction, 120 %.
  JSW_C3S: (s, e) => rows(s, e, 15 * MIN, (t) => ({ D0: 0.021, D1: 0.019, D2: 0.004, D3: 0.012, D4: 0.056, D5: 58.0, D6: 1.2, D7: t === END - 3 * HOUR ? 120 : +wave(t, 60.5, 2.2, 36).toFixed(2), D8: 0.3 })),
  // DCS devices: every minute. Only the named tags plus two unnamed ones, to exercise discovery.
  ABBKLN_A1: (s, e) => rows(s, e, MIN, (t) => ({ D154: +wave(t, 9.1, 0.4, 6).toFixed(2), D155: +wave(t, 7.8, 0.3, 5).toFixed(2), D156: 2.1, D7: 812 })),
  ABBBHPH_A1: (s, e) => rows(s, e, MIN, (t) => ({ D63: +wave(t, 410, 12, 8).toFixed(1), D1: 0.5 })),
  ABBKLNAFRSGC_A1: (s, e) => rows(s, e, MIN, (t) => ({ D2: +wave(t, 6.5, 1, 7).toFixed(2) })),
}

/*
 * What the platform actually answers, as seen live for Nandyal (2026-11-01):
 *   - every value is a string ("38.00825999999995"), except on the model device JSW_C3S;
 *   - every non-DCS device also sends an RSSI heartbeat row every minute ({ time, RSSI: "-1" }),
 *     whether or not the laboratory sent anything — most of each answer is heartbeats;
 *   - DCS rows carry gateway fields beside the tags ("Status": "2", "RSSI": "22").
 */
const NUMERIC = new Set(['JSW_C3S'])
const GATEWAY = new Set(['ABBKLN_A1', 'ABBBHPH_A1', 'ABBKLNAFRSGC_A1'])
const asText = (v) => (typeof v === 'number' ? String(v) : v)
function live(devID) {
  const gen = RAW[devID]
  const strings = !NUMERIC.has(devID)
  return (s, e) => {
    const data = gen(s, e).map(({ time, ...v }) => ({
      time,
      ...(strings ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, asText(x)])) : v),
      ...(GATEWAY.has(devID) ? { Status: '2', RSSI: '22' } : {}),
    }))
    if (GATEWAY.has(devID)) return data
    const beats = []
    for (let t = Math.floor(e / MIN) * MIN + 23_112; t >= s; t -= MIN) if (t <= e) beats.push({ time: iso(t), RSSI: strings ? '-1' : -1 })
    return [...data, ...beats].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))
  }
}
const DEVICES = Object.fromEntries(Object.keys(RAW).map((d) => [d, live(d)]))

/* ------------------------------ synthetic insight results ------------------------------ */

/*
 * In the format INS_c3snandyalrca returns ("C3S RCA Live", seen whole on 2026-11-02): run on the
 * laboratory C3S (`source: "lab C3S"`, time = lab_time), targets without a written lime-level
 * formula, and the lime level itself in `level` (= C3S + 4.071 × (free lime − target free lime)).
 */
const targets = { c3s: 61, c3s_band: [59, 63], free_lime: 1.5, free_lime_band: [1.0, 2.0] }

const event = (id, ms, zone, c3s, fcao, extra) => ({
  _id: id,
  insightID: 'INS_c3snandyalrca',
  resultName: 'C3S RCA Live',
  result: {
    rca: {
      raw: `Problem: ${zone}: C3S ${c3s} % (band 59.0 to 63.0 %), free lime ${fcao} % (band 1.0 to 2.0 %).`,
      source: 'lab C3S',
      time: plant(ms),
      lab_time: plant(ms),
      batch_end: plant(ms),
      c3s,
      c3s_gap: +(c3s - targets.c3s).toFixed(2),
      fcao,
      level: +(c3s + 4.071 * (fcao - targets.free_lime)).toFixed(2),
      direction: c3s < targets.c3s ? 'low' : 'high',
      zone,
      targets,
      primary_cause: null,
      confirmed_cause: false,
      root_cause: {
        Problem: `${zone}: free lime ${fcao} % (band 1.0 to 2.0 %), C3S ${c3s} % (band 59 to 63 %).`,
        'Cause 1': 'Root cause not confirmed from the available data. Further validation is required before recommending corrective action.',
        ...extra.root,
      },
      recommendations: extra.shc ? { ...extra.rec, 'Action 3': extra.shc } : extra.rec,
      shc_optimizer: Boolean(extra.shc),
      outcome: { 'Result 1': 'C3S back inside its band within two batches.' },
      why: [],
      do: [],
      result: [],
      notes: ['Air-side effects (secondary air, O2, cooler) are not checked: no cooler tags supplied for Nandyal yet.'],
    },
    as_of: plant(ms + 20 * MIN),
  },
  tags: ['C3S RCA Live', c3s < targets.c3s ? 'lower_than_target' : 'higher_than_target', 'JSW'],
  invocationTime: iso(ms + 20 * MIN),
})

// j1 sits in shift C (04:30 plant time) so the last completed shifts carry its set-point moves.
const RCA = [
  event('j1', END - 7 * HOUR, 'Under burnt', 58.4, 2.3, {
    // As the live JSW insight words it on every result.
    shc: 'Improve SHC from 706 to 590 kcal/kg using the SHC optimizer.',
    root: { 'Watch 1': 'TSR low: 11.2% against 13.0% in this feed bin’s best period.', 'Watch 2': 'Kiln coal high: 9.6 t/h against normal 9.1 t/h.', 'Watch 3': 'Kiln feed low: 402 t/h against 410 t/h.' },
    rec: { 'Set point 1': 'Reduce Kiln coal from 9.6 to 9.1 t/h (-0.5 t/h), limits 8.6 to 9.4 t/h.', 'Set point 2': 'Increase Solid AFR from 6.1 to 6.8 t/h (+0.7 t/h), limits 5.5 to 7.0 t/h.' },
  }),
  event('j2', END - 19 * HOUR, 'Overlimed', 63.7, 1.1, {
    root: { 'Watch 1': 'Fuel ash low: 4.2 against target 5.0.', 'Watch 2': 'Raw meal CaO high: 43.6 % against 43.1 %.' },
    rec: { 'Set point 1': 'No set-point change.' },
  }),
]

/* ------------------------------ the simulated platform ------------------------------ */

const API_GLOB = '**/api/**'
const requested = []
/** A device the simulated account cannot read, to show that one refusal never blanks the others. */
const REFUSED = 'FLSBALLMILL'

async function apiHandler(route) {
  const url = new URL(route.request().url())
  const path = url.pathname
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

  const refuse = () => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, errors: ['Device not added in Account'] }) })

  if (path.endsWith('/deviceData/lastDP')) {
    const { devID, sensors } = JSON.parse(route.request().postData() ?? '{}')
    requested.push({ kind: 'lastDP', devID, sensors })
    // The ball mill laboratory is not in the simulated account: the platform refuses it.
    if (devID === REFUSED) return refuse()
    const gen = RAW[devID]
    if (!gen) return json({ devID, data: Object.fromEntries(sensors.map((s) => [s, []])) })
    const recent = gen(END - 30 * 24 * HOUR, END)
    const cast = NUMERIC.has(devID) ? (v) => v : asText
    return json({
      devID,
      data: Object.fromEntries(
        sensors.map((s) => {
          const row = recent.find((r) => r[s] != null)
          return [s, row ? { time: row.time, value: cast(row[s]) } : []]
        }),
      ),
    })
  }
  const m = /\/deviceData\/getDataByStEt\/([^/]+)\/(\d+)\/(\d+)/.exec(path)
  if (m) {
    const [, devID, s, e] = m
    requested.push({ kind: 'range', devID, start: Number(s), end: Number(e) })
    if (devID === REFUSED) return refuse()
    const dev = DEVICES[devID]
    return json(dev ? dev(Math.max(Number(s), END - 60 * 24 * HOUR), Math.min(Number(e), END)) : [])
  }
  if (path.includes('/bruce/insightResult/fetch/paginated/')) {
    const insight = decodeURIComponent(path.split('/').pop())
    requested.push({ kind: 'insight', insight })
    if (insight !== 'INS_c3snandyalrca') return json({ data: [], totalCount: 0, pagination: { page: 1, count: 200, totalPages: 1 } })
    return json({ data: RCA, totalCount: RCA.length, pagination: { page: 1, count: 200, totalPages: 1 } })
  }
  return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, errors: ['no such route in the JSW simulation'] }) })
}

/* ------------------------------ the run ------------------------------ */

const problems = []
const consoleErrors = []
async function step(name, fn) {
  try {
    await fn()
    console.log(`• ${name} … ok`)
  } catch (err) {
    problems.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
    console.log(`• ${name} … FAIL`)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
await page.route(API_GLOB, apiHandler)

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('bearer_token', 'Bearer e2e-test-token')
  localStorage.setItem('c3s.line', JSON.stringify({ plantId: 'jsw', lineId: 'kiln' }))
})
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const openTab = async (name) => {
  await page.getByRole('tab', { name }).click()
  await page.waitForTimeout(800)
}

await step('the JSW line is selected, branded by name, and reads its own insight', async () => {
  await page.locator('.appbar__titles h1').waitFor({ timeout: 10_000 })
  if (!(await page.locator('.appbar__plant').innerText()).includes('JSW Cement')) throw new Error('header does not name the plant')
  if ((await page.locator('.brand__wordmark').innerText()) !== 'JSW Cement') throw new Error('no logo supplied: the wordmark should show the plant name')
  const plantSel = page.locator('.scopebar label', { hasText: 'Plant' }).locator('select')
  if ((await plantSel.inputValue()) !== 'jsw') throw new Error('plant selector is not on JSW')
  const line = page.locator('.scopebar label', { hasText: 'Line' }).locator('select')
  const title = await line.getAttribute('title')
  for (const d of ['FLSCLINKER', 'JSW_C3S', 'ABBKLN_A1', 'INS_c3snandyalrca']) if (!title.includes(d)) throw new Error(`line title should name ${d}: ${title}`)
  if (!requested.some((r) => r.kind === 'insight' && r.insight === 'INS_c3snandyalrca')) throw new Error('the JSW insight was not requested')
  if (requested.some((r) => r.kind === 'insight' && r.insight !== 'INS_c3snandyalrca')) throw new Error('another plant’s insight was requested')
})

await step('every one of the fifteen devices is read, and no Adani device is', async () => {
  const devs = new Set(requested.filter((r) => r.kind === 'range').map((r) => r.devID))
  for (const d of Object.keys(DEVICES)) if (!devs.has(d)) throw new Error(`${d} was never requested`)
  if ([...devs].some((d) => d.startsWith('ADANI'))) throw new Error('an Adani device was requested on the JSW line')
  const probes = requested.filter((r) => r.kind === 'lastDP').map((r) => `${r.devID}:${r.sensors.join(',')}`).sort()
  if (!probes.includes('FLSCLINKER:D18') || !probes.includes('JSW_C3S:D7')) throw new Error(`newest-sample probe should ask FLSCLINKER:D18 and JSW_C3S:D7, asked ${probes.join(' ')}`)
})

await step('a device the platform refuses is named in Data sources, in the platform\u2019s words, and nothing else goes dark', async () => {
  const toggle = page.locator('.sources__toggle')
  await toggle.waitFor({ timeout: 10_000 })
  await page.waitForFunction(() => /\d failed/.test(document.querySelector('.sources__summary')?.textContent ?? ''), null, { timeout: 15_000 })
  const summary = await page.locator('.sources__summary').innerText()
  if (!/1 failed/.test(summary)) throw new Error(`summary: ${summary}`)
  if (!/1 stopped before the range/.test(summary)) throw new Error(`the stopped kiln feed laboratory should be counted: ${summary}`)
  await toggle.click()
  await page.locator('.sources__table').waitFor({ timeout: 5_000 })
  const ball = page.locator('.sources__table tr[data-device="FLSBALLMILL"]')
  if ((await ball.getAttribute('data-standing')) !== 'refused') throw new Error('ball mill should stand as refused')
  if (!(await ball.innerText()).includes('Device not added in Account')) throw new Error('the platform\u2019s message should be shown as is')
  const kf = page.locator('.sources__table tr[data-device="FLSKILNFEED"]')
  if ((await kf.getAttribute('data-standing')) !== 'stale') throw new Error(`kiln feed laboratory should stand as stopped before the range: ${await kf.getAttribute('data-standing')}`)
  const clinker = page.locator('.sources__table tr[data-device="FLSCLINKER"]')
  if ((await clinker.getAttribute('data-standing')) !== 'ok') throw new Error('clinker laboratory should have data in range')
  if (!/\d/.test(await clinker.locator('td').nth(3).innerText())) throw new Error('rows in range should be a number')
  // No error banner: the refusal is per device.
  if ((await page.locator('.notice--error').count()) !== 0) throw new Error('one refused device must not raise the page-level error')
  await toggle.click()
})

await step('a laboratory feed that stopped before the range is named at the top of the page, with its last date', async () => {
  const banner = page.locator('[data-testid="lab-behind"]')
  await banner.waitFor({ timeout: 15_000 })
  const text = await banner.innerText()
  if (!text.includes('FLSKILNFEED')) throw new Error(`banner should name the stopped kiln feed laboratory: ${text}`)
  if (!/last reported .*2026.*\(\d+ d ago\)/.test(text)) throw new Error(`banner should give the last date and age: ${text}`)
  if (text.includes('FLSCLINKER')) throw new Error('the clinker laboratory reports in range and must not be listed')
  // One click moves the range to the week up to the last kiln feed sample, and the kiln feed LSF appears.
  await banner.getByRole('button', { name: /Show the week up to/ }).click()
  await page.waitForTimeout(1500)
  if ((await page.locator('[data-testid="lab-behind"]').count()) !== 0) throw new Error('with the range moved back, no laboratory feed is behind it')
  await openTab('C3S Analysis')
  await page.getByRole('tab', { name: /Kiln Feed Quality/ }).click()
  const lsf = await page.locator('.lab-cell[title="FLSKILNFEED:D6"]').innerText()
  if (!/\d+\.\d/.test(lsf) || lsf.includes('no sample')) throw new Error(`kiln feed LSF should show a value in the week up to its last sample: ${lsf.replace(/\s+/g, ' ')}`)
  await openTab('Executive View')
  // Back to the live preset for the steps that follow.
  await page.locator('.trp__trigger').click()
  await page.getByRole('button', { name: 'Last 7 Days' }).click()
  await page.waitForTimeout(1500)
})

await step('Executive View: C3S from the right devices, compliance from the plant targets, no bin table', async () => {
  const legend = await page.locator('.legend').first().innerText()
  if (!legend.includes('Clinker C3S (XRD)') || !legend.includes('Predicted C3S (Bogue + Ridge)')) throw new Error(`trend legend names: ${legend}`)
  const table = page.locator('table.comp')
  const c3s = table.locator('tr[data-param="FLSCLINKER:D18"]')
  if (!(await c3s.locator('.comp__limits').innerText()).includes('LSL 48 · USL 52 % · Plant target (quality table): 50 ± 2')) throw new Error('lab C3S should be judged against the plant target and say so')
  const lsf = table.locator('tr[data-param="FLSKILNFEED:D6"]')
  if (!(await lsf.locator('.comp__limits').innerText()).includes('LSL 98 · USL 102')) throw new Error('kiln feed LSF should carry its 100 ± 2 target')
  if (!(await table.locator('tr[data-param="FLSCLINKER:D24"] .comp__limits').innerText()).includes('LSL — · USL 1.5')) throw new Error('free lime should be one-sided (< 1.5)')
  if (!(await c3s.locator('.comp__within').innerText()).match(/^\d/)) throw new Error('lab C3S compliance should be a percentage')
  const fl = table.locator('tr[data-param="FLSCLINKER:D24"]')
  if (!(await fl.locator('.comp__name').innerText()).includes('Clinker free lime')) throw new Error('free lime row missing')
  if ((await table.locator('tr[data-param^="ABB"]').count()) !== 0) throw new Error('no process row may be judged without a bin table')
  const note = await page.locator('.panel', { hasText: 'Specification Compliance' }).innerText()
  if (!note.includes('No kiln-feed bin limit table is configured for JSW Cement')) throw new Error('the table should say why process rows are absent')
  if (note.includes('RCA insight target band')) throw new Error('no row should fall back to the insight bands now that the plant supplied targets')
  const shifts = await page.locator('.shifts').innerText()
  if (!shifts.includes('Shift')) throw new Error('shift reports did not render')
  if (!shifts.includes('Kiln coal') || !shifts.includes('Solid AFR')) throw new Error(`shift recommendations should list the insight’s set-point moves: ${shifts.replace(/\s+/g, ' ').slice(0, 400)}`)
})
await page.screenshot({ path: `${SHOTS}/jsw-01-executive.png`, fullPage: true })

await openTab('C3S Analysis')
await step('C3S Analysis: the 48-hour timeline classifies with JSW_C3S:D7 and FLSCLINKER:D24', async () => {
  await page.locator('.rtl__bar').waitFor({ timeout: 15_000 })
  const legend = await page.locator('.zone-legend').innerText()
  if (!/Good clinker\s*\d/.test(legend)) throw new Error(`timeline legend: ${legend}`)
  const notClassified = Number(/Not classified\s*(\d+)/.exec(legend)?.[1] ?? '192')
  if (notClassified > 20) throw new Error(`${notClassified} of 192 intervals unclassified: predictions or free lime not read from the JSW devices`)
  const stats = await page.locator('.stats').innerText()
  if (!stats.includes('Predicted C3S (Bogue + Ridge)') || !stats.includes('Clinker C3S (XRD)')) throw new Error(`KPI labels: ${stats}`)
})

await step('a C3S above 80 % or below 0 % is not drawn: the trend\u2019s axis stays inside 0–80', async () => {
  const ticks = (await page.locator('.analysis .timeline .highcharts-yaxis-labels text').allTextContents()).map(Number).filter(Number.isFinite)
  if (!ticks.length) throw new Error('no y-axis labels on the C3S trend')
  if (Math.max(...ticks) > 80 || Math.min(...ticks) < 0) throw new Error(`the trend\u2019s axis reaches an impossible value: ${ticks.join(', ')}`)
  // Nothing near the outliers survives: every plotted C3S is a plausible clinker value.
  const ys = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.analysis .timeline .highcharts-series-1 .highcharts-point')) out.push(el.getAttribute('aria-label') ?? '')
    return out
  })
  if (ys.some((l) => /95\.5|-3\.2|120/.test(l))) throw new Error('an impossible C3S is still plotted')
  await openTab('Executive View')
  const bins = await page.locator('.panel', { hasText: 'C3S Distribution' }).locator('.highcharts-xaxis-labels text').allTextContents()
  if (bins.some((b) => /^(9\d|1\d\d)|^-/.test(b.trim()))) throw new Error(`the histogram has a bin for an impossible value: ${bins.join(' | ')}`)
  await openTab('C3S Analysis')
})

await step('the C3S trend keeps the insight\u2019s target band in view, so a flat prediction is never on the plot edge', async () => {
  // Band 59–63 (simulated insight). Fitted to the data alone (58.3–62.7) the axis stopped short of 63, and
  // live, where the prediction has been flat since 17 Oct, the line sat on the top border of the plot.
  const ticks = (await page.locator('.analysis .timeline .highcharts-yaxis-labels text').allTextContents()).map(Number).filter(Number.isFinite)
  if (Math.max(...ticks) < 63 || Math.min(...ticks) > 59) throw new Error(`the axis should cover the target band 59–63: ${ticks.join(', ')}`)
})

await step('lab quality groups the six laboratory devices by material, keeps the three D18s apart, hides the old physics C3S', async () => {
  const tabs = await page.locator('.lab__tab-name').allInnerTexts()
  for (const want of ['Raw Mill (Raw Meal) Quality', 'Ball Mill (Raw Meal) Quality', 'Kiln Feed Quality', 'Clinker Quality', 'Calciner 1 Hot Meal Quality', 'Calciner 2 Hot Meal Quality', 'Calcination — Combined', 'Fuel Quality', 'Model Outputs']) if (!tabs.includes(want)) throw new Error(`lab groups: ${tabs.join(' | ')}`)
  await page.getByRole('tab', { name: /^Clinker Quality/ }).click()
  const cells = async () => page.locator('.lab-cell').evaluateAll((els) => els.map((e) => [e.getAttribute('title'), e.querySelector('.lab-cell__name')?.textContent?.trim()]))
  const clinker = await cells()
  if (!clinker.some(([k, n]) => k === 'FLSCLINKER:D18' && n === 'Clinker C3S (XRD)')) throw new Error(`clinker cells: ${JSON.stringify(clinker)}`)
  if (!clinker.some(([k, n]) => k === 'FLSCLINKER:D5' && n === 'Clinker LSF')) throw new Error('clinker LSF (D5) missing')
  // A parameter the quality table lists but the feed does not carry yet shows "no sample", not nothing.
  const litre = await page.locator('.lab-cell[title="FLSCLINKER:D26"]').innerText()
  if (!litre.includes('never reported')) throw new Error(`litre weight (never filled) should read "never reported": ${litre.replace(/\s+/g, ' ')}`)
  await page.getByRole('tab', { name: /Kiln Feed Quality/ }).click()
  const kf = await page.locator('.lab-cell').evaluateAll((els) => els.map((e) => [e.getAttribute('title'), e.querySelector('.lab-cell__name')?.textContent?.trim()]))
  if (!kf.some(([k, n]) => k === 'FLSKILNFEED:D6' && n === 'Kiln feed LSF')) throw new Error(`kiln feed cells: ${JSON.stringify(kf)}`)
  // The kiln feed laboratory stopped 15 days ago: no sample in the 7-day range, and the cell says when it was last seen.
  const lsfCell = await page.locator('.lab-cell[title="FLSKILNFEED:D6"]').innerText()
  if (!/no sample in range · last seen \d+ d ago/.test(lsfCell)) throw new Error(`a stopped feed should say when it was last seen: ${lsfCell.replace(/\s+/g, ' ')}`)
  // A manual entry that was never filled says so, distinctly.
  const residue = await page.locator('.lab-cell[title="FLSKILNFEED:D19"]').innerText()
  if (!residue.includes('never reported')) throw new Error(`a tag with no reading on the platform should say "never reported": ${residue.replace(/\s+/g, ' ')}`)
  await page.getByRole('tab', { name: /Raw Mill/ }).click()
  const rm = await page.locator('.lab-cell').evaluateAll((els) => els.map((e) => [e.getAttribute('title'), e.querySelector('.lab-cell__name')?.textContent?.trim()]))
  if (!rm.some(([k, n]) => k === 'FLSRAWMILL01:D6' && n === 'Raw mill LSF')) throw new Error(`raw mill cells: ${JSON.stringify(rm)}`)
  await page.getByRole('tab', { name: /Fuel Quality/ }).click()
  const fuel = await cells()
  if (!fuel.some(([k, n]) => k === 'JSWBMBCLRMTR_KC:D18' && n === 'Kiln coal NCV')) throw new Error(`fuel cells: ${JSON.stringify(fuel)}`)
  if (!fuel.some(([k, n]) => k === 'JSWBMBCLRMTR_PC:D18' && n === 'PC coal NCV')) throw new Error('PC coal NCV missing')
  const vals = await page.locator('.lab-cell').evaluateAll((els) => els.map((e) => [e.getAttribute('title'), e.querySelector('.lab-cell__value strong')?.textContent]))
  const kc = vals.find(([k]) => k === 'JSWBMBCLRMTR_KC:D18')?.[1]
  const pc = vals.find(([k]) => k === 'JSWBMBCLRMTR_PC:D18')?.[1]
  if (kc !== '5120.0' || pc !== '4980.0') throw new Error(`the two D18 NCVs must not be mixed up: KC ${kc}, PC ${pc}`)
  await page.getByRole('tab', { name: /Model Outputs/ }).click()
  const model = await cells()
  if (model.some(([k]) => k === 'JSW_C3S:D5')) throw new Error('the old physics C3S (D5) should be hidden')
  if (!model.some(([k]) => k === 'JSW_C3S:D7')) throw new Error('predicted C3S should be listed under model outputs')
})

await step('an insight run on the laboratory C3S is labelled so, and the RCA panel shows the model\u2019s prediction at the event', async () => {
  const meta = await page.locator('.panel', { hasText: 'Root Cause Analysis' }).locator('.rca__meta').innerText()
  if (!/LAB C3S \(TRIGGER\)\s*58\.40%/i.test(meta)) throw new Error(`the trigger should be labelled as the lab C3S: ${meta.replace(/\s+/g, ' ')}`)
  const pred = /PREDICTED C3S\s*([\d.]+)%/i.exec(meta)
  if (!pred) throw new Error(`the model prediction at the event should be shown: ${meta.replace(/\s+/g, ' ')}`)
  // JSW_C3S:D7 at the event time (END − 7 h), as the simulated model writes it.
  const want = +(60.5 + 2.2 * Math.sin(((END - 7 * HOUR) / HOUR / 36) * 2 * Math.PI)).toFixed(2)
  if (Math.abs(Number(pred[1]) - want) > 0.011) throw new Error(`predicted C3S at the event should be ${want}, shows ${pred[1]}`)
  // Targets come from the insight although it writes no lime-level formula: the band is drawn.
  const legend = await page.locator('.analysis .legend').innerText()
  if (!/Target band 59–63%, target 61 · from RCA insight/.test(legend)) throw new Error(`the insight's target band should be drawn: ${legend}`)
})

await step('a recommendation that sends the operator to the SHC optimizer opens the JSW SHC Optimizer, in a new tab', async () => {
  const rec = page.locator('.panel', { hasText: 'Recommendations' }).first()
  const link = rec.locator('a.shc-link')
  if ((await link.count()) !== 1) throw new Error(`one SHC Optimizer link expected on the SHC action, found ${await link.count()}`)
  const href = await link.getAttribute('href')
  if (href !== 'https://iosense.io/launchpad/view?id=6ae8242cbe636bd66706b234&entityName=Kiln%20SHC%20Optimization&fromLink=true&isHidden=false') throw new Error(`SHC Optimizer link: ${href}`)
  if ((await link.getAttribute('target')) !== '_blank') throw new Error('the SHC Optimizer should open in a new tab')
  if ((await rec.locator('.shc-link--none').count()) !== 0) throw new Error('"not configured" should no longer show for JSW')
})

await step('the RCA panel reads kiln coal and AFR at the event from the DCS devices', async () => {
  const panel = page.locator('.panel', { hasText: 'Root Cause Analysis' })
  await panel.locator('.rca__params').waitFor({ timeout: 15_000 })
  const params = await panel.locator('.rca__params').innerText()
  if (!params.includes('Kiln coal') || !params.includes('Solid AFR')) throw new Error(`RCA parameters: ${params}`)
  if (params.includes('no reading')) throw new Error('a named process parameter has no reading at the event although its device reports every minute')
})

await step('process monitoring lists the named DCS tags by section and the unnamed ones apart', async () => {
  const groups = await page.locator('.process__group').allInnerTexts()
  // innerText follows the CSS text-transform, so compare without case.
  const names = groups.map((g) => g.replace(/\d+$/, '').trim().toLowerCase())
  for (const want of ['kiln', 'calciner', 'preheater', 'unnamed signals']) if (!names.includes(want)) throw new Error(`process sections: ${names.join(' | ')}`)
  const items = await page.locator('.process__item').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  for (const want of ['ABBKLN_A1:D154', 'ABBBHPH_A1:D63', 'ABBKLNAFRSGC_A1:D2', 'ABBKLN_A1:D7']) if (!items.includes(want)) throw new Error(`process items: ${items.join(' ')}`)
  // ABBKLN_A1:D7 (unnamed, 812) is not the predicted C3S JSW_C3S:D7.
  await page.locator('.process__item[title="ABBKLN_A1:D7"]').click()
  const detail = await page.locator('.process__detail').innerText()
  if (!detail.includes('alias not set') || !detail.includes('812')) throw new Error(`unnamed tag detail: ${detail}`)
})
await page.screenshot({ path: `${SHOTS}/jsw-02-analysis.png`, fullPage: true })

await openTab('Trend Analysis')
await step('Trend Analysis shows only the kiln trends JSW has tags for, and says what is missing', async () => {
  await page.locator('.etrend__grid, .state--empty').first().waitFor({ timeout: 15_000 })
  const process = page.locator('.panel', { hasText: 'Process Trends' })
  const cards = await process.locator('.etrend__card h4').allInnerTexts()
  if (cards.join('|') !== 'Kiln feed|Kiln coal|PC coal|Low-NOx coal|Solid AFR') throw new Error(`process cards: ${cards.join(' | ')}`)
  if ((await page.locator('.etrend__card[data-trend="kiln-fill"]').count()) !== 0) throw new Error('no filling degree without a kiln speed tag')
  // Every process card with data in the range draws a chart.
  if ((await process.locator('.etrend__card .highcharts-container').count()) !== 5) throw new Error('every process card should draw its chart')
  const lab = page.locator('.panel', { hasText: 'Laboratory Trends' })
  const labCards = await lab.locator('.ltrend__card h4').allInnerTexts()
  for (const want of ['Clinker C3S (XRD)', 'Predicted C3S (Bogue + Ridge)', 'Clinker free lime', 'Kiln feed LSF', 'Average calcination', 'Calciner 1 temperature']) if (!labCards.includes(want)) throw new Error(`lab trend cards: ${labCards.join(' | ')}`)
  if ((await lab.locator('.ltrend__card[data-trend="FLSCLINKER:D18"] .highcharts-container').count()) !== 1) throw new Error('lab C3S should be charted')
  // The kiln feed laboratory stopped 15 days ago: its card says so instead of drawing nothing silently.
  const lsf = await lab.locator('.ltrend__card[data-trend="FLSKILNFEED:D6"]').innerText()
  if (!lsf.includes('No samples for this parameter in the selected range')) throw new Error(`stopped lab feed should be stated: ${lsf.replace(/\s+/g, ' ')}`)
  const zones = await page.locator('.czones').innerText()
  if (!zones.includes('Clinker C3S (XRD)') || !zones.includes('Clinker free lime')) throw new Error(`zone plot titles: ${zones.slice(0, 200)}`)
  if (!zones.includes('lime level = C3S + 4.071 × (free lime − 1.5)')) throw new Error(`zones should be drawn from the insight's targets: ${zones.slice(0, 300)}`)
})
await step('opening an event adds the RCA-named JSW tags, labelled with the insight wording', async () => {
  const picker = page.locator('.etrend__picker select')
  const options = await picker.locator('option').allInnerTexts()
  if (options.length !== 3) throw new Error(`the picker should offer both events: ${options.join(' | ')}`)
  await picker.selectOption({ index: 1 })
  await page.waitForTimeout(1500)
  const cards = await page.locator('.panel', { hasText: 'Process Trends' }).locator('.etrend__card h4').allInnerTexts()
  for (const want of ['Solid AFR', 'Kiln coal', 'Low-NOx coal', 'Kiln feed']) if (!cards.includes(want)) throw new Error(`cards with an event: ${cards.join(' | ')} (picker: ${options.join(' | ')})`)
  // The event is marked on the laboratory trends too, with the last sample before it.
  const labC3s = await page.locator('.panel', { hasText: 'Laboratory Trends' }).locator('.ltrend__card[data-trend="FLSCLINKER:D18"]').innerText()
  if (!/last sample before event/i.test(labC3s)) throw new Error(`lab trend should show the last sample before the event: ${labC3s.replace(/\s+/g, ' ')}`)
  const samples = await page.locator('.etrend__table').innerText()
  // j1 names free lime (its zone) but no ash, so the fuel laboratory is not in its sample table.
  for (const want of ['Predicted C3S (Bogue + Ridge)', 'Clinker C3S (XRD)', 'Clinker free lime']) if (!samples.includes(want)) throw new Error(`lab samples: ${samples.replace(/\s+/g, ' ').slice(0, 300)}`)
  if (samples.includes('Kiln coal ash')) throw new Error('an ash tag is listed although the event never mentions ash')
})
await page.screenshot({ path: `${SHOTS}/jsw-03-trends.png`, fullPage: true })

/** "2026-08-18T08:00" -> the picker's "MM/DD/YYYY" and "HH:mm" fields. */
const toFields = (iso) => {
  const [d, t] = iso.split('T')
  const [y, m, day] = d.split('-')
  return { date: `${m}/${day}/${y}`, time: t }
}
async function setRange(from, to) {
  if (!(await page.locator('.trp__pop').count())) await page.locator('.trp__trigger').click()
  await page.locator('.trp__pop').waitFor()
  const a = toFields(from)
  const b = toFields(to)
  await page.getByLabel('Start date', { exact: true }).fill(a.date)
  await page.getByLabel('Start time', { exact: true }).fill(a.time)
  await page.getByLabel('End date', { exact: true }).fill(b.date)
  await page.getByLabel('End time', { exact: true }).fill(b.time)
  await page.getByRole('button', { name: 'Apply' }).click()
}

await step('a six-week range draws the laboratory C3S on C3S Analysis, with heartbeats on every device, within 15 s', async () => {
  await openTab('C3S Analysis')
  const t0 = Date.now()
  await setRange('2026-09-18T11:30', '2026-10-30T11:30')
  await page
    .waitForFunction(
      () => {
        const stat = [...document.querySelectorAll('.stat')].find((e) => e.textContent?.includes('Clinker C3S (XRD)'))
        return stat != null && /\d+\.\d{2}/.test(stat.querySelector('.stat__value')?.textContent ?? '')
      },
      null,
      { timeout: 30_000 },
    )
    .catch(() => {
      throw new Error('the laboratory C3S KPI never showed a value for the six-week range')
    })
  const secs = (Date.now() - t0) / 1000
  const points = await page.locator('.analysis .timeline .highcharts-series-1 .highcharts-point').count()
  if (points < 400) throw new Error(`the trend should draw every lab C3S sample of six weeks (about 500), drew ${points}`)
  if (secs > 15) throw new Error(`the laboratory C3S took ${secs.toFixed(1)} s to appear`)
  console.log(`    (lab C3S on screen after ${secs.toFixed(1)} s, ${points} samples)`)
  // Gateway fields and heartbeats are not sensors.
  const items = await page.locator('.process__item').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  if (items.some((k) => /:(RSSI|Status)$/.test(k ?? ''))) throw new Error(`gateway fields listed as signals: ${items.filter((k) => /RSSI|Status/.test(k ?? '')).join(' ')}`)
  const src = await page.locator('.sources__summary').innerText()
  if (!/stopped before the range|devices with data in range/.test(src)) throw new Error(`data sources summary: ${src}`)
  await page.screenshot({ path: `${SHOTS}/jsw-04-six-weeks.png`, fullPage: true })
})

await step('an RCA event outside the range still shows its lab C3S and the model prediction at it', async () => {
  // 30 Oct 10:00–11:30 plant time: both RCA events are earlier, and the only lab C3S in the range
  // (06:00 UTC) is more than 4 h after either. The 48-hour timeline still offers the events.
  await setRange('2026-10-30T10:00', '2026-10-30T11:30')
  await page.waitForTimeout(1500)
  await openTab('C3S Analysis')
  await page.locator('button.rtl__seg').first().waitFor({ timeout: 15_000 })
  await page.locator('button.rtl__seg').first().click()
  const rca = page.locator('.panel', { hasText: 'Root Cause Analysis' })
  if (!(await rca.locator('.event-nav__pos').innerText()).includes('outside range')) throw new Error('the picked event should be outside the range')
  await page
    .waitForFunction(
      () => {
        // The insight runs on the lab C3S, so the trigger is the lab value and the prediction is read from
        // the event's own look-back (the range holds no prediction within 30 min of the event).
        const cells = [...document.querySelectorAll('.rca__meta div')]
        const lab = cells.find((e) => e.textContent?.includes('Lab C3S (trigger)'))
        const pred = cells.find((e) => /^Predicted C3S/.test(e.textContent ?? ''))
        return lab != null && pred != null && /\d+\.\d{2}%/.test(lab.textContent ?? '') && /\d+\.\d{2}%/.test(pred.textContent ?? '')
      },
      null,
      { timeout: 15_000 },
    )
    .catch(async () => {
      const txt = await rca.locator('.rca__meta').innerText()
      throw new Error(`lab C3S and the model prediction should show for an event outside the range: ${txt.replace(/\s+/g, ' ')}`)
    })
})

await step('switching to Adani rescopes every load to its devices and insight', async () => {
  requested.length = 0
  await page.locator('.scopebar label', { hasText: 'Plant' }).locator('select').selectOption('adani')
  await page.waitForTimeout(1500)
  const devs = new Set(requested.filter((r) => r.kind !== 'insight').map((r) => r.devID))
  if (![...devs].every((d) => d.startsWith('ADANI'))) throw new Error(`after switching, devices requested: ${[...devs].join(' ')}`)
  if (!requested.some((r) => r.kind === 'insight' && r.insight === 'INS_df1b3c1a11de')) throw new Error('Adani insight not requested after switching')
  if (!(await page.locator('.appbar__plant').innerText()).includes('Adani Cement')) throw new Error('header did not follow the plant')
})

await browser.close()

console.log(`\nScreenshots: ${SHOTS}`)
if (consoleErrors.length) {
  problems.push(`console errors: ${consoleErrors.join(' || ')}`)
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`)
  for (const p of problems) console.log(`  - ${p}`)
  process.exit(1)
}
console.log('All JSW browser checks passed with no console errors.')
