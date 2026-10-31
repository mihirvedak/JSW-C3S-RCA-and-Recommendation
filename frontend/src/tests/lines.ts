/** The configured lines, for tests: Adani (two devices, full tag maps) and JSW (nine devices). */
import { resolveLine } from '../config/plants'

export const ADANI = resolveLine({ plantId: 'adani', lineId: 'line1' }).line
export const JSW = resolveLine({ plantId: 'jsw', lineId: 'kiln' }).line

/** Shorthand for Adani keys in fixtures. */
export const lab = (id: string) => `ADANI_LAB:${id}`
export const raw = (id: string) => `ADANI_RAW:${id}`
