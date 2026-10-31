/**
 * RCA integration for insight INS_df1b3c1a11de ("C3S RCA Action").
 *
 * The types below mirror the schema the insight actually returns. Nothing is synthesised:
 * if a field is absent from the response it stays absent here, and the UI renders an
 * explicit "not supplied" state rather than a plausible-looking value.
 *
 * Observed shape of one result (identical across all 579 results at the time of writing):
 *   result.rca — time, batch_end, c3s, direction, zone, c3s_gap, primary_cause,
 *                root_cause{label: text}, recommendations{label: text}, outcome{label: text},
 *                why[], do[], result[], notes[]
 *   result.as_of — when the insight was computed
 *
 * `c3s_gap` is C3S minus a single target (constant across results), not a distance to a
 * band edge. The insight supplies no band and no per-parameter targets.
 */

import { api } from './apiClient'
import { parsePlantTime, toEpochMs } from '../lib/time'

export const C3S_RCA_INSIGHT_ID = 'INS_df1b3c1a11de'

/** A labelled sentence from the insight, e.g. `SHC` → "SHC low: 756 kcal/kg … (watch)". */
export interface RcaItem {
  label: string
  text: string
}

/** Severity the insight states in brackets at the end of a root-cause sentence. */
export type RcaSeverity = 'cause' | 'watch' | null

export interface RcaRootCause extends RcaItem {
  severity: RcaSeverity
}

/**
 * Quality targets the zone format carries (`rca.targets` and `rca.lime_level_definition`).
 * They define the clinker zones: see `lib/clinkerZones.ts`.
 */
export interface ClinkerTargets {
  c3s: number
  c3sBand: [number, number]
  freeLime: number
  freeLimeBand: [number, number]
  /** Lime level = C3S + k × (free lime − reference). */
  limeLevelK: number
  limeLevelFreeLimeRef: number
}

export interface RcaFinding {
  id: string
  /** Event time reported by the insight (plant-local string, normalised to epoch ms). */
  eventTime: number | null
  eventTimeRaw: string | null
  batchEnd: number | null
  /** C3S value the RCA was run against. */
  c3s: number | null
  direction: 'low' | 'high' | string | null
  /** Clinker zone the insight classified the event into, e.g. "Overlimed", "Unburnt". */
  zone: string | null
  /** C3S minus the insight's target. */
  c3sGap: number | null
  /** Null when the insight named no single primary cause — a real and common outcome. */
  primaryCause: string | null
  /** The insight's own statement of whether the cause is confirmed; null when it does not say. */
  confirmedCause: boolean | null
  /** Why C3S moved, one entry per contributing parameter. */
  rootCauses: RcaRootCause[]
  /** What to change, one entry per set point, with the insight's limits. */
  recommendations: RcaItem[]
  /** What the insight expects to happen if the recommendations are applied. */
  outcomes: RcaItem[]
  /** Short one-line forms of the above, as the insight emits them. */
  why: string[]
  actions: string[]
  expected: string[]
  /** Caveats attached to the recommendation. Empty for about half of the results. */
  notes: string[]
  asOf: string | null
  tags: string[]
  invocationTime: number | null
  /** Free lime the zone format reports with the C3S (`fcao`). */
  freeLime: number | null
  /** Null for results in the older format, which carry no targets. */
  targets: ClinkerTargets | null
}

interface RawResult {
  _id?: string
  insightID?: string
  resultName?: string
  result?: {
    rca?: Record<string, unknown>
    as_of?: string
  }
  tags?: unknown
  invocationTime?: unknown
}

interface PaginatedResponse {
  data?: RawResult[]
  totalCount?: number
  pagination?: { page?: number; count?: number; totalPages?: number }
}

export interface RcaPage {
  findings: RcaFinding[]
  /** Results the insight holds, of every kind (events and shift summaries). */
  totalCount: number
  totalPages: number
  page: number
  /** Results present in the response that could not be parsed into a finding. */
  malformedCount: number
  /** Shift summaries ("C3S RCA Shift") in the response: not events, so not findings. */
  shiftCount: number
  shifts: ShiftSummary[]
}

