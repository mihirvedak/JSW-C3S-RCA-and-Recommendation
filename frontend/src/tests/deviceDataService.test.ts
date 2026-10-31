/**
 * Device data parsing tests, against the response shapes the platform really returns.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchLatest,
  fetchLatestTimestamp,
  fetchRange,
  fetchRangeChunked,
} from '../services/deviceDataService'
import { ApiError, AuthError } from '../services/apiClient'

function mockFetch(body: unknown, status = 200) {
  const spy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchLatest', () => {
  it('parses a real lastDP payload', async () => {
    mockFetch({
      success: true,
      data: {
        devID: 'ADANI_LAB',
        data: {
          D55: { time: '2026-08-28T06:45:00.000Z', value: 39.599 },
          D58: { time: '2026-08-27T17:30:00.000Z', value: 39.524 },
        },
      },
    })

    const out = await fetchLatest('ADANI_LAB', ['D55', 'D58'])

    expect(out.get('D55')).toEqual({
      sensorId: 'D55',
      value: 39.599,
      time: Date.parse('2026-08-28T06:45:00.000Z'),
    })
    expect(out.get('D58')?.value).toBe(39.524)
  })

  it('treats an empty array as no measurement, not zero', async () => {
    mockFetch({ success: true, data: { devID: 'ADANI_LAB', data: { D59: [] } } })
    const out = await fetchLatest('ADANI_LAB', ['D59'])

    expect(out.get('D59')).toEqual({ sensorId: 'D59', value: null, time: null })
    expect(out.get('D59')?.value).not.toBe(0)
  })

  it('preserves a genuine zero reading', async () => {
    mockFetch({
      success: true,
      data: { devID: 'ADANI_RAW', data: { D64: { time: 1787011200000, value: 0 } } },
    })
    expect((await fetchLatest('ADANI_RAW', ['D64'])).get('D64')?.value).toBe(0)
  })

  it('reports a requested sensor that is absent from the response', async () => {
    mockFetch({ success: true, data: { devID: 'ADANI_LAB', data: {} } })
    const out = await fetchLatest('ADANI_LAB', ['D55'])
    expect(out.get('D55')).toEqual({ sensorId: 'D55', value: null, time: null })
  })

  it('does not call the API for an empty sensor list', async () => {
    const spy = mockFetch({ success: true, data: {} })
    expect((await fetchLatest('ADANI_LAB', [])).size).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('sends the device id in the body, keeping the call device-scoped', async () => {
    const spy = mockFetch({ success: true, data: { devID: 'ADANI_RAW', data: {} } })
    await fetchLatest('ADANI_RAW', ['D55'])

    const body = JSON.parse(String(spy.mock.calls[0][1]?.body))
    expect(body).toEqual({ devID: 'ADANI_RAW', sensors: ['D55'] })
  })
})

describe('fetchRange', () => {
  it('parses timestamp-grouped rows and keeps absent sensors absent', async () => {
    mockFetch({
      success: true,
      data: [
        { time: '2026-08-18T23:30:00.000Z', D55: 39.861, D58: 40.986, D44: 43.25 },
        { time: '2026-08-18T23:45:00.000Z', D55: 39.829 },
      ],
    })

    const rows = await fetchRange('ADANI_LAB', 1, 2)

    expect(rows).toHaveLength(2)
    expect(rows[0].values).toEqual({ D55: 39.861, D58: 40.986, D44: 43.25 })
    expect(rows[1].values).toEqual({ D55: 39.829 })
    expect(rows[1].values.D58).toBeUndefined()
  })

  it('returns rows oldest-first even though the API returns newest-first', async () => {
    mockFetch({
      success: true,
      data: [
        { time: '2026-08-18T23:45:00.000Z', D55: 2 },
        { time: '2026-08-18T23:30:00.000Z', D55: 1 },
        { time: '2026-08-18T23:15:00.000Z', D55: 0 },
      ],
    })

    const rows = await fetchRange('ADANI_LAB', 1, 2)
    expect(rows.map((r) => r.values.D55)).toEqual([0, 1, 2])
  })

  it('drops rows with an unusable timestamp instead of inventing one', async () => {
    mockFetch({
      success: true,
      data: [{ time: 'nonsense', D55: 1 }, { time: '2026-08-18T23:30:00.000Z', D55: 2 }],
    })
    const rows = await fetchRange('ADANI_LAB', 1, 2)
    expect(rows).toHaveLength(1)
    expect(rows[0].values.D55).toBe(2)
  })

  it('puts epoch milliseconds in the path', async () => {
    const spy = mockFetch({ success: true, data: [] })
    await fetchRange('ADANI_LAB', 1787011200000, 1787097600000)

    expect(String(spy.mock.calls[0][0])).toBe(
      '/api/account/deviceData/getDataByStEt/ADANI_LAB/1787011200000/1787097600000',
    )
  })

  it('handles a non-array payload without throwing', async () => {
    mockFetch({ success: true, data: null })
    expect(await fetchRange('ADANI_LAB', 1, 2)).toEqual([])
  })
})

describe('fetchLatestTimestamp', () => {
  it('returns the newest timestamp across the reference sensors', async () => {
    mockFetch({
      success: true,
      data: {
        devID: 'ADANI_LAB',
        data: {
          D55: { time: '2026-08-28T06:45:00.000Z', value: 39.6 },
          D58: { time: '2026-08-27T17:30:00.000Z', value: 39.5 },
        },
      },
    })

    expect(await fetchLatestTimestamp('ADANI_LAB', ['D55', 'D58'])).toBe(
      Date.parse('2026-08-28T06:45:00.000Z'),
    )
  })

  it('is null when nothing has reported', async () => {
    mockFetch({ success: true, data: { devID: 'ADANI_LAB', data: { D55: [] } } })
    expect(await fetchLatestTimestamp('ADANI_LAB', ['D55'])).toBeNull()
  })
})

describe('error handling', () => {
  it('raises AuthError on HTTP 401 so the app can prompt re-auth', async () => {
    mockFetch({ success: false, errors: ['authentication required'] }, 401)
    await expect(fetchLatest('ADANI_LAB', ['D55'])).rejects.toBeInstanceOf(AuthError)
  })

  it('raises on success:false delivered with HTTP 200', async () => {
    mockFetch({ success: false, errors: ['User Device not added to your account'] }, 200)
    await expect(fetchRange('ADANI_LAB', 1, 2)).rejects.toThrow(/not added to your account/)
  })

  it('names the method, path and status when a proxy returns a non-JSON error', async () => {
    // A gateway rejecting the method replies with HTML, not the usual JSON envelope.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html><head><title>405 Not Allowed</title></head></html>', {
            status: 405,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    )

    const err = await fetchLatest('ADANI_LAB', ['D55']).catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(405)
    expect(err.method).toBe('PUT')
    expect(err.route).toBe('/api/account/deviceData/lastDP')
    // The old message said only "Malformed response", which hid the real cause.
    expect(err.message).not.toMatch(/malformed/i)
    expect(err.message).toMatch(/405/)
    expect(err.message).toMatch(/proxy or gateway/i)
    expect(err.bodySnippet).toContain('405 Not Allowed')
  })

  it('still reports a plain non-JSON body without a canned hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 200 })),
    )
    await expect(fetchRange('ADANI_LAB', 1, 2)).rejects.toThrow(/non-JSON body/i)
  })
})

describe('fetchRangeChunked', () => {
  const DAY = 24 * 60 * 60 * 1000
  // Well before the data cut-off (config/dataWindow.ts), so only the chunking is under test.
  const START = Date.parse('2026-07-01T00:00:00Z')

  /** A device that reports once an hour, answering each request with only its own window. */
  function hourlyDevice() {
    const calls: Array<[number, number]> = []
    const spy = vi.fn(async (input: RequestInfo | URL) => {
      const [, s, e] = String(input).match(/getDataByStEt\/[^/]+\/(\d+)\/(\d+)/) ?? []
      const from = Number(s)
      const to = Number(e)
      calls.push([from, to])
      const rows = []
      for (let t = Math.ceil(from / 3_600_000) * 3_600_000; t <= to; t += 3_600_000) {
        rows.push({ time: new Date(t).toISOString(), D0: t / 3_600_000 })
      }
      return new Response(JSON.stringify({ success: true, data: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', spy)
    return { spy, calls }
  }

  it('splits a multi-day window into day-sized requests', async () => {
    const { calls } = hourlyDevice()
    await fetchRangeChunked('ADANI_RAW', START, START + 3 * DAY)

    expect(calls).toHaveLength(3)
    expect(calls[0]).toEqual([START, START + DAY])
    expect(calls[2][1]).toBe(START + 3 * DAY)
  })

  it('returns one chronological row per instant, with no duplicate at a chunk edge', async () => {
    hourlyDevice()
    const { rows, capped } = await fetchRangeChunked('ADANI_RAW', START, START + 3 * DAY)

    // Hourly samples over 72 h, inclusive of both ends, with the two chunk-edge hours
    // reported by both neighbouring requests but merged into one.
    expect(rows).toHaveLength(73)
    const times = rows.map((r) => r.t)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(new Set(times).size).toBe(times.length)
    expect(capped).toBe(false)
  })

  it('trims an over-long window from the old end and says so', async () => {
    const { calls } = hourlyDevice()
    const end = START + 30 * DAY
    const result = await fetchRangeChunked('ADANI_RAW', START, end, { maxSpanMs: 7 * DAY })

    expect(result.capped).toBe(true)
    expect(result.fetchedStart).toBe(end - 7 * DAY)
    expect(calls).toHaveLength(7)
    expect(Math.min(...calls.map((c) => c[0]))).toBe(end - 7 * DAY)
    expect(Math.max(...calls.map((c) => c[1]))).toBe(end)
  })

  it('keeps the newest 7 days before the data cut-off when a long range runs past it', async () => {
    const { calls } = hourlyDevice()
    const CUTOFF = Date.parse('2026-08-28T03:00:00+05:30')
    // 1 Aug to 28 Oct: the newest 7 days with data end at the cut-off, not on 28 Oct.
    const result = await fetchRangeChunked('ADANI_RAW', Date.parse('2026-08-01T00:00:00Z'), Date.parse('2026-10-28T00:00:00Z'), {
      maxSpanMs: 7 * DAY,
    })
    expect(result.capped).toBe(true)
    expect(result.fetchedStart).toBe(CUTOFF - 7 * DAY)
    expect(Math.max(...calls.map((c) => c[1]))).toBe(CUTOFF)
    expect(result.rows.length).toBeGreaterThan(160)
  })

  it('loads every week of a long laboratory range when it is not capped', async () => {
    const { calls } = hourlyDevice()
    const end = START + 56 * DAY
    const { rows, capped } = await fetchRangeChunked('ADANI_LAB', START, end, { chunkMs: 7 * DAY, maxSpanMs: Number.POSITIVE_INFINITY })
    expect(capped).toBe(false)
    expect(calls).toHaveLength(8)
    expect(rows).toHaveLength(56 * 24 + 1)
  })

  it('does not call a preset-sized window (span + 1 ms) shortened', async () => {
    hourlyDevice()
    const result = await fetchRangeChunked('ADANI_RAW', START, START + 7 * DAY + 1, {
      maxSpanMs: 7 * DAY,
    })
    expect(result.capped).toBe(false)
    expect(result.fetchedStart).toBe(START)
  })

  it('does not run more requests at once than the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
    await fetchRangeChunked('ADANI_RAW', START, START + 7 * DAY, { concurrency: 3 })
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('thins dense rows into buckets when asked', async () => {
    hourlyDevice()
    const { rows } = await fetchRangeChunked('ADANI_RAW', START, START + DAY, {
      thinMs: 6 * 3_600_000,
    })
    expect(rows.length).toBeLessThan(10)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('propagates a failed chunk instead of returning a silently short series', async () => {
    mockFetch({ success: false, errors: ['boom'] })
    await expect(fetchRangeChunked('ADANI_RAW', START, START + 2 * DAY)).rejects.toThrow(/boom/)
  })
})

describe('cancelled requests', () => {
  it('rethrows an abort during the body download instead of reporting an empty response', async () => {
    const controller = new AbortController()
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const res = new Response('{}', { status: 200 })
        // The caller cancels while the body is still arriving.
        vi.spyOn(res, 'text').mockImplementation(async () => {
          controller.abort()
          throw abort
        })
        return res
      }),
    )
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(fetchRange('ADANI_RAW', 1, 2, controller.signal)).rejects.toBe(abort)
    expect(log).not.toHaveBeenCalled() // no "non-JSON body" error for a deliberate cancel
    log.mockRestore()
  })

  it('rethrows an abort that happens before any response', async () => {
    const controller = new AbortController()
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort()
        throw abort
      }),
    )
    await expect(fetchRange('ADANI_RAW', 1, 2, controller.signal)).rejects.toBe(abort)
  })

  it('still reports a genuinely empty body when nothing was cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchRange('ADANI_RAW', 1, 2)).rejects.toBeInstanceOf(ApiError)
    log.mockRestore()
  })
})

