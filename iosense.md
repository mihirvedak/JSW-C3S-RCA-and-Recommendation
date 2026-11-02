# IOsense API Tracking — C3S RCA and Recommendation (JSW Cement, Adani Cement)

> **2026-10-31 — device-configurable.** Every device, sensor, role, insight and limit now lives in
> one client spec per plant (`frontend/src/config/clients/adani.ts`, `jsw.ts`), compiled by
> `config/lineModel.ts`. Nothing else in `src/` names a device or a tag. See "Clients and lines"
> and "JSW Cement" below; the Adani sections further down are unchanged and still accurate for
> that plant.

Base URL: `https://connector.iosense.io`
Auth: `Authorization: Bearer <jwt>` (JWT already carries the `Bearer ` prefix when
returned by the SSO exchange — store and send as-is, never re-concatenate).

In dev the Vite server proxies `/api/*` to the base URL (see `frontend/vite.config.ts`)
so the browser is not blocked by CORS.

---

## functionID calls used by this app

| # | functionID / route | Method | Path | Used for |
|---|---|---|---|---|
| 1 | `sso_token_exchange` | GET | `/api/retrieve-sso-token/:token` | Exchange one-time `?token=` SSO handoff for the session JWT |
| 2 | `device_data_get_last_dp` | PUT | `/api/account/deviceData/lastDP` | Latest value per `(devID, sensor)` — KPI cards, freshness probes |
| 3 | `device_data_get_by_time_range` | GET | `/api/account/deviceData/getDataByStEt/:devID/:sTime/:eTime` | Time-series for the C3S timeline, lab history and process trends. Lab: one request up to 7 days, longer ranges in 7-day requests (4 at a time), never shortened. Process: day-sized chunks, 4 at a time, thinned to 5 min buckets over 24 h, capped at the newest 7 days. Trend Analysis: one `ADANI_RAW` request for event −1 h → +30 min and one `ADANI_LAB` request for the 96 h before the event, per selected RCA event (cached per event) |
| 4 | `bruce_insight_result_list_paginated` | PUT | `/api/account/bruce/insightResult/fetch/paginated/:insightID` | RCA findings for insight `INS_df1b3c1a11de` |

### Notes verified against the live platform (2026-10-17)

- **#2 and #3 are not account-scoped.** The `UserDevice` ownership lookup runs but its
  result is unused, so `ADANI_LAB` / `ADANI_RAW` return data even though they are not in
  the calling account's inventory. This is the only reason the app can read them.
- **#3 returns rows grouped by timestamp**, one object per distinct time with a key per
  sensor that reported at that instant — *not* one row per sensor. Sensors that did not
  report at a timestamp are simply absent from that row.
- `sTime` / `eTime` for #3 are **epoch milliseconds** in the path.
- FSV signals failure as **HTTP 200 with `success: false`**. Always check the flag, never
  the status code alone.
- The account-scoped variants (`device_get_by_id`, `devices_get_sensor_data_by_range`,
  `devices_list_paginated_search`) all reject these devices with
  `"Device not added in Account"` / `"User Device not added to your account"`.
  **Consequence: sensor display names and units for `ADANI_LAB` / `ADANI_RAW` cannot be
  read from the platform by this account.** See "Mapping status" below.

### Findings from the time-range work (verified live, 2026-10-22)

- **Historical retrieval works.** `ADANI_LAB` returns data back to Aug 2025; D55 / D58 (predicted
  / actual C3S) only exist from mid-2026, so older C3S windows are legitimately empty while
  the RCA insight (events from 2025-08-01) still has results there.
- **`ADANI_RAW` is heavy and wider than first mapped**: 124 sensors (`D0`–`D123`) every minute —
  about 0.9 MB for 6 h, 30 MB and 13 s for 7 days in one request.
- **The range route has no server-side filter.** `sensors`, `sensor` and `interval` query
  parameters are ignored; `sTime`/`eTime` accept seconds or milliseconds.
- **The insight has no time filter either** (start/end parameters are ignored), so all results
  are fetched (200 per page) and filtered to the window in the client.
- **Insight times are plant-local (IST), not UTC.** For all 579 results `batch_end` equals
  `invocationTime` (UTC) + 5 h 30 m. They are parsed with `parsePlantTime`; `Date.parse` would
  shift every event by the browser's offset relative to the UTC lab samples.

---

## Live JSW session, what the connector answered (2026-10-31 → 11-01)

Seen in the dev-server log from the plant's own signed-in browser (no token here, so these are the
only live observations):

- **18:38, 31 Oct:** `connect ECONNREFUSED 4.187.167.181:443` for `ABBKLN_A1` (24 h) and `FLSCLINKER`
  (16 h) — the connector refused connections for a moment; the browser saw HTTP 502, empty body.
- **09:09, 1 Nov:** nineteen `getDataByStEt` answers for `ABBKLN_A1`, `ABBBHPH_A1`, `ABBKLNAFRSGC_A1`,
  `FLSCLINKER`, `FLSCALCINATION1/2` as **HTTP 200 with an empty body**; the other devices answered
  normally. Each empty answer failed its device, and until 7a1d8ec one failed device blanked the page.
- **09:3x, 1 Nov** (with proxy logging on): the same `ABBKLN_A1` 24 h chunks answered **304 Not
  Modified, 0 B, ~2 s** — the browser was revalidating cached copies; a cut-off empty answer, once
  cached, is replayed empty on every later load.

- **09:5x, 1 Nov** (body snippets on): answers are **gzip / brotli compressed** (the byte counts above
  are compressed sizes). The latest-value route answers every device; **laboratory values arrive as
  strings** (`"40.25646999999998"`), the model's and the DCS's as numbers. Newest values:
  `FLSCLINKER` D18 lab C3S **16 Oct 2026 17:00**; `JSWCOAL_A1`, both calorimeters and `JSWCALN_A1`
  16 Oct; `FLSCALCINATION` 11 Jul 2025; `JSW_C3S` D7 and the three DCS devices current (1 Nov).
  So every laboratory feed stopped reaching the platform on 16 Oct while the model and the DCS went
  on — that, not the dashboard, is why no actual C3S shows in any recent window.

- **2 Nov** (inflated bodies): **every non-DCS device sends an `RSSI` heartbeat row every minute**
  (`{"time": …, "RSSI": "-1"}`), whether or not the laboratory sent anything; the DCS rows carry
  gateway fields beside the tags (`"Status": "2", "RSSI": "22"`). Real clinker samples sit between
  the heartbeats: `{"time":"2026-10-16T15:00:00.000Z","D18":"38.00825999999995","D24":"1.21",…}`.
  `JSWCALN_A1` (calciner temperatures) carries one value every 1–2 h on the hour, as text, and
  stopped on 16 Oct with the laboratory: it is read as a laboratory device.

