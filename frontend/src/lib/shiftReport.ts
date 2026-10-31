/**
 * Per-shift report for the Executive View.
 *
 * Built from three things that all fall inside one shift window:
 *   - the laboratory C3S samples (the line's actual and predicted C3S),
 *   - the process history for the set points the RCA insight recommends changing,
 *   - the RCA insight's own findings for deviations whose event time is in the shift.
 *
 * Nothing here invents a cause or a set-point change. Root causes and recommendations are
 * the insight's own text, grouped and counted; the evidence attached to a recommendation is
 * how often the insight made it in the shift, what the insight said the set point was at the
 * time, and what the process data shows for that set point over the shift. How much weight
 * that deserves is stated in `assessment`, and every recommendation is still an insight
 * recommendation that needs process-engineer validation.
 */

import { extractSeries, matchSamples } from './series'
import type { Point, TimestampRow } from './series'
import type { ShiftWindow } from './shifts'
import type { RcaFinding, RcaSeverity } from '../services/rcaService'
import { GENERIC_LABEL } from '../services/rcaService'
import { parseAction } from './recommendations'
import type { LineModel } from '../config/lineModel'
import type { Role } from '../config/clients/types'

/**
 * Recommendation labels the insight uses that are measured on a process device, by role; the
 * line resolves each to its own tag. Labels with no entry (raw mix, "Set points", "Fuel and
 * feed") have no single sensor.
 */
export const ACTION_ROLES: Readonly<Record<string, Role>> = {
  'Kiln coal': 'kilnCoal',
  'PC coal': 'pcCoal',
  'Low-NOx coal': 'lowNoxCoal',
  'Solid AFR': 'solidAfr',
  'Kiln feed': 'kilnFeed',
}

const inShift = (t: number, w: ShiftWindow) => t >= w.start && t < w.end

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface LabSummary {
  /** Actual (laboratory) C3S samples in the shift. */
  n: number
  mean: number | null
  min: number | null
  max: number | null
  first: number | null
  last: number | null
  /** Predicted C3S values in the shift. */
  nPredicted: number
  meanPredicted: number | null
  /** Actual samples that have a prediction inside the match tolerance. */
  nMatched: number
  /** Mean of actual − predicted over the matched samples, in percentage points. */
  meanError: number | null
}

export interface ProcessObservation {
  /** Sensor key of the set point. */
  key: string
  label: string
  unit: string | null
  n: number
  mean: number
  min: number
  max: number
}

export interface ActionEvidence {
  eventTime: number | null
  /** What the insight said the set point was, and what it advised. */
  from: number
  to: number
  unit: string
  /** The insight's operating limits for the set point, when it gave them. */
  lo: number | null
  hi: number | null
  text: string
}

export interface ActionSummary {
  label: string
  direction: 'increase' | 'decrease'
  /** In how many of the shift's analysed deviations the insight made this recommendation. */
  count: number
  /** Mean advised change across those events (signed, in the set point's unit). */
  meanChange: number
  unit: string
  examples: ActionEvidence[]
  /** The set point's behaviour over the shift, from process data; null if unmapped or absent. */
  process: ProcessObservation | null
}

export interface CauseSummary {
  label: string
  /** The strongest grading the insight gave it in this shift. */
  severity: RcaSeverity
  count: number
  /** The insight's sentence from the most significant event that named it. */
  example: string
}

export type AssessmentLevel = 'none' | 'limited' | 'repeated'

export interface ShiftReport {
  shift: ShiftWindow
  lab: LabSummary
  /** Analysed deviations in the shift, most significant first. */
  events: RcaFinding[]
  low: number
  high: number
  causes: CauseSummary[]
  actions: ActionSummary[]
  /** The insight's own "no change advised" statements, de-duplicated. */
  holds: string[]
  /** The insight's caveats, de-duplicated. */
  notes: string[]
  assessment: { level: AssessmentLevel; message: string }
}

/* ------------------------------------------------------------------ *
 * Parsing the insight's recommendation sentences
 * ------------------------------------------------------------------ */

/** "Reduce Kiln coal from 31.0 to 28.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h." */
const RECOMMENDATION =
  /^(increase|raise|reduce|decrease|lower)\s+.+?\s+from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)\s*([^\s(]*)\s*\(([+-]?\d+(?:\.\d+)?)[^)]*\)(?:\s*,\s*limits\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?))?/i