describe('impossible readings', () => {
  const T = '2026-08-20T06:00:00.000Z'

  it('drops a predicted C3S above 50 % from the laboratory rows, and keeps 50 % itself', async () => {
    mockFetch({
      success: true,
      data: [
        { time: '2026-08-20T06:30:00.000Z', D55: 50, D58: 42.1 },
        { time: '2026-08-20T06:15:00.000Z', D55: 63.4, D52: 2.9 },
        { time: T, D55: 41.8 },
      ],
    })
    const rows = await fetchRange('ADANI_LAB', Date.parse(T) - 1, Date.parse(T) + 3_600_000)
    expect(rows.map((r) => r.values.D55)).toEqual([41.8, undefined, 50])
    // The rest of that row is kept.
    expect(rows[1].values).toEqual({ D52: 2.9 })
  })

  it('treats it as no reading in the newest values too', async () => {
    mockFetch({ success: true, data: { devID: 'ADANI_LAB', data: { D55: { time: T, value: 77 } } } })
    expect((await fetchLatest('ADANI_LAB', ['D55'])).get('D55')).toEqual({ sensorId: 'D55', value: null, time: Date.parse(T) })
  })

  it('leaves the process device alone: its D55 is a different tag', async () => {
    mockFetch({ success: true, data: [{ time: T, D55: 812 }] })
    expect((await fetchRange('ADANI_RAW', Date.parse(T) - 1, Date.parse(T) + 1))[0].values.D55).toBe(812)
  })
})
