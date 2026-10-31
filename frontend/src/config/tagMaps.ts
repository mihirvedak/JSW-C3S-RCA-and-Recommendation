/**
 * Sensor names for ADANI_LAB and ADANI_RAW, as supplied in the two tag-map files
 * (`adani_lab_tag_map.json`, `adani_raw_tag_map.json`).
 *
 * This is the mapping authority for names, units and — on the process device — the
 * equipment section each tag belongs to. The platform's own sensor metadata is not
 * readable with this account, so these tables are the only source. Keyed by D-tag *within
 * one device*; the same D-tag means a different measurement on the other device.
 *
 * Two small normalisations were made to the supplied text: the degree sign arrives as a
 * half-width katakana character ("ｰC") in the source export and is written "°C" here, and
 * one parameter's spelling ("Clinlker") is corrected. Nothing else is altered.
 */

/* ------------------------------------------------------------------ *
 * ADANI_LAB — one contiguous D-block per stream (D0–D51)
 * ------------------------------------------------------------------ */

export interface LabTag {
  /** Stream name as shown to operators, e.g. "Raw mix". */
  stream: string
  /** The parameter within the stream, e.g. "SiO2". */
  parameter: string
  /** Operator-facing label. */
  label: string
  /** Engineering unit; null for dimensionless ratios. */
  unit: string | null
  /** What the parameter is, from the tag map. */
  meaning: string
}

/** The 13 parameters of a raw-mix / kiln-feed sample, in D-tag order. */
const MIX_PARAMS: ReadonlyArray<readonly [string, string | null, string]> = [
  ['SiO2', '%', 'silica'],
  ['Al2O3', '%', 'alumina'],
  ['Fe2O3', '%', 'iron oxide'],
  ['CaO', '%', 'lime (total)'],
  ['LOI', '%', 'loss on ignition (calculated)'],
  ['SO3', '%', 'sulfur trioxide'],
  ['Cl', '%', 'chloride'],
  ['MgO', '%', 'magnesia'],
  ['Na2O', '%', 'sodium oxide'],
  ['K2O', '%', 'potassium oxide'],
  ['LSF', null, 'lime saturation factor (derived)'],
  ['SM', null, 'silica modulus (derived)'],
  ['AM', null, 'alumina modulus (derived)'],
]

const HOT_MEAL_PARAMS: ReadonlyArray<readonly [string, string | null, string]> = [
  ['SO3', '%', 'sulfur trioxide'],
  ['Cl', '%', 'chloride'],
  ['Na2O', '%', 'sodium oxide'],
  ['K2O', '%', 'potassium oxide'],
]

const CLINKER_PARAMS: ReadonlyArray<readonly [string, string | null, string]> = [
  ['SiO2', '%', 'silica'],
  ['Al2O3', '%', 'alumina'],
  ['Fe2O3', '%', 'iron oxide'],
  ['CaO', '%', 'lime (total)'],
  ['SO3', '%', 'sulfur trioxide'],
  ['Cl', '%', 'chloride'],
  ['MgO', '%', 'magnesia'],
  ['Na2O', '%', 'sodium oxide'],
  ['K2O', '%', 'potassium oxide'],
  ['FreeCaO', '%', 'free lime - under-burning indicator'],
  ['C3S', '%', 'tricalcium silicate, Bogue, free-lime corrected (derived)'],
  ['C3S_uncorrected', '%', 'tricalcium silicate before the free-lime term (derived)'],
]

/** Streams in D-tag order: first tag, display stream name, and the parameters it carries. */
const LAB_STREAMS: ReadonlyArray<{
  from: number
  stream: string
  params: ReadonlyArray<readonly [string, string | null, string]>
}> = [
  { from: 0, stream: 'Raw mix', params: MIX_PARAMS },
  { from: 13, stream: 'Kiln feed', params: MIX_PARAMS },
  { from: 26, stream: 'Hot meal (stream 1)', params: HOT_MEAL_PARAMS },
  { from: 30, stream: 'Hot meal (stream 2)', params: HOT_MEAL_PARAMS },
  { from: 34, stream: 'Clinker', params: CLINKER_PARAMS },
  { from: 46, stream: 'Coal', params: [['NCV', 'kcal/kg', 'calorific value as reported by LIMS']] },
  { from: 47, stream: 'Coal', params: [['Ash', '%', 'ash content']] },
  {
    from: 48,
    stream: 'AFR',
    params: [
      ['Ash_furnace', '%', 'ash by furnace method'],
      ['NCV_net', 'kcal/kg', 'net calorific value'],
      ['TotalMoisture', '%', 'total moisture'],
      ['Cl_AT', '%', 'chloride, alternate method'],
    ],
  },
]

