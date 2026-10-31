import { describe, expect, it } from 'vitest'
import { NOT_CLASSIFIED, ZONE_ORDER, ZONE_STYLE, normalizeZone, shownZone, zoneDetail, zoneOf } from '../lib/zones'

describe('classification palette', () => {
  it('maps the insight vocabulary to the dashboard classes', () => {
    expect(normalizeZone('Overlimed')).toBe('Overlimed')
    expect(normalizeZone('Unburnt')).toBe('Under burnt')
    expect(normalizeZone('Under burnt')).toBe('Under burnt')
    expect(normalizeZone('Over-burnt')).toBe('Overburnt')
    expect(normalizeZone('Good clinker')).toBe('Good clinker')
    expect(normalizeZone('Underlimed')).toBe('Underlimed')
    expect(normalizeZone('Something new')).toBe('Undetermined')
    expect(normalizeZone(null)).toBe('Undetermined')
  })

  it('reads an older result with no zone as undetermined, and says why', () => {
    expect(zoneOf({ zone: null })).toBe('Undetermined')
    expect(zoneDetail({ zone: null, direction: 'low' })).toMatch(/no zone \(C3S low\)/)
  })

  it('uses the fixed colours of the brief', () => {
    // Yellow, orange, light blue, dark blue, green: by hue, not exact shade.
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const d = max - min
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return (h * 60 + 360) % 360
    }
    expect(hue(ZONE_STYLE.Undetermined.fill)).toBeGreaterThan(40)
    expect(hue(ZONE_STYLE.Undetermined.fill)).toBeLessThan(60)
    expect(hue(ZONE_STYLE.Overlimed.fill)).toBeGreaterThan(20)
    expect(hue(ZONE_STYLE.Overlimed.fill)).toBeLessThan(35)
    expect(hue(ZONE_STYLE['Good clinker'].fill)).toBeGreaterThan(120)
    expect(hue(ZONE_STYLE['Good clinker'].fill)).toBeLessThan(170)
    for (const z of ['Under burnt', 'Overburnt'] as const) {
      expect(hue(ZONE_STYLE[z].fill)).toBeGreaterThan(190)
      expect(hue(ZONE_STYLE[z].fill)).toBeLessThan(230)
    }
  })

  it('keeps every class and "no prediction" visually distinct', () => {
    const fills = [...ZONE_ORDER, NOT_CLASSIFIED].map((z) => ZONE_STYLE[z].fill)
    expect(new Set(fills).size).toBe(fills.length)
  })

  it('never shows Undetermined: it is drawn as Not classified, and kept out of the legend', () => {
    expect(shownZone('Undetermined')).toBe(NOT_CLASSIFIED)
    expect(shownZone('Overlimed')).toBe('Overlimed')
    expect(ZONE_ORDER).not.toContain('Undetermined')
  })
})