/**
 * One shift summary as the insight wrote it.
 *
 * Only `kind` and `deviations` are known fields of this result. Everything else under
 * `result.rca` is carried as the insight wrote it, sorted by shape: `{label: text}` objects as
 * labelled sections, string lists as lists, plain values as label / value pairs. Nothing is
 * renamed into a meaning the insight did not give it. Times are read only from keys that name
 * a time (start / end / time), in plant-local wall clock like every other insight time.
 */
export interface ShiftSummary {
  id: string
  /** When the insight ran (a UTC instant). */
  invocationTime: number | null
  /** Shift window the summary states, when it states one. */
  start: number | null
  end: number | null
  /** A time the summary states without saying start or end. */
  time: number | null
  /** The shift's own name or id, when the summary gives one. */
  name: string | null
  deviations: number | null
  /** The insight's recommended actions for the shift, in its order. */
  recommendations: string[]
  /** Root causes the summary names itself, when it names any. */
  causes: RcaItem[]
  /** The insight's own flag that the shift needs the SHC optimizer. */
  shcOptimizer: boolean | null
  /** Everything else, kept as read (e.g. `event_report`, `note`); not shown on its own. */
  sections: Array<{ key: string; items: RcaItem[] }>
  lists: Array<{ key: string; items: string[] }>
  values: Array<{ key: string; value: string }>
  asOf: string | null
}

/**
 * The insight also writes one summary per shift (`resultName: "C3S RCA Shift"`, tag `shift`,
 * `result.rca.kind: "shift"`) beside its per-event results. Those are not deviation events and
 * must never be read as one.
 */
export function isShiftResult(raw: RawResult): boolean {
  const tags = Array.isArray(raw?.tags) ? raw.tags : []
  return (
    raw?.result?.rca?.kind === 'shift' ||
    raw?.resultName === 'C3S RCA Shift' ||
    tags.some((t) => typeof t === 'string' && t.toLowerCase() === 'shift')
  )
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []
}

/** `{label: text}` → ordered items. Keeps the insight's key order; skips non-text values. */
function parseItems(raw: unknown): RcaItem[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  return Object.entries(raw as Record<string, unknown>).flatMap(([label, value]) => {
    const text = asString(value)
    return text ? [{ label, text }] : []
  })
}

/**
 * Labels the current insight format numbers instead of naming ("Problem", "Cause 1",
 * "Watch 2", "Set point 1", "Result 1"). The parameter is then named in the text.
 */
export const GENERIC_LABEL = /^(problem|cause|watch|set point|result|note)\s*\d*$/i

/** A "cause" that says no cause was found is not graded as one. */
const NOT_CONFIRMED = /\bnot confirmed\b|\bno (root )?cause\b/i

/**
 * How the insight grades a root cause: by its label in the current format ("Cause 1",
 * "Watch 1"), or by "(cause)" / "(watch)" closing the sentence in the older ones (the zone
 * format adds a full stop after it).
 */
function severityOf(label: string, text: string): RcaSeverity {
  // Only a numbered label grades: "Cause not confirmed" is a statement, not a cause.
  const byLabel = /^(cause|watch)\s*\d*$/i.exec(label.trim())
  if (byLabel) {
    const sev = byLabel[1].toLowerCase() as 'cause' | 'watch'
    return sev === 'cause' && NOT_CONFIRMED.test(text) ? null : sev
  }
  const m = /\((cause|watch)\)\.?\s*$/i.exec(text)
  return m ? (m[1].toLowerCase() as 'cause' | 'watch') : null
}

function asBand(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null
  const [lo, hi] = v.map(asNumber)
  return lo != null && hi != null && lo < hi ? [lo, hi] : null
}

/**
 * Targets plus the lime-level formula, read from the insight's own definition
 * ("lime level = C3S + 4.071 x (free lime - 1.5), …"). Without the formula the zones cannot
 * be drawn, so a result missing either part has no targets.
 */