/** Display text for a parameter name: underscores are word breaks, "_uncorrected" is a qualifier. */
function prettyParameter(parameter: string): string {
  const m = /^(.*)_uncorrected$/.exec(parameter)
  if (m) return `${m[1]} (uncorrected)`
  return parameter
    .replace(/^Ash_furnace$/, 'Ash (furnace)')
    .replace(/^NCV_net$/, 'NCV (net)')
    .replace(/^TotalMoisture$/, 'Total moisture')
    .replace(/^Cl_AT$/, 'Cl (alternate method)')
    .replace(/^FreeCaO$/, 'Free CaO')
}

function buildLabTags(): Readonly<Record<string, LabTag>> {
  const out: Record<string, LabTag> = {}
  for (const s of LAB_STREAMS) {
    s.params.forEach(([parameter, unit, meaning], i) => {
      const nice = prettyParameter(parameter)
      out[`D${s.from + i}`] = {
        stream: s.stream,
        parameter,
        // "Coal NCV", "Coal Ash" and "AFR NCV (net)" read naturally; "Raw mix SiO2" likewise.
        label: `${s.stream} ${nice}`,
        unit,
        meaning,
      }
    })
  }
  return out
}

export const LAB_TAGS: Readonly<Record<string, LabTag>> = buildLabTags()

/* ------------------------------------------------------------------ *
 * ADANI_RAW — 124 process signals (D0–D123)
 * ------------------------------------------------------------------ */

export type ProcessSection = 'preheater' | 'calciner' | 'kiln' | 'cooler' | 'other'

/** The tag map's own assessment of each signal. Carried as data; not used to hide anything. */
export type SignalQuality = 'usable' | 'flag' | 'unreliable' | 'drop'

export interface RawTag {
  /** Parameter name as supplied, e.g. "Cooler Fan 9 Amps". */
  label: string
  unit: string | null
  section: ProcessSection
  quality: SignalQuality
}

export const PROCESS_SECTION_ORDER: readonly ProcessSection[] = [
  'preheater',
  'calciner',
  'kiln',
  'cooler',
  'other',
]

export const PROCESS_SECTION_LABELS: Readonly<Record<ProcessSection, string>> = {
  preheater: 'Preheater',
  calciner: 'Calciner',
  kiln: 'Kiln',
  cooler: 'Cooler',
  other: 'Other',
}

/** D-tags per section, exactly as listed in the tag map's layout. Everything else is Cooler. */
const PREHEATER = range(78, 116)
const CALCINER = new Set([1, 2, 3, 4, 76, 77])
const KILN = new Set([0, 67, 69, 70, 71, 72, 73])
const OTHER = new Set([64, 65, 66, 74, 75, 118, 123])

function range(a: number, b: number): Set<number> {
  return new Set(Array.from({ length: b - a + 1 }, (_, i) => a + i))
}

function sectionOf(n: number): ProcessSection {
  if (PREHEATER.has(n)) return 'preheater'
  if (CALCINER.has(n)) return 'calciner'
  if (KILN.has(n)) return 'kiln'
  if (OTHER.has(n)) return 'other'
  return 'cooler'
}

const QUALITY: Readonly<Record<string, SignalQuality>> = {
  U: 'usable',
  F: 'flag',
  R: 'unreliable',
  D: 'drop',
}