Consequences in the app:
- Only sensor ids (D-tags) are readings; a row with none (a heartbeat) is dropped as it is parsed, and
  a laboratory device keeps only the sensors its spec lists (`fetchRange` `keep`, `keepFor` in
  `services/lineDataService.ts`). A two-month laboratory range was about a million rows in the
  browser and took many seconds to draw the C3S trend; it is now the real samples only. Data sources
  counts real samples, so a stopped laboratory reads "Stopped before range", not "Data in range".
- The RCA panel's "Actual C3S (lab)" falls back to the event's own 96-hour laboratory look-back when
  the selected range holds no lab C3S within 4 h of the event (an event picked from the 48-hour
  timeline or an older range).
- Readings sent as numeric strings are read as numbers (`asReading` in `services/deviceDataService.ts`);
  before 1 Nov they were discarded, so the laboratory devices looked empty even for ranges that held data.
- Stopped laboratory devices are reported in the Data sources panel ("Stopped before range", with the
  newest reading on the platform). A page banner listing them was added on 1 Nov and removed on 2 Nov
  at the plant's request.
- Every API call is sent with `cache: 'no-store'` (`services/apiClient.ts`): no conditional requests,
  no cached device data.
- A chunk the platform answers with a gateway error, no response, or a 2xx with an empty body is
  **split in half and asked for again**, down to 30 minutes, then retried once, then reported with the
  platform's message (`fetchChunkResilient` in `services/deviceDataService.ts`). An answer cut off
  for size therefore still arrives, in smaller pieces.
- The Vite proxy logs every proxied answer (`[proxy] GET … -> status bytes seconds`) and sets no
  proxy-side timeout, so the connector's behaviour can be read from the server log without a browser.

## JSW RCA insight schema, "C3S RCA Live" (read whole, 2026-11-02)

`INS_c3snandyalrca`: 584 results, all `resultName: "C3S RCA Live"`, event times 1 Jan → 16 Oct 2026
(plant-local `YYYY-MM-DD HH:mm:ss`, = `invocationTime` + 5 h 30 m). `result.rca` keys: `raw`,
`statement`, `root_cause` (`Problem`, `Cause n`), `recommendations` (`Action n`), `outcome`
(`Result n`), `shc_optimizer` (true on all), `shc_optimizer_section` / `_label`, **`source: "lab C3S"`**,
`time` = `lab_time` = `batch_end`, `zone` (Overlimed 302, Underlimed 261, Overburnt 15, Under burnt 6),
`direction`, `c3s`, `fcao`, **`level`** (lime level), `c3s_gap`, `do`, `why`, `result`, `targets`
(`c3s` 44, `c3s_band` [41.965, 46.035], `free_lime` 1.43, `free_lime_band` [0.93, 1.93]).

Differences from Adani's `INS_df1b3c1a11de`, and what the app does:
- **Run on the laboratory C3S, not the prediction.** `c3s` is the lab value at the lab sample's time.
  The app reads `source` (`RcaFinding.source`); for a lab-run event the RCA panel shows "Lab C3S
  (trigger)" and the model's prediction nearest the event (within 30 min, from the range or the event's
  own look-back), the trend tooltip says "lab", and the event is marked on the laboratory zone plot.
- **No `lime_level_definition`.** Targets were discarded, which switched off the zone plots, the C3S
  band and the 48-hour classification for JSW. The app now takes C3S + 4.071 × (free lime − target
  free lime) when it reproduces the insight's own `level` (within 0.06): it does on all 584 results
  (max difference 0.024), and the resulting zones match the insight's `zone` on 583 of 584.
- Checked by running the app's parser over the three live pages: 584 results, 0 malformed, all with
  targets, source and event time.

The model output `JSW_C3S:D7` has been **exactly 42.256 every 15 minutes since 17 Oct**: its laboratory
inputs stopped on 16 Oct and it repeats its last result. Predictions after 16 Oct are not real.

**"Predicted line not showing" on C3S Analysis (2 Nov):** replaying the plant's own captured session
showed the line was drawn but pinned to the top border of the plot — the y-axis was fitted to the data
alone, so the flat 42.256 became its maximum, and the target band (41.97–46.04) and target (44) were
mostly off the chart. The C3S trend now always keeps the insight's band and target in view
(`softMin` / `softMax`) with 8 % padding, so a flat prediction sits inside the plot against the band.

## Data sources panel and per-device failures (2026-11-01)