interface ParsedAction {
  direction: 'increase' | 'decrease'
  from: number
  to: number
  unit: string
  change: number
  lo: number | null
  hi: number | null
}

export function parseRecommendation(text: string): ParsedAction | null {
  const m = RECOMMENDATION.exec(text.trim())
  if (!m) return null
  const verb = m[1].toLowerCase()
  return {
    direction: verb === 'increase' || verb === 'raise' ? 'increase' : 'decrease',
    from: Number(m[2]),
    to: Number(m[3]),
    unit: m[4] ?? '',
    change: Number(m[5]),
    lo: m[6] == null ? null : Number(m[6]),
    hi: m[7] == null ? null : Number(m[7]),
  }
}

/* ------------------------------------------------------------------ *
 * Building the report
 * ------------------------------------------------------------------ */

function labSummary(shift: ShiftWindow, labRows: readonly TimestampRow[], line: LineModel): LabSummary {
  const actual = extractSeries(labRows, line.actualC3S).filter((p) => inShift(p.t, shift))
  const predicted = extractSeries(labRows, line.predictedC3S).filter((p) => inShift(p.t, shift))
  const matched = matchSamples(predicted, actual).filter((m) => m.error != null)
  const values = actual.map((p) => p.v)
  return {
    n: actual.length,
    mean: mean(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    first: actual[0]?.v ?? null,
    last: actual[actual.length - 1]?.v ?? null,
    nPredicted: predicted.length,
    meanPredicted: mean(predicted.map((p) => p.v)),
    nMatched: matched.length,
    meanError: mean(matched.map((m) => m.error as number)),
  }
}

function observe(
  key: string,
  shift: ShiftWindow,
  processRows: readonly TimestampRow[],
  line: LineModel,
): ProcessObservation | null {
  const pts: Point[] = extractSeries(processRows, key).filter((p) => inShift(p.t, shift))
  if (pts.length === 0) return null
  const values = pts.map((p) => p.v)
  const def = line.describe(key)
  return {
    key,
    label: def.label,
    unit: def.unit,
    n: values.length,
    mean: mean(values) as number,
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

const SEVERITY_RANK: Record<NonNullable<RcaSeverity>, number> = { cause: 2, watch: 1 }
const severityRank = (s: RcaSeverity) => (s == null ? 0 : SEVERITY_RANK[s])

/** Most significant first: a named primary cause, then the size of the C3S gap. */
function bySignificance(a: RcaFinding, b: RcaFinding): number {
  const pa = a.primaryCause ? 1 : 0
  const pb = b.primaryCause ? 1 : 0
  if (pa !== pb) return pb - pa
  return Math.abs(b.c3sGap ?? 0) - Math.abs(a.c3sGap ?? 0)
}

/** Text compared without case, punctuation or spacing. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function summariseCauses(events: readonly RcaFinding[]): CauseSummary[] {
  const byLabel = new Map<string, CauseSummary>()
  for (const f of events) {
    for (const c of f.rootCauses) {
      // "Summary: No cause beyond the limits" says there is no cause; it is not one.
      if (c.label === 'Summary') continue
      // A named label ("SHC") is one driver whatever the wording. A numbered one ("Cause 1") only
      // says where it ranked in its event, so the same text is one driver and different texts are
      // different drivers, shown as "Cause" / "Watch".
      const generic = GENERIC_LABEL.test(c.label.trim())
      const key = generic ? `~${norm(c.text)}` : c.label
      const label = generic ? c.label.trim().replace(/\s*\d+$/, '') : c.label
      const cur = byLabel.get(key)
      if (!cur) {
        byLabel.set(key, { label, severity: c.severity, count: 1, example: c.text })
      } else {
        cur.count++
        if (severityRank(c.severity) > severityRank(cur.severity)) {
          cur.severity = c.severity
          cur.example = c.text
        }
      }
    }
  }
  return [...byLabel.values()].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count,
  )
}

function summariseActions(
  events: readonly RcaFinding[],
  shift: ShiftWindow,
  processRows: readonly TimestampRow[],
  line: LineModel,
): { actions: ActionSummary[]; holds: string[] } {
  const groups = new Map<string, ActionSummary & { changes: number[] }>()
  const holds = new Set<string>()

  for (const f of events) {
    for (const r of f.recommendations) {
      const parsed = parseRecommendation(r.text)
      if (!parsed) {
        holds.add(r.text)
        continue
      }
      // The current insight format numbers its labels ("Set point 1") and names the set point in
      // the sentence ("Reduce Kiln coal from …"); the set point is the thing to group by.
      const label = GENERIC_LABEL.test(r.label.trim()) ? parseAction(r.label, r.text).parameter || r.label : r.label
      const key = `${label}|${parsed.direction}`
      let g = groups.get(key)
      if (!g) {
        const role = ACTION_ROLES[label]
        const sensor = role ? line.role(role) : null
        g = {
          label,
          direction: parsed.direction,
          count: 0,
          meanChange: 0,
          unit: parsed.unit,
          examples: [],
          process: sensor ? observe(sensor, shift, processRows, line) : null,
          changes: [],
        }
        groups.set(key, g)
      }
      g.count++
      g.changes.push(parsed.change)
      g.examples.push({
        eventTime: f.eventTime,
        from: parsed.from,
        to: parsed.to,
        unit: parsed.unit,
        lo: parsed.lo,
        hi: parsed.hi,
        text: r.text,
      })
    }
  }

  const actions = [...groups.values()]
    .map(({ changes, ...g }) => ({ ...g, meanChange: mean(changes) as number }))
    // Events arrive most-significant first, so the examples already are; keep the top two.
    .map((g) => ({ ...g, examples: g.examples.slice(0, 2) }))
    .sort((a, b) => b.count - a.count || Math.abs(b.meanChange) - Math.abs(a.meanChange))

  return { actions, holds: [...holds] }
}

function assess(
  lab: LabSummary,
  eventCount: number,
  actions: readonly ActionSummary[],
): ShiftReport['assessment'] {
  const caveat =
    lab.n === 0
      ? ' No laboratory C3S samples were recorded in this shift, so further validation is required.'
      : lab.n < 3
        ? ` Only ${lab.n} laboratory C3S sample${lab.n === 1 ? '' : 's'} in this shift, so further validation is required.`
        : ''

  if (eventCount === 0) {
    return {
      level: 'none',
      message:
        'The RCA insight analysed no deviation in this shift, so no recommendation is made.' + caveat,
    }
  }
  if (actions.length === 0) {
    return {
      level: 'limited',
      message:
        `The insight analysed ${eventCount} deviation${eventCount === 1 ? '' : 's'} but advised no set-point change.` +
        caveat,
    }
  }
  const top = actions[0]
  if (top.count >= 2) {
    return {
      level: 'repeated',
      message:
        `The leading recommendation was made in ${top.count} of ${eventCount} analysed deviations. ` +
        'It is still an insight recommendation: validate it with the process engineer before changing a set point.' +
        caveat,
    }
  }
  return {
    level: 'limited',
    message:
      `Each recommendation rests on a single analysed deviation (${eventCount} in the shift); ` +
      'further validation is required before acting on it.' +
      caveat,
  }
}

export function buildShiftReport(input: {
  shift: ShiftWindow
  labRows: readonly TimestampRow[]
  processRows: readonly TimestampRow[]
  findings: readonly RcaFinding[]
  line: LineModel
}): ShiftReport {
  const { shift, labRows, processRows, findings, line } = input

  // One result per event: an event the insight analysed again (a re-run) counts once, newest kept.
  const byTime = new Map<number, RcaFinding>()
  for (const f of findings) {
    if (f.eventTime == null || !inShift(f.eventTime, shift)) continue
    const cur = byTime.get(f.eventTime)
    if (!cur || (f.invocationTime ?? 0) > (cur.invocationTime ?? 0)) byTime.set(f.eventTime, f)
  }
  const events = [...byTime.values()].sort(bySignificance)

  const lab = labSummary(shift, labRows, line)
  const { actions, holds } = summariseActions(events, shift, processRows, line)
  const notes = [...new Set(events.flatMap((f) => f.notes))]

  return {
    shift,
    lab,
    events,
    low: events.filter((f) => f.direction === 'low').length,
    high: events.filter((f) => f.direction === 'high').length,
    causes: summariseCauses(events),
    actions,
    holds,
    notes,
    assessment: assess(lab, events.length, actions),
  }
}
