/**
 * RCA parsing tests.
 *
 * The fixtures below are trimmed copies of real responses from insight
 * INS_df1b3c1a11de ("C3S RCA Action", fetched 2026-10-22), so the parser is tested
 * against the schema the platform actually returns rather than an invented one.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAllRcaFindings, fetchRcaFindings } from '../services/rcaService'
import { ApiError } from '../services/apiClient'

/** Low-C3S result with two graded root causes and three set-point recommendations. */
const WITH_RECOMMENDATIONS = {
  _id: 'res-reco',
  insightID: 'INS_df1b3c1a11de',
  resultName: 'C3S RCA Action',
  result: {
    rca: {
      root_cause: {
        SHC: 'SHC high: 786 kcal/kg against target 773 kcal/kg (watch)',
        TSR: "TSR low: 11.4% against 13.1% in this feed bin's best period",
      },
      recommendations: {
        'Kiln coal': 'Reduce Kiln coal from 31.0 to 28.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h.',
        'Solid AFR': 'Increase Solid AFR from 14.6 to 14.7 t/h (+0.1 t/h), limits 13.0 to 14.7 t/h.',
        'Kiln feed': 'Increase Kiln feed from 470.9 to 472.9 t/h (+2.0 t/h), limits 467.3 to 473.0 t/h.',
      },
      outcome: { 'Fuel and feed': 'TSR 11.4% to 11.9%, SHC 812 to 776 kcal/kg.' },
      time: '2026-08-27 15:01:00',
      batch_end: '2026-08-27 15:15:00',
      direction: 'low',
      c3s: 37.691100000000006,
      c3s_gap: -2.1585499999999556,
      primary_cause: null,
      why: [
        'SHC high: 786 kcal/kg against target 773 kcal/kg (watch)',
        "TSR low: 11.4% against 13.1% in this feed bin's best period",
      ],
      do: ['Kiln coal: 31.0 to 28.6 t/h (-2.3)', 'Solid AFR: 14.6 to 14.7 t/h (+0.1)'],
      result: ['Fuel and feed: TSR 11.4% to 11.9%, SHC 812 to 776 kcal/kg'],
      notes: ['Air-side effects (secondary air, O2, cooler) are not checked: no cooler tags in the Adani data.'],
    },
    as_of: '2026-10-22 23:20',
  },
  tags: ['C3S RCA Action', 'lower_than_target', 'Adani'],
  invocationTime: '2026-08-27T09:45:00.000Z',
}

/** A result with a named primary cause graded "(cause)". */
const WITH_CAUSE = {
  _id: 'res-cause',
  result: {
    rca: {
      root_cause: {
        'Fuel ash': 'Fuel ash high: 6.15 against target 5.01 (cause)',
        TSR: "TSR low: 13.1% against 13.1% in this feed bin's best period",
      },
      recommendations: {
        'Kiln coal': 'Reduce Kiln coal from 28.0 to 25.6 t/h (-2.3 t/h), limits 21.8 to 25.2 t/h.',
      },
      outcome: { 'Fuel and feed': 'TSR 13.1% to 13.7%, SHC 741 to 709 kcal/kg.' },
      time: '2026-07-27 13:01:00',
      batch_end: '2026-07-27 13:15:00',
      direction: 'low',
      c3s: 37.34464,
      c3s_gap: -2.50501,
      primary_cause: 'Fuel Ash Addition',
      why: [],
      do: [],
      result: [],
      notes: [],
    },
    as_of: '2026-10-22 23:20',
  },
  tags: ['C3S RCA Action', 'lower_than_target', 'Adani'],
  invocationTime: '2026-07-27T07:45:00.000Z',
}