A line now loads each device on its own (three at a time, `services/lineDataService.ts`): a device
the platform refuses ("Device not added in Account", a session problem, a gateway error) is
reported by name with the platform's message and the other devices still render; only every
device failing raises the page-level error. The **Data sources** toggle at the end of the scope
bar (`components/DataSources.tsx`) opens a table per device: the platform's newest reading of any
listed sensor (#2, one lastDP per device), how many listed sensors have ever reported, rows the
current range returned (#3) and the newest of them, and the standing: *Data in range*, *Stopped
before range* (data on the platform, none in the window), *No data*, *Refused by platform*. It is
the first thing to open when a panel says "no data": it tells apart a feed that stopped, a device
the account cannot read, and a window that simply does not reach the data.

## Clients and lines (2026-10-31)

Onboarding a plant is one file in `frontend/src/config/clients/`:

| Part of the spec | What it carries | Where it is used |
|---|---|---|
| `devices[]` | Each device: id, `kind` (`lab` sparse / `process` dense), display label, groups, named sensors (id, name, unit, group, meaning, quality) | Fetch strategy (#3: lab devices one request per week, process devices chunked / thinned / capped), lab grid, process list, every label |
| `roles` | Which `(device, sensor)` is the predicted C3S, lab C3S, free lime, kiln feed, kiln / PC / low-NOx coal, AFR, kiln speed, BZT, SAT, TAD, O2, LSF…, coal / AFR ash and NCV | Newest-sample probe (#2), C3S trend, zones, 48-h timeline, RCA parameter mapping, kiln trends, shift set points, spec rows |
| `insightId` | The RCA / recommendation insight | #4 |
| `hidden`, `trendExcluded` | Tags listed but not shown / not charted | Lab grid, Trend Analysis |
| `kilnFilling` | The plant's filling-degree formula anchor, norm band, flag | Trend Analysis (needs `kilnFeed` + `kilnRpm`) |
| `specLimits`, `binLimits` | Plant LSL / USL per lab parameter; the kiln-feed bin table for process parameters | Executive View compliance |
| `shifts`, `predictedC3SMax`, `outputs`, `notes` | Shift pattern (default A/B/C), plausibility cap, what the model writes, open points | Shift reports; #2/#3 filtering; documentation |
| `PlantSpec`: `brand`, `dataEnd`, `shcOptimizerUrl` | Logo or wordmark, data cut-off, SHC Optimizer link | Header, every load, recommendations |

Rows are keyed `DEVICE:SENSOR` everywhere above the device routes (`services/lineDataService.ts`
merges the devices of a line), so same-numbered tags on different devices never collide. A spec
that names an unlisted sensor as a role, or lacks one of the three required roles (predicted C3S,
lab C3S, free lime), fails at start-up. A role a plant has not mapped switches that feature off
with a message, never a wrong figure.

---

## JSW Cement, Nandyal — Kiln line (configured 2026-10-31)

From the tag list supplied 2026-10-31. **Not yet verified against the live platform: no session
token for the JSW account was available.** `npm run test:e2e:jsw` (`frontend/src/tests/e2e-jsw.mjs`)
drives the line in a browser against a simulated platform (synthetic rows on all nine devices, the
insight in the Adani result schema) and passes with no console errors: every device is requested
and no Adani one, the newest-sample probe asks `JSW_C3S:D7` and `FLSCLINKER:D18`, the three `D18`s
stay apart, the compliance table judges C3S / free lime against the insight bands and says why
process rows are absent, Trend Analysis shows the two coal trends only, and switching the plant
selector to Adani rescopes every request. The items under "To verify" are what a live run must
confirm. Running the simulation also caught one real setting: Adani's plausibility cap (predicted
C3S above 50 % is dropped) would have discarded Nandyal's Bogue C3S (~60 %), so the cap is now per
line (`predictedC3SMax`, JSW 80 %).

| Resource | ID | Read as | Role(s) |
|---|---|---|---|
| Raw mill XRF | `FLSRAWMILL01` D7 SiO2, D8 Al2O3, D13 Fe2O3, D14 CaO, D15 MgO, D16 SO3, D17 Na2O, D18 K2O, D213 Cl, D6 LSF, D11 SM, D10 AM, D214 LOI; manual D216–D219 mix proportions, D19 / D20 residues | lab | `rawMixLsf` / `rawMixSm` / `rawMixAm` |
| Ball mill XRF | `FLSBALLMILL` same layout as the raw mill (D161 "Remarks" is text, not listed) | lab | — |
| Kiln feed XRF | `FLSKILNFEED` same layout: D7 SiO2, D8 Al2O3, D13 Fe2O3, D14 CaO, D15 MgO, D16 SO3, D17 Na2O, D18 K2O, D213 Cl, D6 LSF, D11 SM, D10 AM, D214 LOI, D19 / D20 residues | lab | `rawMeal*` (Bogue K0), `kilnFeedLsf` / `Sm` / `Am` |
| Clinker XRD/XRF | `FLSCLINKER` D26 litre weight, D6 SiO2, D8 Al2O3, D11 Fe2O3, D15 CaO, D17 MgO, D19 SO3, D20 Na2O, D22 K2O, D23 Cl, **D24 free lime**, D28 sum, D5 LSF, D13 SM, D10 AM, **D18 C3S**, D16 C2S, D14 C3A, D21 C4AF, D29 LC, D30 A/S, D31 alkalies | lab | `actualC3S`, `freeLime`, `clinkerSO3` |
| Calciner hot meal | `FLSCALCINATION1`, `FLSCALCINATION2`: D15 cyclone LOI, D16 % calcination, D5 SO3, D8 Na2O, D9 K2O, D11 Cl, D17 threshold (2 Cl + SO3), D18 A/S; `FLSCALCINATION`: D14 kiln feed LOI, D15 / D16 / D17 averages (SO3, calcination, temperature) | lab | — |
| Fuel lab | `JSWCOAL_A1` D12 kiln-coal ash, D17 PC-coal ash, D22 AFR NCV | lab | `coalAsh`, `pcCoalAsh`, `afrNcv` |
| Bomb calorimeters | `JSWBMBCLRMTR_KC` D18, `JSWBMBCLRMTR_PC` D18 | lab | `coalNcv`, `pcCoalNcv` (historical RCA only; defaults 5100 / AFR 3100 until cached) |
| Model outputs | `JSW_C3S` D0–D8 (writers JSW_S5 physics, JSW_S9 Bogue + Ridge), MQTT `devicesIn/JSW_C3S/data` | lab | `predictedC3S` = **D7**; D5 (old physics C3S) listed but hidden |
| Kiln DCS | `ABBKLN_A1` D154 kiln coal, D155 PC coal, D156 low-NOx coal (t/h) | process | `kilnCoal`, `pcCoal`, `lowNoxCoal` |
| Preheater DCS | `ABBBHPH_A1` D63 kiln feed (t/h) (the quality table pairs the clinker sample with it at the hour start) | process | `kilnFeed` |
| AFR feeding | `ABBKLNAFRSGC_A1` D2 solid AFR (t/h) | process | `solidAfr` |
| Calciner DCS | `JSWCALN_A1` D0 / D1 calciner 1 / 2 temperature (°C) — ABB source tag still to be confirmed | process | — |
| RCA insight | `INS_c3snandyalrca` | #4 | — |

The second list (quality-laboratory device table, 2026-10-31) confirmed the clinker (D18 / D24 /
D19) and kiln-feed tags of the first and added the rest. Its **data-status column is carried in
each tag's meaning**: raw mill and ball mill XRF "being captured"; kiln feed XRF and clinker oxides
"1 or no samples a day against 12 expected"; **clinker C3S, free lime, moduli and Bogue phases
"not being captured"**; manual entries (mix proportions, residues, litre weight, LOIs) "not being
filled"; the derived calcination figures "method / parser update needed". Until the clinker feed is
fixed the C3S trend, zones and timeline will be thin on live data.

Three `D18`s (clinker C3S, two NCVs), two `D7`s (raw-meal SiO2, predicted C3S) and the same XRF
layout on three devices exist on this line; the key scheme keeps them apart (unit-tested,
browser-tested).

**Specification limits** come from the targets in the quality table's column headers (`specLimits`
in `jsw.ts`, basis "Plant target (quality table)"): clinker C3S 50 ± 2 (predicted judged the same),
free lime < 1.5, SO3 < 1.00, LSF 92–95, SM 2.2–2.3, AM 1.3–1.5, C2S 20–25, C3A 6–8, C4AF 11–13, LC
27.5–28.5, A/S 0.6–1.0; kiln feed LSF 100 ± 2, SM 2.3 ± 0.1, AM 1.3 ± 0.1, Al2O3 3.5–3.6, Fe2O3
3.0–3.1; raw mill LSF 100 ± 2, SM 1.8–2.0, AM 0.9–1.1, Al2O3 3.5–3.6, Fe2O3 3.0–3.1; calcination
90–94 %, calciner SO3 < 2.00, temperature < 980 °C. One-sided targets set the one limit they state.

**What the dashboard shows for JSW with this list, and what it does not:**

| Feature | State |
|---|---|
| C3S trend, histogram, 48-h timeline, zone plots, RCA panel, recommendations, shift reports | On (predicted `JSW_C3S:D7`, lab `FLSCLINKER:D18`, free lime `FLSCLINKER:D24`) |
| Compliance, lab rows | 25 rows from the quality-table targets (above); no row falls back to the insight bands |
| Compliance, process rows | **Off** — no kiln-feed bin limit table; the table says so |
| Trend Analysis, process | All seven DCS tags supplied (`processTrends` in `jsw.ts`): kiln feed, kiln / PC / low-NOx coal, solid AFR, calciner 1 / 2 temperature; **no BZT, SAT, TAD, kiln inlet O2, kiln speed, cooler flow, filling degree** (no tags) |
| Trend Analysis, laboratory | 18 quality parameters over the selected range (`labTrends`): lab and predicted C3S, free lime, clinker SO3 / LSF / SM / AM, kiln feed LSF / SM / AM / CaO / SiO2, raw mill LSF, average calcination / calciner SO3 / temperature, kiln and PC coal ash; each sample a point, the RCA event marked with the last sample before it |
| RCA-named parameters | Fuel rates, kiln feed, fuel ash, NCV, free lime, raw-meal oxides, kiln feed LSF, raw-mix moduli resolve; **air-side / kiln-speed mentions resolve to nothing** (no tags) |
| Data cut-off | None (loads to the newest sample) |
| SHC Optimizer link | `https://iosense.io/launchpad/view?id=6ae8242cbe636bd66706b234&entityName=Kiln%20SHC%20Optimization&fromLink=true&isHidden=false` (plant, 2 Nov), opened in a new tab from every recommendation that says to go to the SHC optimizer — all 584 JSW results do |
| Brand | Wordmark "JSW Cement" until a logo file is supplied |

**To verify / still needed from the plant (the open questions):**

1. **Devices, sensors.** Confirm the device of "Low-NOx ash used": the list says `JSW_S5` (the writer); it is read here as `JSW_C3S:D2`. Confirm the calciner temperature tags (`JSWCALN_A1` D0 / D1, "find cyclone 1 tag in ABB"). Confirm the fifteen devices are in the dashboard account (the Adani devices were readable only because #2/#3 are not account-scoped). Most important: the quality table says clinker C3S and free lime are **not being captured** — the dashboard cannot work until they are.
2. **Kiln operation tags** (needed for the kiln trends, filling degree, RCA air-side mapping, bin compliance): kiln speed (rpm), burning zone temperature, secondary air temperature, tertiary air temperature, kiln inlet O2 and temperature, PC outlet temperature, cooler grate speed, cooler fan flows — device + sensor each.
3. **Laboratory tags still not in the lists:** AFR ash (furnace); coal moisture / volatiles if the RCA names them.
4. **Insight schema.** Does `INS_c3snandyalrca` return the same `result.rca` fields as `INS_df1b3c1a11de` (`time`, `c3s`, `fcao`, `zone`, `targets`, `lime_level_definition`, `root_cause{}`, `recommendations{}`, shift summaries with `kind: "shift"`)? The parser is schema-driven and tolerant, but zones and targets need those fields. Are its times plant-local like Adani's?
5. **Limits.** The quality-table targets are in; still needed: limits for coal / AFR ash and NCV, and, if a golden-period limit table per kiln-feed bin exists for Nandyal, that table (its bins, the Adani edges 370–565 t/h do not apply).
6. **Kiln filling degree:** the plant's anchor (feed, rpm, %) and norm / flag levels, once a kiln speed tag exists.
7. **Operations:** shift pattern (A/B/C 06/14/22 assumed), SHC Optimizer URL, logo file, any data cut-off, and the prediction cadence of `JSW_C3S:D7` (the ±15 min match tolerance assumes a 15-minute cycle).
8. **Output tags.** The dashboard only reads; `JSW_C3S` D0–D8 are listed under "Model Outputs" for inspection. Nothing publishes to `devicesIn/JSW_C3S/data` from here.

---

## Resource IDs (Adani)

| Resource | ID | Status |
|---|---|---|
| Lab / quality device | `ADANI_LAB` | Reachable via #2/#3. Sensors `D0`–`D58` carry data; `D59`+ empty. Spec: `config/clients/adani.ts` |
| Process device | `ADANI_RAW` | Reachable via #2/#3. Sensors `D0`–`D65` carry data. |
| RCA insight | `INS_df1b3c1a11de` | Reachable via #4. 579 results, `resultName: "C3S RCA Action"` (re-generated 2026-10-22; see "RCA insight schema"). |

---

## RCA insight schema (verified live, 2026-10-22)

`INS_df1b3c1a11de` was re-generated on 2026-10-22 and its result schema changed. It was
briefly empty (`totalCount: 0`) while regenerating; it now returns 579 results, all with
`resultName: "C3S RCA Action"` and the same shape. The earlier `steps` / `causes_found` /
`causes_watch` / `summary` / `targets` schema is gone, and `src/services/rcaService.ts` no
longer reads it.

`PUT /api/account/bruce/insightResult/fetch/paginated/:insightID` → `data.data[]`, each:

| Field | Type | Meaning |
|---|---|---|
| `result.rca.time`, `batch_end` | `"YYYY-MM-DD HH:mm:ss"` | Event time / batch end, plant-local, no zone |
| `result.rca.c3s`, `c3s_gap` | number | C3S at the event; `c3s − 39.85` in all 579 results (a single target, **not** a band edge) |
| `result.rca.direction` | `"low"` \| `"high"` | 398 low, 181 high |
| `result.rca.primary_cause` | string \| null | null in 503 of 579; else `Fuel Ash Addition`, `Kiln Feed LSF`, `Free Lime`, `Specific Heat Consumption (SHC)` |
| `result.rca.root_cause` | `{label: text}` | Why C3S moved. Text may end in `(cause)` or `(watch)`. Labels seen: `TSR`, `Fuel ash`, `Kiln feed LSF`, `SHC`, `Free lime`, `Summary` |
| `result.rca.recommendations` | `{label: text}` | What to change, with limits. Labels seen: `Solid AFR`, `PC coal`, `Kiln coal`, `Raw mix`, `Kiln feed`, `Set points`, `Fuel and feed`. "No … advised" is a valid value |
| `result.rca.outcome` | `{label: text}` | Expected result of applying the recommendations |
| `result.rca.why` / `do` / `result` | `string[]` | One-line forms of the three above |
| `result.rca.notes` | `string[]` | Caveats; empty in 290 of 579 |
| `result.as_of` | string | When the insight was computed |

Consequences for the app: no acceptable band and no per-parameter targets are supplied, so
the timeline draws no band and flags no out-of-band samples; the "Supporting Signals" panel
(which was built from the old per-step numbers) was removed.

---

## Mapping status

Sensor names, units and process sections come from two supplied tag maps
(`adani_lab_tag_map.json`, `adani_raw_tag_map.json`), transcribed into
`frontend/src/config/tagMaps.ts`. The platform's own sensor metadata is still not readable
with this account, so that file is the source; `sensorAliases.ts` can override one name.

| Device | Covered | Notes |
|---|---|---|
| `ADANI_LAB` | `D0`–`D51`: raw mix, kiln feed, hot meal ×2, clinker, coal, AFR | Names, units and meanings. `D44` / `D45` are clinker C3S (corrected / uncorrected). |
| `ADANI_LAB` | `D55`, `D58` | Predicted C3S and actual lab C3S, from the original mapping brief. |
| `ADANI_LAB` | `D52`–`D54`, `D56`, `D57` | Model outputs the lab tag map does not cover; labelled "Model output parameter n" and marked "alias not set". |
| `ADANI_RAW` | `D0`–`D123` | All 124 signals, with unit and section: Preheater 39, Calciner 6, Kiln 7, Cooler 65, Other 7. |

Corrections made while transcribing: the degree sign (`ｰC`, a half-width katakana artefact in
the export) is written `°C`; "Clinlker" in `D123` is spelt "Clinker". The tag map also grades
each process signal (usable / flag / unreliable / drop); that is kept as data on the sensor
definition but nothing is hidden by it.

Sanity check against live data (28 Aug 2026): raw mix `D0`–`D3` read SiO2 12.22, Al2O3 3.02,
Fe2O3 2.29, CaO 42.46; clinker `D44` C3S 42.02, `D43` free CaO 1.86; preheater gas temperatures
about 770–880 °C. These are the values the names imply.

### D-tag collision (verified live)

`ADANI_LAB:D55` = 39.599 (predicted C3S) and `ADANI_RAW:D55` = 371.46 (Cooler Fan 9 Amps)
on the same probe. Every lookup in this app is keyed by `(devID, sensorId)`, never by
D-tag alone.

---

## Observed sampling cadence (live probe, 2026-08-18 → 2026-08-28)

| Sensors | Device | Cadence |
|---|---|---|
| `D52`–`D57` (model outputs incl. predicted C3S `D55`) | `ADANI_LAB` | every 15 min |
| `D58` actual lab C3S | `ADANI_LAB` | irregular, roughly every 2 h |
| `D0`–`D25` raw mix / kiln feed | `ADANI_LAB` | irregular, roughly every 2 h, offset minutes |
| `D26`–`D33` hot meal | `ADANI_LAB` | sparse — ~2 samples per day |
| `D46`–`D47` coal | `ADANI_LAB` | sporadic |
| `D48`–`D51` AFR | `ADANI_LAB` | ~1 sample per day |
| all process sensors | `ADANI_RAW` | ~1 min |

Lab series are **never forward-filled or interpolated** — gaps are rendered as gaps.

**Latest datapoint across both devices is `2026-08-28T06:45Z`.** The dashboard anchors its
default window to the newest available sample rather than to `now`, and labels the window
accordingly, so it does not open on an empty "last 24 hours".

---

## Authentication: the two token types (verified live, 2026-10-17)

The platform issues **two different credentials** and they are not interchangeable.

| | Session token | One-time SSO handoff |
|---|---|---|
| Shape | JWT — `eyJ…` in three dot-separated parts | opaque hex, 64 chars |
| Used as | `Authorization: Bearer <jwt>` on every call | path param of `GET /api/retrieve-sso-token/:token` |
| Lifetime | the session | single use, short-lived |

Sending a handoff token as a bearer is the one failure that looks like a server fault but
is not. Verified responses for handoff token `c100aeff…cfa89a`:

| Call | Result |
|---|---|
| `PUT /api/account/deviceData/lastDP` with `Authorization: Bearer <handoff>` | `401 {"success":false,"errors":["Invalid Authorization Bearer! Try Logging-in again!"]}` |
| same call with no `Authorization` header | `401 {"success":false,"errors":["authentication required"]}` |
| `GET /api/retrieve-sso-token/<handoff>` | `400 {"success":false,"errors":["Invalid or expired token."]}` — already consumed or expired |

The two 401 bodies differ, which is what distinguishes "header never arrived" (proxy
stripped it) from "the platform refused this credential".

### How the app handles it

- `classifyToken()` in `src/auth/tokenStore.ts` tells the two shapes apart, so a handoff
  token pasted into the sign-in box is sent to the exchange instead of being stored as a
  bearer.
- A `401` from any call calls `rejectStoredToken()`, which clears `localStorage.bearer_token`
  and returns the app to the sign-in gate. Without this the app looks signed in and every
  request fails until Sign out is clicked by hand.
- Covered by `src/tests/tokenStore.test.ts`.

---

## Executive View

A second tab ("Executive View", the left-most and the landing tab) beside "C3S Analysis". It
uses the same global time selection and the same loaded data as the analysis tab, so its
histogram, trend and compliance table always describe the range shown in the time picker.

| Section | Source |
|---|---|
| C3S distribution (Actual / Predicted toggle) | `ADANI_LAB` `D58` (actual) and `D55` (predicted), 1-point bins (0.5 when the data spans < 4 points) |
| Actual vs predicted trend | Same series as the analysis trend; actual shows gaps, never interpolated |
| Specification compliance | `config/specLimits.ts` rows over lab (`ADANI_LAB`) or process (`ADANI_RAW` `D0`) data in the range |
| Last two completed shifts | `config/shifts.ts` windows; lab + process history fetched for the shift windows; RCA findings from `INS_df1b3c1a11de` |

**Needs plant input (nothing is invented):**
- **LSL / USL** are not configured anywhere in the project and the insight does not supply quality
  limits, so every row of the compliance table reads "Limits not configured" until
  `config/specLimits.ts` is filled in. A row with only one limit is classified on that side alone.
- **Shift pattern** is assumed to be A 06:00–14:00, B 14:00–22:00, C 22:00–06:00 plant time
  (`config/shifts.ts`).

"Completed" is judged against the end of the selected range, capped at the current time. For the
"Last …" presets that is the newest sample, so a lagging feed still shows its last real shifts;
a shift still in progress is never reported.


---

## Trend Analysis

A third tab with two modes (2026-10-28):

- **Opened from its tab bar: the selected range only.** The kiln-operation trends over the range in the
  time picker, read from the dashboard's own `ADANI_RAW` load (#3, no extra request; one reading
  per 5 minutes beyond 24 h). Each card shows its newest reading. Above them, the C3S vs free lime
  zone plots for the range, from the dashboard's own `ADANI_LAB` load (`D58` / `D55` vs `D43`) and the
  newest insight result's targets. Nothing tied to an event: no event mark, no RCA-named tags, no lab
  samples.
- **With an RCA event opened**, from the RCA panel's "View process trends →" link or this tab's
  event picker: the same range on every chart, with the event marked, and the event's own
  minute data (#3, event −1 h → +30 min) spliced in around it (`spliceRows`). The RCA sections below are
  added. "Event window (−1 h / +30 min)" narrows the charts to that window. An event outside the
  selected range (picked on the 48-hour timeline) shows its own window only. "Close event" returns
  to the range.
- **Ranges longer than 7 days.** Only the newest 7 days of process data are loaded (#3, counted back
  from the data cut-off), so the charts cover those days, not the whole range. An event opened further
  back gets its own 7 days of the range, centred on it (`contextWindow`, `useEventContext`: #3 in
  parallel chunks, thinned to 5 minutes). The note under the charts says which days are shown.

| Section (event open) | Source |
|---|---|
| Event summary | RCA result: `time` (plant-local), `zone`, `c3s` (**predicted** C3S — events are triggered on predicted C3S), `fcao` (free lime of the last usable lab), `c3s_gap` |
| C3S vs free lime zones | Same `ADANI_LAB` 96 h look-back. Actual: `D58` (Actual C3S (Lab)) vs `D43` (free CaO) of the same sample: the nearest `D43` within ±30 min (clinker chemistry is logged at offset minutes; samples are ~2 h apart). Results with none are counted under the plot, not dropped silently. Predicted: `D55` vs the newest `D43` up to 4 h before it. Zones from the insight's `targets` + `lime_level_definition`; the event is marked on the predicted plot |
| Process trends | Selected range from the dashboard load, plus `ADANI_RAW` via #3 over event −1 h → +30 min at full minute resolution. Event drawn as a line at the event time; value "at event" is the newest reading in the 5 min up to it. The kiln-operation set (below), then other tags the RCA names |
| Last 4 laboratory samples | `ADANI_LAB` via #3 over the 96 h before the event; per parameter, the four newest samples at or before the event time |

**Per line (2026-10-31).** A line may list the process tags it wants charted (`LineSpec.processTrends`;
JSW lists its seven DCS tags) and the laboratory parameters (`LineSpec.labTrends`); without a list
the mapped kiln-operation roles and lab roles are used (Adani). A **Laboratory Trends** panel charts
the quality parameters over the **whole** selected range in both modes (fixed 2 Nov: they were clipped
to the process data's newest 7 days, so a six-week range plotted 83 of ~500 clinker samples) (never the 1.5 h event window: a
laboratory reports every hour or day), each sample a point, the line broken across gaps longer than
2.5× the parameter's median interval; with an event open, the last sample before it is ringed.

**Kiln-operation set** (`frontend/src/config/kilnTrends.ts`), Adani's default, shown in both modes in this order:
BZT `D0`, Secondary Air Temp `D117`, kiln filling degree (computed), TAD Temperature `D122`, Kiln
Inlet O2 `D71`, PC Coal `D75`, Kiln Coal `D66`, Kiln RPM `D73`, cooler fan flow (computed), then the
RCA-named tags, in one 4-column grid. PC Outlet Temp `D77` is not charted (plant request, 2026-10-28). The tag map grades `D77` "flag", `D71` "unreliable" and `D73` "drop"; the cards
show that grading.
- **Kiln filling degree (%)** has no tag: the plant's formula (2026-10-28),
  `22.56 × (feed / 448) × (3.31 / rpm)` with feed `D74` (MT.431-FM1.F4:PV) and speed `D73`
  (MT.461-2C2.S1:PV), anchored on the Adani example 448 t/h at 3.31 rpm = 22.56 %. Rows with rpm < 0.5
  (kiln stopped) are skipped. Norm 14–16 % (shaded), flagged above 18 % (dashed line); the card shows
  the window's median, the share above 18 %, and the speed for 19 % at the event (rpm × filling / 19).
- **Cooler fan flow** is the sum of the 12 cooler fan flow tags at instants where all report; fan 8
  (`D53`) is left out because the tag map marks it "drop".

**Clinker zones** (`frontend/src/lib/clinkerZones.ts`): lime level = C3S + k × (free lime − ref) from
`lime_level_definition` (k 4.071, ref 1.5). Lime level above the C3S band top → Overlimed, below its
bottom → Underlimed; in between, free lime above / inside / below its band → Under burnt / Good
clinker / Overburnt. Matches the insight's own `zone` on result `6adee6b96ef9b41b70f92fa7`
(43.6, 1.74 → lime level 44.6 → Overlimed). Results in the old format carry no targets; the plot then
uses the newest result that does.

**Which RCA-named tags are added** is decided by `frontend/src/config/rcaParameters.ts`, from the insight's
own labels (zone, primary cause, root-cause labels, recommendation labels; a recommendation that
advises no change is skipped). Every tag on the tab lists the label that brought it in. Rules:

| RCA label (match) | `ADANI_RAW` | `ADANI_LAB` |
|---|---|---|
| `LSF` (e.g. "Kiln feed LSF high") | — | D23 Kiln feed LSF |
| `Raw mix …` | — | D10 / D11 / D12 Raw mix LSF / SM / AM |
| Free lime | — | D43 Clinker Free CaO |
| Overlimed / Underlimed / lime level | — | D44 Clinker C3S, D43, D23 |
| Unburnt / burnt / burning | D0 Burning Zone Temp | D43 |
| Kiln share of coal | D66 Kiln Coal, D75 PC Coal | — |
| Coal per t clinker | D66, D75, D74 Kiln feed | — |
| Kiln coal | D66 | — |
| PC coal | D75 | — |
| AFR | D118 Solid AFR | — |
| TSR (derived) | D118, D66, D75 | — |
| SHC (derived) | D66, D75, D118, D74 | — |
| Coal ash | — | D47 Coal Ash |
| Fuel ash / Ash fed / Ash addition | D66, D75, D118 | D47, D48 AFR Ash (furnace) |
| Kiln feed (rate) | D74 | — |
| NCV / calorific | — | D46 Coal NCV, D49 AFR NCV (net) |

Actual and predicted C3S (`ADANI_LAB` D58 / D55) always lead the sample table. Labels matched
are those seen in both result formats (`C3S RCA Action` and `C3S RCA Action Zone`); a label with
no rule is simply not charted. **Not verified against live data in this session** (no browser
token available); the e2e test serves the zone-format record `6adee6b96ef9b41b70f92fa7`.

### SHC Optimizer hand-off (2026-10-28)

A recommendation the insight sends to SHC optimisation carries an "Open SHC Optimizer ↗" link
to `https://demo.iosense.io/launchpad/view?id=6ad86ac0fe275c6e1f553ae2&entityName=Kiln%20SHC%20Optimiser%20&fromLink=true&isHidden=false` (`frontend/src/config/links.ts`,
env `VITE_SHC_OPTIMIZER_URL`), opening in a new tab. It shows on that action only: in the Recommendations panel and
in a shift report's recommended actions. The test is the insight's own wording, in the action's
label or text (`needsShcOptimizer` in `frontend/src/lib/recommendations.ts`): "SHC optimizer / optimisation" or
"optimise (the kiln) SHC", as in the live action *"… SHC optimizer: go to the kiln SHC optimizer. SHC
now 852 kcal/kg vs target 703, reduce by 149."* An action that only quotes SHC figures ("TSR 12.6% to
13.5%, SHC 747 to 712 kcal/kg") gets no link.

---

## C3S Analysis layout (whiteboard redesign, 2026-10-27)

Section order: plant / line (header) → RCA classification, last 48 h → two columns (left:
predicted vs actual C3S + last RCA events; right: Root Cause Analysis over Recommendations) →
laboratory quality (last vs previous) → process monitoring. (The "Last 4 Days Parameter Analysis"
panel was removed on 2026-10-28; process compliance by kiln-feed bin is on the Executive View.)

**Plant and line** (`frontend/src/config/plants.ts`): each line's client spec names its devices,
roles and RCA insight; every fetch (#2, #3, #4) is scoped to the selected line. Configured: JSW
Cement / Kiln line (default) and Adani Cement / Line 1.

**Classification colours** (`frontend/src/lib/zones.ts`, the single source): Good clinker green,
Overlimed orange, Under burnt light blue, Overburnt dark blue, Undetermined yellow, plus
**Underlimed purple** (produced by the insight's zone geometry but missing from the brief's
table) and "No prediction" hatched grey (not a classification).

| Section | Source |
|---|---|
| 48 h timeline | `ADANI_LAB` via #3 over the 48 h up to the newest data + 4 h free-lime look-back; 192 × 15 min. Colour = insight zone when an RCA event is in the interval, else predicted C3S (`D55`) classified with the last lab free lime (`D43`, ≤ 4 h old) and the insight targets, else Undetermined; no D55 → No prediction |
| Trend | Unchanged series; band + target line from the insight `targets`; RCA events as diamonds in zone colour; tooltip shows each prediction's class |
| RCA panel | Insight result + nearest lab C3S (±4 h) + process values at the event (`ADANI_RAW`, newest reading ≤ 5 min before). Cause status from `confirmed_cause`; unconfirmed causes say validation is required |
| Recommendations | Keyed `recommendations` (carry limits) + `do` lines they do not cover; current → suggested and limits parsed from the insight text only |

Live format note (seen 2026-10-27): root causes are now keyed `Problem` / `Cause n` / `Watch n`,
recommendations `Set point n`, outcomes `Result n`; the parameter is named in the text. Severity is
read from the key, and a "cause" that says the root cause is not confirmed is not graded as one.

**C3S shown on the dashboard (2026-10-27):** only Actual C3S (Lab) `ADANI_LAB:D58` and Predicted
C3S `ADANI_LAB:D55`. The clinker Bogue C3S values `D44` (free-lime corrected) and `D45`
(uncorrected) are hidden everywhere (`HIDDEN_LAB_SENSORS` in `config/deviceMappings.ts`); they
remain in the sensor registry.

---

## Shift summaries from the RCA insight (2026-10-28)

`INS_df1b3c1a11de` also writes one result per shift beside its per-event results:
`resultName: "C3S RCA Shift"`, tag `shift`, `result.rca.kind: "shift"`, `result.rca.deviations`.
Shifts with no deviations may have no summary (they can be deleted with
`deleteMany({ …, "result.rca.deviations": 0 })`).

- **Never read as events.** `isShiftResult()` in `services/rcaService.ts` separates them on any
  of the three markers; they are not findings, not "unparseable", and not in the event total.
- **Numbered labels (2026-10-31).** In the live format a set-point recommendation is keyed "Set point n"
  and names the set point in the sentence; shift reports now group by the set point parsed from the
  sentence ("Kiln coal"), not by the number, so the report reads "Reduce Kiln coal" and finds its tag.
- **Executive View, Last Two Completed Shifts.** Each shift shows only its name and time, the
  root cause analysis and the complete recommendations (`components/ShiftRecommendations.tsx`):
  - RCA: the causes the summary names itself, else the drivers named by the shift's RCA events
    (one result per event time, the newest; a numbered label such as "Cause 1" is grouped by its text).
  - Recommendations: the summary's `recommended_actions`, in full, when there is a matching summary
    (`lib/shiftSummaries.ts`: by its stated window ±15 min, else a stated end/time inside the shift,
    else run time up to 30 min after the shift); otherwise the set-point moves and statements of the
    shift's events. A "Hold: …" action gets a Hold tag; the SHC Optimizer link sits on the action that
    calls for it, or follows the list when only `shc_optimizer` is set.
  - Not shown: `event_report`, `note` (the same text), the raw `shift` fields, C3S statistics and the
    dashboard's own assessment.
- **Live schema (seen 2026-10-28, Shift C of 24 Jul):** `result.rca` = `kind: "shift"`, `deviations`
  (number), `shc_optimizer` (boolean), `event_report` (text), `note` (text), `shift: { code, name,
  start, end, label }` (plant-local `YYYY-MM-DD HH:mm:ss`), `recommended_actions` (string[]).
  Unknown keys are still read (`sections` / `lists` / `values`) but not displayed.

---

## Specification Compliance by kiln-feed bin (2026-10-28)

Executive View → Specification Compliance is one table, columns **Parameter | Below LSL % | LSL – USL %
| Above USL %**, sorted by LSL – USL % (highest first), the in-range cell green / orange / red:

- **Laboratory rows**: C3S actual/predicted, coal/AFR ash, clinker CaO/Al2O3/free CaO, kiln feed LSF /
  SM / AM (`ADANI_LAB` D23 / D24 / D25), against one fixed LSL / USL each (`config/specLimits.ts`),
  supplied by the plant 2026-10-28 with their basis (shown in the row): C3S 41.5–44.5 (plant 43 ± 1.5,
  same for predicted), coal ash 30.5–34.8, AFR furnace ash 24.1–30.8 (n=86), clinker CaO 62.9–63.7,
  Al2O3 5.37–5.79, free CaO 1.2–1.8 (plant 1.5 ± 0.3), kiln feed LSF 102.8–106.6, SM 2.15–2.48,
  AM 1.13–1.44 (history p5–p95). Plant notes: lab C3S runs a little low of its band (median 42.2) and
  free lime high (median 1.76); the model's inferred D56 (~45 % zeros) must not be used for AFR ash.
- **Process rows**: BZT, SAT, TAD Temperature, PC Outlet Temp, Solid AFR, PC Coal, Kiln Coal, Kiln
  RPM, Kiln feed, Cooler Fan 1–7, 9–13 Flow. Each reading is judged against the LSL–USL of the
  kiln-feed bin it was taken in; the three percentages are summed over all bins.

| Item | Detail |
|---|---|
| Limits | `config/clients/adaniBinLimits.ts` (the Adani spec's `binLimits`), copied from `adani_lsl_usl_K05_round5.json` (Adani Maratha, generated 2026-10-27): LSL / USL / target / status per parameter per bin. LSL/USL = mean ± 1 sd of each bin's golden period |
| Bins | Kiln feed `MT.431-FM1.F4:PV` = ADANI_RAW D74: 370–440, 440–460, 460–480, 480–500, 500–520, 520–565 t/h |
| Mapping | File parameter names → ADANI_RAW tags by tag-map label (unit-tested: every name maps) |
| Calculation | Each process reading is paired with the kiln feed in the same row and judged against that bin's LSL–USL. Below / within / above % = count / judged, over all bins. Not judged: feed missing or outside 370–565, or no limit for that bin |
| Status | Green ≥ 68 %, yellow ≥ 50 %, red below (`BIN_THRESHOLDS`) — 68 % because limits are ±1 sd |
| Units guard | Readings whose median is > 3× from every bin target are reported "Units may not match the limit table", not as 0 % |

**To verify with the plant (not resolvable from the data here):**
- **Cooler fan flows**: the file's values are 180–3,520; ADANI_RAW D9… are labelled m³/sec. Likely
  m³/h or a different scaling.
- **PC Outlet Temp**: the file has ~50–55 (440–460 bin only, graded FLAG); a precalciner outlet
  temperature is normally ~850 °C. The file's tag `MT.451-PR1.T1:PV` may not be our D77.
- **Kiln RPM** is graded DROP in the file (not to be used as a set point); shown, with its grade.

---

## Data cut-off (2026-10-28)

At the plant's request nothing after **28 Aug 2026, 03:00 plant time** is loaded
(`PlantSpec.dataEnd` in `config/clients/adani.ts`, applied by `config/dataWindow.ts`; env `VITE_DATA_END` overrides every plant, `"none"` to disable):

- `fetchRange` (#3, every lab and process load) clips its end at the cut-off, skips a window wholly
  after it without calling the platform, and drops any returned row after it.
- The newest-sample anchor (#2) is capped at the cut-off, so every "Last …" preset and the 48-hour
  timeline end there.
- RCA events and shift summaries (#4) after it are left out; shifts count as completed only if they
  ended by it.

## Impossible readings (2026-10-29, extended 2026-11-02)

A C3S reading that cannot be a clinker value is dropped as it is read (`LineModel.isImplausible`,
applied in `services/lineDataService.ts` on every #2 / #3 result), so it is treated as missing
everywhere: C3S trend, histogram, compliance, zone plots, 48-hour timeline, KPIs, shift figures.

- **Every line: a laboratory or predicted C3S below 0 % or above 80 %** (`LineSpec.c3sRange`, default
  0–80; JSW plant request 2026-11-02, after outliers stretched the trend's axis to 0–100). 0 % and
  80 % themselves are kept. Other tags are untouched.
- **Adani: a predicted C3S above 50 %** (`predictedC3SMax`, plant request 2026-10-29); JSW's cap is 80 %.

The RCA insight's own event values are not filtered: on JSW they all lie between 25 and 60 %.

## Load order and request count (2026-10-28)

The dashboard opens on **Last 7 Days** (plant request, 2026-10-28). That load sends #2, #4 and the
lab range as below, the ADANI_RAW range as 7 × 24 h chunks (~21 MB, four at a time, thinned to 5 min
on arrival), plus the last two shifts' own 16 h lab + process fetch (a 7-day window is thinned, so
it cannot be reused). Production build, simulated platform: C3S trend 1.8 s, shift reports 2.4 s,
process compliance 5.7 s; 15 requests, 25.5 MB.

What one Executive View load sends for the 24-hour preset:

| Call | Requests | When |
|---|---|---|
| #2 lastDP ADANI_LAB (newest-sample probe) | 1 | at once |
| #4 insightResult page 1, then pages 2…n side by side | 1 + n−1 | at once / after page 1 |
| #3 getDataByStEt ADANI_LAB, 24 h | 1 | at once (does not wait for #2) |
| #3 getDataByStEt ADANI_RAW, 4 × 6 h side by side | 4 | at once |

- With the data cut-off in the past, presets hang from the cut-off before #2 answers; #2 only moves
  the anchor earlier if the feed stopped before it.
- The process load is split into `processChunkMs(span)` chunks (span / 4, between 6 h and a day),
  four in flight at a time.
- The last two shift reports are built from the rows the dashboard already loaded when the shifts
  lie inside its window at full resolution (≤ 24 h, not thinned); otherwise `useShiftReports` loads
  the shifts' span itself.
- Shift reports and the 48-hour timeline refetch only on Refresh (`refreshKey`), not each time the
  lab load completes.

Measured against a simulated platform (250 ms per request + 2.3 MB/s, 124 tags per minute, 650 RCA
results): dev server 15 requests / 11.5 MB before → 10 / 4.8 MB after (StrictMode doubles them in dev);
production build: C3S trend 1.2 s, process compliance 1.8 s, shift reports 2.1 s.
