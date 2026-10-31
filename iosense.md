# IOsense API Tracking — ADANI RCA C3S

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

## Resource IDs

| Resource | ID | Status |
|---|---|---|
| Lab / quality device | `ADANI_LAB` | Reachable via #2/#3. Sensors `D0`–`D58` carry data; `D59`+ empty. |
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

**Kiln-operation set** (`frontend/src/config/kilnTrends.ts`), shown in both modes in this order:
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

**Plant and line** (`frontend/src/config/plants.ts`): each line names its lab device, process
device and RCA insight; every fetch (#2, #3, #4) is scoped to the selected line. Only Line 1
(`ADANI_LAB`, `ADANI_RAW`, `INS_df1b3c1a11de`) is configured; no other line is offered until its IDs
are known.

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
| Limits | `config/binLimits.ts`, copied from `adani_lsl_usl_K05_round5.json` (Adani Maratha, generated 2026-10-27): LSL / USL / target / status per parameter per bin. LSL/USL = mean ± 1 sd of each bin's golden period |
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
(`frontend/src/config/dataWindow.ts`, env `VITE_DATA_END`, `"none"` to disable):

- `fetchRange` (#3, every lab and process load) clips its end at the cut-off, skips a window wholly
  after it without calling the platform, and drops any returned row after it.
- The newest-sample anchor (#2) is capped at the cut-off, so every "Last …" preset and the 48-hour
  timeline end there.
- RCA events and shift summaries (#4) after it are left out; shifts count as completed only if they
  ended by it.

## Impossible readings (2026-10-29)

Predicted C3S (`D55` on each line's lab device, e.g. `ADANI_LAB`) above **50 %** is dropped as it is
read (`frontend/src/config/validRanges.ts`, applied in `fetchRange` #3 and `fetchLatest` #2). It is treated as a
missing prediction everywhere: C3S trend, histogram, compliance, zone plots, 48-hour timeline, shift
figures. `ADANI_RAW:D55` is a different tag and is not affected.

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