/** A result where the insight advised nothing — the insight's own wording, not ours. */
const NO_ACTION = {
  _id: 'res-none',
  result: {
    rca: {
      root_cause: { Summary: 'No cause beyond the limits' },
      recommendations: { 'Set points': 'No set-point change advised.' },
      outcome: { Outcome: 'No change expected.' },
      time: '2026-06-29 12:57:00',
      batch_end: '2026-06-29 13:00:00',
      direction: 'low',
      c3s: 37.76487000000001,
      c3s_gap: -2.0847799999999523,
      primary_cause: null,
      why: ['No cause beyond the limits'],
      do: ['No set-point change advised'],
      result: ['No change expected'],
      notes: [],
    },
    as_of: '2026-10-22 23:20',
  },
  tags: ['C3S RCA Action', 'lower_than_target', 'Adani'],
  invocationTime: '2026-06-29 07:27:00',
}

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchRcaFindings', () => {
  it('parses multiple findings without flattening them into one', async () => {
    mockFetch({
      success: true,
      data: {
        data: [WITH_CAUSE, WITH_RECOMMENDATIONS],
        totalCount: 579,
        pagination: { page: 1, count: 2, totalPages: 290 },
      },
    })

    const page = await fetchRcaFindings()

    expect(page.findings).toHaveLength(2)
    expect(page.totalCount).toBe(579)
    expect(page.malformedCount).toBe(0)
    // Each keeps its own recommendations.
    expect(
      new Set(page.findings.map((f) => f.recommendations.map((r) => r.text).join('|'))).size,
    ).toBe(2)
  })

  it('reads the recommendations, root causes and outcome off a result', async () => {
    mockFetch({ success: true, data: { data: [WITH_RECOMMENDATIONS], totalCount: 1 } })
    const [f] = (await fetchRcaFindings()).findings

    expect(f.direction).toBe('low')
    expect(f.c3s).toBeCloseTo(37.6911, 4)
    expect(f.c3sGap).toBeCloseTo(-2.15855, 5)
    expect(f.primaryCause).toBeNull()
    expect(f.asOf).toBe('2026-10-22 23:20')
    expect(f.tags).toContain('Adani')
    expect(f.eventTimeRaw).toBe('2026-08-27 15:01:00')
    // The insight's times are plant-local (IST), not the browser's zone.
    expect(f.eventTime).toBe(Date.parse('2026-08-27T15:01:00+05:30'))
    expect(f.invocationTime).toBe(Date.parse('2026-08-27T09:45:00.000Z'))

    // Labels and the insight's key order are preserved.
    expect(f.recommendations.map((r) => r.label)).toEqual(['Kiln coal', 'Solid AFR', 'Kiln feed'])
    expect(f.recommendations[0].text).toContain('Reduce Kiln coal from 31.0 to 28.6 t/h')
    expect(f.outcomes).toEqual([
      { label: 'Fuel and feed', text: 'TSR 11.4% to 11.9%, SHC 812 to 776 kcal/kg.' },
    ])
    expect(f.rootCauses.map((c) => c.label)).toEqual(['SHC', 'TSR'])
    expect(f.why).toHaveLength(2)
    expect(f.actions).toHaveLength(2)
    expect(f.expected).toHaveLength(1)
    expect(f.notes).toHaveLength(1)
  })

  it('takes the severity from the insight text and invents none', async () => {
    mockFetch({ success: true, data: { data: [WITH_CAUSE, WITH_RECOMMENDATIONS], totalCount: 2 } })
    const { findings } = await fetchRcaFindings()
    const cause = findings.find((f) => f.id === 'res-cause')!
    const watch = findings.find((f) => f.id === 'res-reco')!

    expect(cause.primaryCause).toBe('Fuel Ash Addition')
    expect(cause.rootCauses.map((c) => c.severity)).toEqual(['cause', null])
    expect(watch.rootCauses.map((c) => c.severity)).toEqual(['watch', null])
  })

  it('represents "no action" with the insight\'s own wording', async () => {
    mockFetch({ success: true, data: { data: [NO_ACTION], totalCount: 1 } })
    const [f] = (await fetchRcaFindings()).findings

    expect(f.primaryCause).toBeNull()
    expect(f.rootCauses).toEqual([{ label: 'Summary', text: 'No cause beyond the limits', severity: null }])
    expect(f.recommendations).toEqual([{ label: 'Set points', text: 'No set-point change advised.' }])
    expect(f.notes).toEqual([])
  })

  it('exposes no confidence score, because the insight supplies none', async () => {
    mockFetch({ success: true, data: { data: [WITH_CAUSE], totalCount: 1 } })
    const [f] = (await fetchRcaFindings()).findings
    expect(f).not.toHaveProperty('confidence')
  })

  it('sorts newest event first', async () => {
    mockFetch({ success: true, data: { data: [WITH_CAUSE, WITH_RECOMMENDATIONS], totalCount: 2 } })
    const { findings } = await fetchRcaFindings()
    expect(findings[0].id).toBe('res-reco') // 2026-08-27 is newer than 2026-07-27
  })

  it('reads event times as plant-local, so they line up with UTC lab samples', async () => {
    mockFetch({ success: true, data: { data: [WITH_RECOMMENDATIONS], totalCount: 1 } })
    const [f] = (await fetchRcaFindings()).findings

    // batch_end 15:15 IST is 09:45Z — exactly the result's own invocationTime.
    expect(f.batchEnd).toBe(Date.parse('2026-08-27T09:45:00.000Z'))
    expect(f.batchEnd).toBe(f.invocationTime)
  })

  it('does not read the retired step-based schema', async () => {
    mockFetch({
      success: true,
      data: {
        data: [
          {
            _id: 'old',
            result: {
              rca: {
                direction: 'low',
                c3s: 37.3,
                summary: 'Fuel Ash Addition is the first cause found.',
                steps: { fuel_ash: { verdict: 'cause', adjustment: 'Decrease TSR.' } },
              },
            },
          },
        ],
        totalCount: 1,
      },
    })
    const [f] = (await fetchRcaFindings()).findings
    expect(f.recommendations).toEqual([])
    expect(f.rootCauses).toEqual([])
  })
})

