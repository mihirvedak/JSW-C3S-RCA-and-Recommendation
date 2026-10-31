/**
 * Per-sensor name overrides — an optional layer above the supplied tag maps.
 *
 * Names for every ADANI_LAB tag D0–D51 and every ADANI_RAW tag D0–D123 already come from
 * the tag maps in `tagMaps.ts`. Add an entry here only to rename one sensor, or to name a
 * sensor the tag maps do not cover (the ADANI_LAB model outputs D52–D54, D56, D57).
 *
 * Keys are `DEVICE:SENSOR` (never a bare D-tag: `ADANI_LAB:D55` and `ADANI_RAW:D55` are
 * different measurements). A value replaces the label everywhere the sensor is shown — KPI
 * cards, lab grid, process list, chart tooltips and legends.
 */
export const SENSOR_ALIASES: Readonly<Record<string, string>> = {
  // 'ADANI_LAB:D0': 'Raw Mix LSF',
}