/** tag | parameter | unit | quality (U usable, F flag, R unreliable, D drop) */
const RAW_ROWS = `
0|Burning Zone Temp|°C|U
1|Calciner CO Str1|ppm|R
2|Calciner CO Str2|ppm|R
3|Calciner O2 Str1|%|R
4|Calciner O2 Str2|%|R
5|Clinker DBC Feed Rate(491-BW1)|t/h|D
6|Clinker Temp|°C|D
7|Cooler Fan 1 Amps|A|U
8|Cooler Fan 1 DP|mbar|U
9|Cooler Fan 1 Flow|m3/sec|U
10|Cooler Fan 1 Speed|rpm|U
11|Cooler Fan 10 Amps|A|U
12|Cooler Fan 10 DP|mbar|U
13|Cooler Fan 10 Flow|m3/sec|U
14|Cooler Fan 10 Speed|%|U
15|Cooler Fan 11 Amps|A|U
16|Cooler Fan 11 DP|mbar|F
17|Cooler Fan 11 Flow|m3/sec|U
18|Cooler Fan 11 Speed|%|U
19|Cooler Fan 12 Amps|A|U
20|Cooler Fan 12 DP|mbar|U
21|Cooler Fan 12 Flow|m3/sec|U
22|Cooler Fan 12 Speed|#|U
23|Cooler Fan 13 Amps|A|U
24|Cooler Fan 13 DP|mbar|F
25|Cooler Fan 13 Flow|m3/sec|U
26|Cooler Fan 13 Speed|#|U
27|Cooler Fan 2 Amps|A|U
28|Cooler Fan 2 DP|mbar|U
29|Cooler Fan 2 Flow|m3/sec|U
30|Cooler Fan 2 Speed|rpm|U
31|Cooler Fan 3 Amps|A|U
32|Cooler Fan 3 DP|mbar|U
33|Cooler Fan 3 Flow|m3/sec|U
34|Cooler Fan 3 Speed|rpm|U
35|Cooler Fan 4 Amps|A|U
36|Cooler Fan 4 DP|mbar|U
37|Cooler Fan 4 Flow|m3/sec|U
38|Cooler Fan 4 Speed|rpm|U
39|Cooler Fan 5 Amps|A|U
40|Cooler Fan 5 DP|mbar|U
41|Cooler Fan 5 Flow|m3/sec|U
42|Cooler Fan 5 Speed|rpm|U
43|Cooler Fan 6 Amps|A|U
44|Cooler Fan 6 DP|mbar|U
45|Cooler Fan 6 Flow|m3/sec|U
46|Cooler Fan 6 Speed|rpm|U
47|Cooler Fan 7 Amps|A|U
48|Cooler Fan 7 DP|mbar|U
49|Cooler Fan 7 Flow|m3/sec|U
50|Cooler Fan 7 Speed|%|U
51|Cooler Fan 8 Amps|A|U
52|Cooler Fan 8 DP|mbar|U
53|Cooler Fan 8 Flow|m3/sec|D
54|Cooler Fan 8 Speed|%|U
55|Cooler Fan 9 Amps|A|U
56|Cooler Fan 9 DP|mbar|U
57|Cooler Fan 9 Flow|m3/sec|U
58|Cooler Fan 9 Speed|%|U
59|Cooler Grate Speed|1/min|U
60|Cooler Grate Speed SP|1/min|D
61|ESP Inlet Temp|°C|U
62|Grate Hyd Press 1|bar|D
63|Grate Hyd Press 2|bar|D
64|KILN Stops Counter Total_CF|#|D
65|Kiln Drive (461-MD1) RunFB_CF|h|D
66|Kiln Coal|t/h|U
67|Kiln Current|A|D
68|Kiln Hood Draft|mbar|U
69|Kiln Inlet CO|%|R
70|Kiln Inlet NOx|ppm|R
71|Kiln Inlet O2|%|R
72|Kiln Inlet Temp|°C|U
73|Kiln RPM|rpm|D
74|Kiln feed|t/h|U
75|PC Coal|t/h|U
76|PC Outlet Draft|mbar|U
77|PC Outlet Temp|°C|F
78|PH Cy1A Draft|mbar|U
79|PH Cy1A Gas Temp|°C|U
80|PH Cy1A Matl Temp|°C|U
81|PH Cy1B Draft|mbar|U
82|PH Cy1B Gas Temp|°C|U
83|PH Cy1B Matl Temp|°C|U
84|PH Cy2A Draft|mbar|U
85|PH Cy2A Gas Temp|°C|U
86|PH Cy2A Matl Temp|°C|U
87|PH Cy2B Draft|mbar|U
88|PH Cy2B Gas Temp|°C|U
89|PH Cy2B Matl Temp|°C|U
90|PH Cy3A Draft|mbar|U
91|PH Cy3A Gas Temp|°C|U
92|PH Cy3A Matl Temp|°C|U
93|PH Cy3B Draft|mbar|U
94|PH Cy3B Gas Temp|°C|U
95|PH Cy3B Matl Temp|°C|U
96|PH Cy4A Draft|mbar|U
97|PH Cy4A Gas Temp|°C|U
98|PH Cy4B Draft|mbar|U
99|PH Cy4B Gas Temp|°C|U
100|PH Cy5A Draft|mbar|U
101|PH Cy5A Gas Temp|°C|U
102|PH Cy5A Matl Temp|°C|U
103|PH Cy5B Draft|mbar|U
104|PH Cy5B Gas Temp|°C|U
105|PH Cy5B Matl Temp|°C|U
106|PH Cy6A Draft|mbar|U
107|PH Cy6A Gas Temp|°C|U
108|PH Cy6B Draft|mbar|U
109|PH Cy6C Draft|mbar|U
110|PH Cy6D Draft|mbar|U
111|PH Cy6D Gas Temp|°C|U
112|PH Fan Inlet Temp|°C|D
113|PH Fan Power|kw|U
114|PH Fan Speed|rpm|U
115|PH Outlet CO|%|R
116|PH Outlet O2|%|R
117|Secondary Air Temp|°C|U
118|Solid AFR|t/h|U
119|TAD Damper1|%|U
120|TAD Damper2|%|U
121|TAD Draft|mbar|U
122|TAD Temperature|°C|U
123|Total Clinker Production_CF|t|U
`

function buildRawTags(): Readonly<Record<string, RawTag>> {
  const out: Record<string, RawTag> = {}
  for (const line of RAW_ROWS.trim().split('\n')) {
    const [tag, label, unit, q] = line.split('|')
    const n = Number(tag)
    out[`D${n}`] = {
      label,
      unit: unit || null,
      section: sectionOf(n),
      quality: QUALITY[q],
    }
  }
  return out
}

export const RAW_TAGS: Readonly<Record<string, RawTag>> = buildRawTags()