describe('the "C3S RCA Live" format (INS_c3snandyalrca)', () => {
  // Result 0 of page 2 as the platform returned it on 2026-11-02, trimmed to the fields read.
  const LIVE = {
    _id: '6ae819f8be636bd66706a2a4',
    insightID: 'INS_c3snandyalrca',
    resultName: 'C3S RCA Live',
    result: {
      rca: {
        raw: 'Problem: Underlimed: C3S 40.1 % (band 42.0 to 46.0 %), free lime 1.86 % (band 0.9 to 1.9 %).',
        root_cause: {
          Problem: 'Underlimed: C3S 40.1 % (band 42.0 to 46.0 %), free lime 1.86 % (band 0.9 to 1.9 %).',
          'Cause 1': 'SHC is 706 kcal/kg against comparable 590 kcal/kg.',
        },
        recommendations: {
          'Action 1': 'Improve SHC from 706 to 590 kcal/kg using the SHC optimizer.',
          'Action 2': 'Increase TSR from 14.1 to 16.0%. Proceed to the SHC optimizer.',
        },
        outcome: { 'Result 1': 'Proceed to the SHC optimizer for the sized SHC / TSR move.' },
        shc_optimizer: true,
        source: 'lab C3S',
        time: '2026-04-18 15:27:00',
        lab_time: '2026-04-18 15:27:00',
        batch_end: '2026-04-18 15:27:00',
        zone: 'Underlimed',
        direction: 'low',
        c3s: 40.06,
        fcao: 1.86,
        level: 41.8,
        c3s_gap: -3.94,
        targets: { c3s: 44, c3s_band: [41.965, 46.035], free_lime: 1.43, free_lime_band: [0.9299999999999999, 1.93] },
      },
      as_of: '2026-04-18 15:27',
    },
    tags: ['C3S RCA Live', 'lower_than_target', 'JSW', 'SHC_Optimizer', 'true'],
    invocationTime: '2026-04-18T09:57:00.000Z',
  }

  it('reads the event, says it was run on the lab C3S, and takes the targets its own lime level confirms', async () => {
    mockFetch({ success: true, data: { data: [LIVE], totalCount: 1 } })
    const [f] = (await fetchRcaFindings()).findings
    expect([f.c3s, f.source, f.zone, f.freeLime, f.direction]).toEqual([40.06, 'lab', 'Underlimed', 1.86, 'low'])
    expect(f.eventTime).toBe(Date.parse('2026-04-18T15:27:00+05:30'))
    expect(f.targets).toEqual({
      c3s: 44,
      c3sBand: [41.965, 46.035],
      freeLime: 1.43,
      freeLimeBand: [0.9299999999999999, 1.93],
      limeLevelK: 4.071,
      limeLevelFreeLimeRef: 1.43,
    })
    expect(f.rootCauses.map((c) => c.label)).toEqual(['Problem', 'Cause 1'])
    expect(f.recommendations).toHaveLength(2)
  })

  it('does not take targets whose lime level the standard form does not reproduce', async () => {
    const off = structuredClone(LIVE)
    off.result.rca.level = 45.0
    mockFetch({ success: true, data: { data: [off], totalCount: 1 } })
    expect((await fetchRcaFindings()).findings[0].targets).toBeNull()
  })

  it('reads an Adani result, which states no source, as run on the prediction', async () => {
    mockFetch({ success: true, data: { data: [WITH_RECOMMENDATIONS], totalCount: 1 } })
    expect((await fetchRcaFindings()).findings[0].source).toBeNull()
  })
})

