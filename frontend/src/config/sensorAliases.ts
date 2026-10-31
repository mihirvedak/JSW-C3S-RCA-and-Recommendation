/**
 * Per-sensor name overrides — an optional layer above the client specs.
 *
 * Names come from each client's spec in `config/clients/`. Add an entry here only to rename one
 * sensor without touching the spec, or to name a tag a spec lists as unnamed (Adani's model
 * outputs D52–D54, D56, D57).
 *
 * Keys are `DEVICE:SENSOR` (never a bare D-tag: `ADANI_LAB:D55` and `ADANI_RAW:D55` are
 * different measurements). A value replaces the label everywhere the sensor is shown — KPI
 * cards, lab grid, process list, chart tooltips and legends.
 */
export const SENSOR_ALIASES: Readonly<Record<string, string>> = {
  // 'ADANI_LAB:D0': 'Raw Mix LSF',
}
