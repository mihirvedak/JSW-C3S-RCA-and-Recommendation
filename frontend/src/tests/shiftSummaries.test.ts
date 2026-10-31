import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRcaFindings } from '../services/rcaService'
import type { ShiftSummary } from '../services/rcaService'
import { summaryForShift } from '../lib/shiftSummaries'
import type { ShiftWindow } from '../lib/shifts'
import { HOUR_MS, MINUTE_MS } from '../lib/time'

const ist = (s: string) => Date.parse(`${s}+05:30`)

/** Shift B, 14:00–22:00 plant time on 18 Aug 2026. */
const B: ShiftWindow = { id: 'B', start: ist('2026-08-18T14:00:00'), end: ist('2026-08-18T22:00:00'), day: { y: 2026, m: 8, d: 18 } }

function summary(over: Partial<ShiftSummary>): ShiftSummary {
  return {
    id: 's',
    invocationTime: null,
    start: null,
    end: null,
    time: null,
    name: null,
    deviations: null,
    recommendations: [],
    causes: [],
    shcOptimizer: null,
    sections: [],
    lists: [],
    values: [],
    asOf: null,
    ...over,
  }
}

describe('reading shift summaries from the insight', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps every field as the insight wrote it, sorted by shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                data: [
                  {
                    _id: 'sh',
                    resultName: 'C3S RCA Shift',
                    tags: ['shift'],
                    invocationTime: '2026-08-18T16:30:00.000Z',
                    result: {
                      rca: {
                        kind: 'shift',
                        deviations: 2,
                        shift: 'B',
                        start: '2026-08-18 14:00:00',
                        end: '2026-08-18 22:00:00',
                        mean_c3s: 41.2,
                        root_cause: { 'Kiln coal high': '28.6 t/h against 24.0.' },
                        do: ['Raw mix: Bauxite 0.9% to 1.1%'],
                      },
                      as_of: '2026-08-18 22:05',
                    },
                  },
                ],
                totalCount: 1,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    )
    const page = await fetchRcaFindings()
    expect(page.findings).toEqual([])
    const [s] = page.shifts
    expect([s.deviations, s.name, s.start, s.end]).toEqual([2, 'B', B.start, B.end])
    expect(s.values).toEqual([{ key: 'mean_c3s', value: '41.2' }])
    expect(s.causes).toEqual([{ label: 'Kiln coal high', text: '28.6 t/h against 24.0.' }])
    expect(s.recommendations).toEqual(['Raw mix: Bauxite 0.9% to 1.1%'])
    expect([s.sections, s.lists]).toEqual([[], []])
  })

  it('reads the live shift document: the nested shift, its actions and the SHC flag', async () => {
    const report =
      'Shift C, 24 July, 22:00 – 25 July, 06:00. 3 laboratory C3S samples (actual mean 41.98%, predicted mean 41.93%, mean error -0.03 pp). 2 RCA events: Under burnt (2). Recommended actions: Improve cooler airflow using the SHC optimizer.; Hold: re-check last free lime and SAT / burning zone at the next lab. Do not cut coal.'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                data: [
                  {
                    _id: 'live-c',
                    resultName: 'C3S RCA Shift',
                    tags: ['shift'],
                    invocationTime: '2026-07-25T00:30:00.000Z',
                    result: {
                      rca: {
                        kind: 'shift',
                        deviations: 2,
                        shc_optimizer: true,
                        event_report: report,
                        note: report,
                        shift: { code: 'C', name: 'Shift C', start: '2026-07-24 22:00:00', end: '2026-07-25 06:00:00', label: '24 July, 22:00 – 25 July, 06:00' },
                        recommended_actions: [
                          'Improve cooler airflow using the SHC optimizer.',
                          'Hold: re-check last free lime and SAT / burning zone at the next lab. Do not cut coal.',
                        ],
                      },
                    },
                  },
                ],
                totalCount: 1,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    )
    const [s] = (await fetchRcaFindings()).shifts
    expect([s.name, s.start, s.end, s.deviations, s.shcOptimizer]).toEqual(['C', ist('2026-07-24T22:00:00'), ist('2026-07-25T06:00:00'), 2, true])
    expect(s.recommendations).toEqual([
      'Improve cooler airflow using the SHC optimizer.',
      'Hold: re-check last free lime and SAT / burning zone at the next lab. Do not cut coal.',
    ])
    // Matched by the window it states, not by when it ran.
    const C: ShiftWindow = { id: 'C', start: ist('2026-07-24T22:00:00'), end: ist('2026-07-25T06:00:00'), day: { y: 2026, m: 7, d: 24 } }
    expect(summaryForShift([s], C)?.by).toBe('window')
  })
})

describe('matching a summary to its shift', () => {
  it('prefers the window the summary states', () => {
    const m = summaryForShift([summary({ id: 'w', start: B.start, end: B.end })], B)
    expect([m?.summary.id, m?.by]).toEqual(['w', 'window'])
  })

  it('uses a stated end or time inside the shift', () => {
    expect(summaryForShift([summary({ end: B.end })], B)?.by).toBe('stated time')
    expect(summaryForShift([summary({ time: B.start + HOUR_MS })], B)?.by).toBe('stated time')
  })

  it('falls back to when the insight ran, up to 30 min after the shift', () => {
    expect(summaryForShift([summary({ invocationTime: B.end + 20 * MINUTE_MS })], B)?.by).toBe('run time')
    expect(summaryForShift([summary({ invocationTime: B.end + 45 * MINUTE_MS })], B)).toBeNull()
  })

  it('never takes another shift’s window, and picks the newest of two', () => {
    const other = summary({ id: 'a', start: B.start - 8 * HOUR_MS, end: B.start })
    expect(summaryForShift([other], B)).toBeNull()
    const old = summary({ id: 'old', start: B.start, invocationTime: B.end })
    const fresh = summary({ id: 'new', start: B.start, invocationTime: B.end + MINUTE_MS })
    expect(summaryForShift([old, fresh], B)?.summary.id).toBe('new')
  })

  it('returns nothing for a shift the insight wrote no summary for', () => {
    expect(summaryForShift([], B)).toBeNull()
  })
})