describe('malformed and degenerate responses', () => {
  it('counts unparseable results instead of dropping them silently', async () => {
    mockFetch({
      success: true,
      data: { data: [WITH_CAUSE, { _id: 'junk' }, { _id: 'empty', result: {} }], totalCount: 3 },
    })
    const page = await fetchRcaFindings()
    expect(page.findings).toHaveLength(1)
    expect(page.malformedCount).toBe(2)
  })

  it('tolerates missing optional fields', async () => {
    mockFetch({
      success: true,
      data: { data: [{ _id: 'bare', result: { rca: { direction: 'high', c3s: 42 } } }], totalCount: 1 },
    })
    const [f] = (await fetchRcaFindings()).findings

    expect(f.direction).toBe('high')
    expect(f.eventTime).toBeNull()
    expect(f.rootCauses).toEqual([])
    expect(f.recommendations).toEqual([])
    expect(f.outcomes).toEqual([])
    expect(f.notes).toEqual([])
  })

  it('reads the clinker zone the insight classified the event into', async () => {
    mockFetch({
      success: true,
      data: {
        data: [
          {
            _id: 'z',
            result: {
              rca: {
                zone: 'Overlimed',
                direction: 'high',
                c3s: 43.6,
                root_cause: { 'Kiln feed LSF high': '105.5 against normal 104.5 (watch).' },
              },
            },
          },
          { _id: 'old', result: { rca: { direction: 'low', c3s: 40 } } },
        ],
        totalCount: 2,
      },
    })
    const byId = new Map((await fetchRcaFindings()).findings.map((f) => [f.id, f]))

    expect(byId.get('z')?.zone).toBe('Overlimed')
    expect(byId.get('z')?.rootCauses[0].severity).toBe('watch')
    expect(byId.get('old')?.zone).toBeNull()
  })

  it('grades numbered labels, but never a "cause" that says it is not confirmed', async () => {
    mockFetch({
      success: true,
      data: {
        data: [
          {
            _id: 'live',
            result: {
              rca: {
                c3s: 40.4,
                zone: 'Under burnt',
                root_cause: {
                  'Cause 1': 'Root cause not confirmed from the available data.',
                  'Watch 1': 'Secondary air temperature low: 1052 degC, normal 1087 degC.',
                  'Cause not confirmed': 'these are observed deviations, not proven causes.',
                },
              },
            },
          },
        ],
        totalCount: 1,
      },
    })
    const [f] = (await fetchRcaFindings()).findings
    expect(f.rootCauses.map((c) => [c.label, c.severity])).toEqual([
      ['Cause 1', null],
      ['Watch 1', 'watch'],
      ['Cause not confirmed', null],
    ])
  })

  it('skips non-text entries rather than rendering "[object Object]"', async () => {
    mockFetch({
      success: true,
      data: {
        data: [
          {
            _id: 'odd',
            result: {
              rca: {
                direction: 'low',
                c3s: 38,
                recommendations: { Good: 'Do X.', Nested: { a: 1 }, Empty: '  ', Num: 3 },
              },
            },
          },
        ],
        totalCount: 1,
      },
    })
    const [f] = (await fetchRcaFindings()).findings
    expect(f.recommendations).toEqual([{ label: 'Good', text: 'Do X.' }])
  })

  it('returns an empty page rather than throwing when data is absent', async () => {
    mockFetch({ success: true, data: {} })
    const page = await fetchRcaFindings()
    expect(page.findings).toEqual([])
    expect(page.totalCount).toBe(0)
  })

  it('raises when the insight is unavailable, so the UI can show an error state', async () => {
    mockFetch({ success: false, errors: ['Insight not found'] }, 404)
    await expect(fetchRcaFindings()).rejects.toBeInstanceOf(ApiError)
  })

  it('raises on a success:false carried by an HTTP 200', async () => {
    mockFetch({ success: false, errors: ['You Do not have permissions to do so'] }, 200)
    await expect(fetchRcaFindings()).rejects.toThrow(/permission/i)
  })
})

