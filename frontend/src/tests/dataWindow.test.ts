import { afterEach, describe, expect, it, vi } from 'vitest'
import { afterCutoff, applyDataEnd, clampEnd, dataEndMs } from '../config/dataWindow'
import { resolveLine } from '../config/plants'
import { fetchRange } from '../services/deviceDataService'
import { processChunkMs } from '../hooks/useDashboardData'
import { DAY_MS, HOUR_MS } from '../lib/time'

/** 28 Aug 2026, 03:00 plant time (UTC+5:30). */
const CUTOFF = Date.parse('2026-08-28T03:00:00+05:30')

describe('data cut-off', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is 28 Aug 2026, 03:00 plant time for Adani, and none for JSW', () => {
    applyDataEnd(resolveLine({ plantId: 'jsw', lineId: 'kiln' }).plant.dataEnd)
    expect(dataEndMs()).toBeNull()
    expect(clampEnd(CUTOFF + 1)).toBe(CUTOFF + 1)
    applyDataEnd(resolveLine({ plantId: 'adani', lineId: 'line1' }).plant.dataEnd)
    expect(dataEndMs()).toBe(CUTOFF)
    expect(clampEnd(CUTOFF + 1)).toBe(CUTOFF)
    expect(clampEnd(CUTOFF - 1)).toBe(CUTOFF - 1)
    expect([afterCutoff(CUTOFF), afterCutoff(CUTOFF + 1), afterCutoff(null)]).toEqual([false, true, false])
  })

  it('never asks for, nor keeps, a reading after it', async () => {
    const fetch = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify({
            success: true,
            data: [
              { time: new Date(CUTOFF + 60_000).toISOString(), D0: 2 },
              { time: new Date(CUTOFF - 60_000).toISOString(), D0: 1 },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetch)
    const rows = await fetchRange('ADANI_RAW', CUTOFF - 3_600_000, CUTOFF + 3_600_000)
    expect(String(fetch.mock.calls[0][0])).toContain(`/${CUTOFF - 3_600_000}/${CUTOFF}`)
    expect(rows.map((r) => r.values.D0)).toEqual([1])
  })

  it('does not even call the platform for a window wholly after it', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await fetchRange('ADANI_LAB', CUTOFF + 1, CUTOFF + 3_600_000)).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('process load chunking', () => {
  it('splits 24 hours into four parallel 6-hour requests, never smaller, never above a day', () => {
    expect(processChunkMs(DAY_MS + 1)).toBe(6 * HOUR_MS + 1)
    expect(processChunkMs(6 * HOUR_MS)).toBe(6 * HOUR_MS)
    expect(processChunkMs(7 * DAY_MS)).toBe(DAY_MS)
  })
})
