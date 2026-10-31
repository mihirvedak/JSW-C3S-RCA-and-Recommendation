/**
 * Histogram binning for the C3S distribution.
 *
 * Bins are fixed-width and aligned to multiples of the width (38–39, 39–40, …) so the
 * labels are round numbers. A bin covers [from, to), except that a value exactly on the
 * top edge of the last bin is counted in it, so the maximum is never dropped.
 *
 * Several datasets can be binned over one shared range ({@link histogramSet}) so that
 * switching between them (actual / predicted) keeps the same axis rather than jumping.
 */

export interface HistBin {
  from: number
  to: number
  count: number
  /** Share of all samples in the dataset, 0–100. */
  pct: number
}

export interface Histogram {
  bins: HistBin[]
  /** Number of samples binned. */
  total: number
}

/** Remove binary-float noise so edges print as 38, 39, 39.5, not 38.99999999. */
const tidy = (n: number) => Math.round(n * 1e6) / 1e6

function edges(values: readonly number[], width: number): { start: number; count: number } | null {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return null
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const start = Math.floor(tidy(min / width)) * width
  const count = Math.floor(tidy((max - start) / width)) + 1
  return { start: tidy(start), count }
}

function fill(values: readonly number[], width: number, start: number, count: number): Histogram {
  const counts = new Array<number>(count).fill(0)
  let total = 0
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    const i = Math.floor(tidy((v - start) / width))
    if (i < 0 || i >= count) continue
    counts[i]++
    total++
  }
  return {
    total,
    bins: counts.map((c, i) => ({
      from: tidy(start + i * width),
      to: tidy(start + (i + 1) * width),
      count: c,
      pct: total === 0 ? 0 : (c / total) * 100,
    })),
  }
}

/** Bin one dataset over its own range. An empty dataset has no bins. */
export function histogram(values: readonly number[], width = 1): Histogram {
  const e = edges(values, width)
  return e ? fill(values, width, e.start, e.count) : { bins: [], total: 0 }
}

/** Bin several datasets over one shared range, so their axes line up. */
export function histogramSet<K extends string>(
  sets: Record<K, readonly number[]>,
  width = 1,
): Record<K, Histogram> {
  const all = (Object.values(sets) as Array<readonly number[]>).flat()
  const e = edges(all, width)
  const out = {} as Record<K, Histogram>
  for (const key of Object.keys(sets) as K[]) {
    out[key] = e ? fill(sets[key], width, e.start, e.count) : { bins: [], total: 0 }
  }
  return out
}

/** "38–39" — the label for a bin. */
export function binLabel(bin: HistBin): string {
  return `${bin.from}–${bin.to}`
}