function parseTargets(rca: Record<string, unknown>): ClinkerTargets | null {
  const t = rca.targets
  if (!t || typeof t !== 'object') return null
  const raw = t as Record<string, unknown>
  const c3s = asNumber(raw.c3s)
  const freeLime = asNumber(raw.free_lime)
  const c3sBand = asBand(raw.c3s_band)
  const freeLimeBand = asBand(raw.free_lime_band)
  const def = asString(rca.lime_level_definition)
  const m = def
    ? /c3s\s*\+\s*(\d+(?:\.\d+)?)\s*[x×*]\s*\(\s*free lime\s*[-−]\s*(\d+(?:\.\d+)?)\s*\)/i.exec(def)
    : null
  if (c3s == null || freeLime == null || !c3sBand || !freeLimeBand || !m) return null
  return {
    c3s,
    c3sBand,
    freeLime,
    freeLimeBand,
    limeLevelK: Number(m[1]),
    limeLevelFreeLimeRef: Number(m[2]),
  }
}

const SHIFT_START = /^(shift_)?(start|from|window_start|start_time)$/i
const SHIFT_END = /^(shift_)?(end|to|window_end|end_time|batch_end)$/i
const SHIFT_TIME = /^(time|shift_time)$/i
const SHIFT_NAME = /^(shift|shift_id|shift_name|name)$/i
const SHIFT_RECOMMENDATIONS = /^(recommended_actions|recommendations?|actions?|do)$/i
const SHIFT_CAUSES = /^(root_causes?|causes?|why|drivers?)$/i
const SHIFT_SHC = /^shc_?optimi[sz](er|ation)$/i

/** The shift object the insight nests: `{ code, name, start, end, label }`. */
function readShift(out: ShiftSummary, value: Record<string, unknown>) {
  const code = value.code ?? value.id ?? value.name
  if (typeof code === 'string' || typeof code === 'number') out.name = String(code)
  if (typeof value.start === 'string') out.start = parsePlantTime(value.start)
  if (typeof value.end === 'string') out.end = parsePlantTime(value.end)
}