describe('shift summaries in the same insight', () => {
  it('are never read as RCA events, nor counted as unparseable', async () => {
    mockFetch({
      success: true,
      data: {
        data: [
          { _id: 'ev', result: { rca: { zone: 'Overlimed', c3s: 43.6, time: '2026-05-16 00:53:00' } } },
          // As the insight writes them: resultName, tag and kind all say "shift".
          {
            _id: 'sh1',
            resultName: 'C3S RCA Shift',
            tags: ['shift'],
            result: { rca: { kind: 'shift', deviations: 3, c3s: 42.1, zone: 'Good clinker' } },
          },
          { _id: 'sh2', resultName: 'C3S RCA Shift', tags: ['shift'], result: { rca: { kind: 'shift', deviations: 0 } } },
        ],
        totalCount: 3,
      },
    })
    const page = await fetchRcaFindings()
    expect(page.findings.map((f) => f.id)).toEqual(['ev'])
    expect(page.shiftCount).toBe(2)
    expect(page.malformedCount).toBe(0)
  })
})

describe('fetchAllRcaFindings', () => {
  function pagedFetch(pages: unknown[][], totalCount: number) {
    return vi.fn(async (_url: unknown, init?: RequestInit) => {
      const { pagination } = JSON.parse(String(init?.body))
      const rows = pages[pagination.page - 1] ?? []
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            data: rows,
            totalCount,
            pagination: { page: pagination.page, count: pagination.count, totalPages: pages.length },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
  }

  it('walks every page and returns newest first', async () => {
    const fetchMock = pagedFetch([[WITH_CAUSE], [WITH_RECOMMENDATIONS], [NO_ACTION]], 3)
    vi.stubGlobal('fetch', fetchMock)

    const page = await fetchAllRcaFindings()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(page.findings.map((f) => f.id)).toEqual(['res-reco', 'res-cause', 'res-none'])
    expect(page.totalCount).toBe(3)
  })

  it('makes one request when everything fits on a page', async () => {
    const fetchMock = pagedFetch([[WITH_CAUSE, NO_ACTION]], 2)
    vi.stubGlobal('fetch', fetchMock)
    const page = await fetchAllRcaFindings()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(page.findings).toHaveLength(2)
  })
})