function parseShiftSummary(raw: RawResult, index: number): ShiftSummary {
  const rca = (raw?.result?.rca ?? {}) as Record<string, unknown>
  const out: ShiftSummary = {
    id: raw._id ?? `shift-${index}`,
    invocationTime: toEpochMs(raw.invocationTime),
    start: null,
    end: null,
    time: null,
    name: null,
    deviations: asNumber(rca.deviations),
    recommendations: [],
    causes: [],
    shcOptimizer: null,
    sections: [],
    lists: [],
    values: [],
    asOf: asString(raw.result?.as_of),
  }
  for (const [key, value] of Object.entries(rca)) {
    if (key === 'kind' || key === 'deviations') continue
    if (SHIFT_SHC.test(key)) {
      out.shcOptimizer = value === true || String(value).toLowerCase() === 'true'
      continue
    }
    if (SHIFT_NAME.test(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      readShift(out, value as Record<string, unknown>)
      continue
    }
    if (SHIFT_RECOMMENDATIONS.test(key)) {
      // A list of sentences, or `{label: text}` as the events write them.
      out.recommendations.push(
        ...(Array.isArray(value) ? asStringArray(value) : parseItems(value).map((i) => (GENERIC_LABEL.test(i.label) ? i.text : `${i.label}: ${i.text}`))),
      )
      continue
    }
    if (SHIFT_CAUSES.test(key)) {
      out.causes.push(...(Array.isArray(value) ? asStringArray(value).map((text, i) => ({ label: `Cause ${i + 1}`, text })) : parseItems(value)))
      continue
    }
    if (typeof value === 'string' && SHIFT_START.test(key)) out.start = parsePlantTime(value)
    else if (typeof value === 'string' && SHIFT_END.test(key)) out.end = parsePlantTime(value)
    else if (typeof value === 'string' && SHIFT_TIME.test(key)) out.time = parsePlantTime(value)
    else if ((typeof value === 'string' || typeof value === 'number') && SHIFT_NAME.test(key)) out.name = String(value)
    else if (Array.isArray(value)) {
      const items = asStringArray(value)
      if (items.length) out.lists.push({ key, items })
    } else if (value && typeof value === 'object') {
      const items = parseItems(value)
      if (items.length) out.sections.push({ key, items })
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (String(value).trim()) out.values.push({ key, value: String(value) })
    }
  }
  return out
}

function parseFinding(raw: RawResult, index: number): RcaFinding | null {
  const rca = raw?.result?.rca
  if (!rca || typeof rca !== 'object') return null

  const direction = asString(rca.direction)
  const zone = asString(rca.zone)
  const c3s = asNumber(rca.c3s)
  // A finding with no value, direction or zone carries nothing renderable.
  if (c3s == null && !direction && !zone) return null

  return {
    id: raw._id ?? `rca-${index}`,
    eventTime: parsePlantTime(rca.time),
    eventTimeRaw: asString(rca.time),
    batchEnd: parsePlantTime(rca.batch_end),
    c3s,
    direction,
    zone,
    c3sGap: asNumber(rca.c3s_gap),
    primaryCause: asString(rca.primary_cause),
    rootCauses: parseItems(rca.root_cause).map((i) => ({ ...i, severity: severityOf(i.label, i.text) })),
    confirmedCause: typeof rca.confirmed_cause === 'boolean' ? rca.confirmed_cause : null,
    recommendations: parseItems(rca.recommendations),
    outcomes: parseItems(rca.outcome),
    why: asStringArray(rca.why),
    actions: asStringArray(rca.do),
    expected: asStringArray(rca.result),
    notes: asStringArray(rca.notes),
    asOf: asString(raw.result?.as_of),
    tags: asStringArray(raw.tags),
    invocationTime: toEpochMs(raw.invocationTime),
    freeLime: asNumber(rca.fcao),
    targets: parseTargets(rca),
  }
}

/**
 * Fetch a page of RCA findings.
 *
 * `PUT /api/account/bruce/insightResult/fetch/paginated/:insightID`
 *
 * Unlike most routes this family forwards the real downstream HTTP status, so a 404
 * genuinely means the insight does not exist.
 */
export async function fetchRcaFindings(
  {
    page = 1,
    count = 50,
    insightId = C3S_RCA_INSIGHT_ID,
  }: { page?: number; count?: number; insightId?: string } = {},
  signal?: AbortSignal,
): Promise<RcaPage> {
  const res = await api.put<PaginatedResponse>(
    `/api/account/bruce/insightResult/fetch/paginated/${encodeURIComponent(insightId)}`,
    { pagination: { page, count } },
    signal,
  )

  const rows = Array.isArray(res?.data) ? res.data : []
  const findings: RcaFinding[] = []
  let malformedCount = 0
  const shifts: ShiftSummary[] = []

  rows.forEach((row, i) => {
    if (isShiftResult(row)) {
      shifts.push(parseShiftSummary(row, i + (page - 1) * count))
      return
    }
    const parsed = parseFinding(row, i + (page - 1) * count)
    if (parsed) findings.push(parsed)
    else malformedCount++
  })

  // Newest event first.
  findings.sort((a, b) => (b.eventTime ?? 0) - (a.eventTime ?? 0))

  return {
    findings,
    totalCount: res?.totalCount ?? findings.length,
    totalPages: res?.pagination?.totalPages ?? 1,
    page: res?.pagination?.page ?? page,
    malformedCount,
    shiftCount: shifts.length,
    shifts,
  }
}

/**
 * Every result the insight holds, fetched page by page.
 *
 * The insight has no server-side time filter (verified: start/end parameters are ignored),
 * so the dashboard loads the full set once and filters it to the selected window itself.
 * The set is a few hundred small records, so this is cheap.
 */
export async function fetchAllRcaFindings(
  signal?: AbortSignal,
  insightId = C3S_RCA_INSIGHT_ID,
): Promise<RcaPage> {
  const PAGE = 200
  const MAX_PAGES = 25 // safety stop: 5,000 results

  const first = await fetchRcaFindings({ page: 1, count: PAGE, insightId }, signal)
  const findings = [...first.findings]
  let malformedCount = first.malformedCount
  const shifts = [...first.shifts]

  const pages = Math.min(first.totalPages, MAX_PAGES)
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        fetchRcaFindings({ page: i + 2, count: PAGE, insightId }, signal),
      ),
    )
    for (const r of rest) {
      findings.push(...r.findings)
      malformedCount += r.malformedCount
      shifts.push(...r.shifts)
    }
  }

  findings.sort((a, b) => (b.eventTime ?? 0) - (a.eventTime ?? 0))
  return {
    findings,
    totalCount: first.totalCount,
    totalPages: first.totalPages,
    page: 1,
    malformedCount,
    shiftCount: shifts.length,
    shifts,
  }
}
