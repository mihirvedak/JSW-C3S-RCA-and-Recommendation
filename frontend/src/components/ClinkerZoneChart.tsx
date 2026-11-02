/**
 * C3S against free lime over the clinker zones, drawn with Highcharts.
 *
 * The zones are polygons computed from the RCA insight's targets (`lib/clinkerZones.ts`), the
 * black rectangle is the target box (C3S band × free-lime band), and every sample is a point.
 * The view matches the reference zone plots; samples outside it are counted, not hidden
 * silently.
 */

import { useMemo } from 'react'
import Highcharts from 'highcharts'
import 'highcharts/highcharts-more'
import 'highcharts/modules/accessibility'
import { HighchartsReact } from 'highcharts-react-official'
import type { ClinkerTargets } from '../services/rcaService'
import {
  CLINKER_ZONES,
  classifyClinker,
  countByZone,
  defaultView,
  limeLevel,
  zonePolygons,
} from '../lib/clinkerZones'
import type { ClinkerZone, ZonePoint } from '../lib/clinkerZones'
import { DISPLAY_TIMEZONE } from '../lib/time'
import { ZONE_STYLE } from '../lib/zones'

/** Region fills: the central zone colours (`lib/zones.ts`), translucent so the points read. */
const ZONE_FILL: Readonly<Record<ClinkerZone, string>> = Object.fromEntries(
  CLINKER_ZONES.map((z) => [z, `${ZONE_STYLE[z].fill}4d`]),
) as Record<ClinkerZone, string>

const COLOR = { grid: '#dfe5ee', text: '#7b8799', ink: '#0f1b2d', event: '#d6324b' }

Highcharts.setOptions({ time: { timezone: DISPLAY_TIMEZONE } })

export function ClinkerZoneChart({
  points,
  targets,
  pointColor,
  pointName,
  xTitle,
  yTitle,
  marker,
}: {
  points: readonly ZonePoint[]
  targets: ClinkerTargets
  pointColor: string
  pointName: string
  xTitle: string
  yTitle: string
  /** The selected RCA event, drawn on top. */
  marker: { c3s: number; freeLime: number; label: string } | null
}) {
  const view = useMemo(() => defaultView(targets), [targets])

  const options = useMemo<Highcharts.Options>(() => {
    const [c3sLo, c3sHi] = targets.c3sBand
    const [flLo, flHi] = targets.freeLimeBand
    const describe = (c3s: number, fl: number) =>
      `C3S <b>${c3s.toFixed(2)}%</b> · free lime <b>${fl.toFixed(2)}%</b><br/>` +
      `Lime level ${limeLevel(c3s, fl, targets).toFixed(1)} · <b>${classifyClinker(c3s, fl, targets)}</b>`

    return {
      chart: { height: 380, style: { fontFamily: 'inherit' }, backgroundColor: 'transparent', spacing: [10, 12, 10, 4] },
      title: { text: undefined },
      credits: { enabled: false },
      time: { timezone: DISPLAY_TIMEZONE },
      accessibility: { description: `${pointName}: C3S against free lime over the clinker zones.` },
      legend: {
        align: 'right',
        verticalAlign: 'top',
        layout: 'vertical',
        floating: true,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderColor: COLOR.grid,
        borderWidth: 1,
        itemStyle: { fontSize: '10px', fontWeight: '500', color: COLOR.ink },
        symbolRadius: 2,
        y: 4,
      },
      xAxis: {
        min: view.x[0],
        max: view.x[1],
        tickInterval: 2,
        startOnTick: false,
        endOnTick: false,
        gridLineWidth: 1,
        gridLineColor: COLOR.grid,
        lineColor: COLOR.grid,
        title: { text: xTitle, style: { color: COLOR.text, fontSize: '11px' } },
        labels: { style: { color: COLOR.text, fontSize: '10px' } },
      },
      yAxis: {
        min: view.y[0],
        max: view.y[1],
        tickInterval: 0.5,
        startOnTick: false,
        endOnTick: false,
        gridLineColor: COLOR.grid,
        title: { text: yTitle, style: { color: COLOR.text, fontSize: '11px' } },
        labels: { style: { color: COLOR.text, fontSize: '10px' }, format: '{value:.1f}' },
      },
      tooltip: { useHTML: true, borderColor: COLOR.grid },
      plotOptions: {
        series: { animation: false, states: { inactive: { opacity: 1 } } },
        polygon: { enableMouseTracking: false, lineWidth: 0 },
      },
      series: [
        ...zonePolygons(targets, view).map(
          ({ zone, points: poly }): Highcharts.SeriesPolygonOptions => ({
            type: 'polygon',
            name: zone,
            color: ZONE_FILL[zone],
            data: poly,
            zIndex: 0,
            // Keep the legend in the reference order even if a zone is outside the view.
            legendIndex: CLINKER_ZONES.indexOf(zone),
          }),
        ),
        {
          // An unfilled polygon, not a line: a line doubling back on itself is unsorted data to
          // Highcharts (warning #15 in the console on every zone plot).
          type: 'polygon',
          name: 'Target box',
          className: 'czone-target',
          showInLegend: false,
          enableMouseTracking: false,
          color: COLOR.ink,
          fillColor: 'transparent',
          lineWidth: 1.25,
          data: [[c3sLo, flLo], [c3sHi, flLo], [c3sHi, flHi], [c3sLo, flHi]],
          zIndex: 1,
        },
        {
          type: 'scatter',
          name: pointName,
          showInLegend: false,
          color: pointColor,
          // Thousands of samples over a long range: smaller, translucent dots, so dense areas read
          // darker instead of merging into one block.
          marker:
            points.length > 2000
              ? {
                  radius: points.length > 10000 ? 1.25 : 1.75,
                  symbol: 'circle',
                  lineWidth: 0,
                  fillColor: Highcharts.color(pointColor).setOpacity(points.length > 10000 ? 0.35 : 0.6).get('rgba') as string,
                }
              : { radius: 2.5, symbol: 'circle' },
          data: points.map((p) => ({ x: p.c3s, y: p.freeLime, t: p.t })),
          tooltip: {
            headerFormat: '',
            pointFormatter() {
              const t = (this as unknown as { t: number }).t
              return `<div style="font-size:12px"><b>${Highcharts.dateFormat('%e %b %Y, %H:%M', t)}</b><br/>${describe(this.x, this.y as number)}</div>`
            },
          },
          zIndex: 2,
          turboThreshold: 0,
        },
        ...(marker
          ? [
              {
                type: 'scatter' as const,
                name: marker.label,
                showInLegend: false,
                color: COLOR.event,
                marker: { symbol: 'diamond', radius: 7, lineColor: '#fff', lineWidth: 1.5 },
                data: [{ x: marker.c3s, y: marker.freeLime }],
                dataLabels: {
                  enabled: true,
                  format: marker.label,
                  style: { fontSize: '10px', fontWeight: '700', color: COLOR.event, textOutline: '2px #fff' },
                  y: -10,
                },
                tooltip: {
                  headerFormat: '',
                  pointFormatter(this: Highcharts.Point): string {
                    return `<div style="font-size:12px"><b>${marker.label}</b><br/>${describe(this.x, this.y as number)}</div>`
                  },
                },
                zIndex: 4,
              },
            ]
          : []),
      ],
    }
  }, [points, targets, view, pointColor, pointName, xTitle, yTitle, marker])

  const counts = useMemo(() => countByZone(points, targets), [points, targets])
  const outside = points.filter(
    (p) => p.c3s < view.x[0] || p.c3s > view.x[1] || p.freeLime < view.y[0] || p.freeLime > view.y[1],
  ).length

  return (
    <div className="czone">
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ className: 'czone__chart' }} />
      <ul className="czone__counts" aria-label="Samples per zone">
        {CLINKER_ZONES.map((z) => {
          const n = counts.get(z) ?? 0
          return (
            <li key={z}>
              <span className="czone__swatch" style={{ background: ZONE_FILL[z] }} />
              {z} <strong>{n}</strong>
              <span className="muted"> ({points.length ? Math.round((n / points.length) * 100) : 0}%)</span>
            </li>
          )
        })}
      </ul>
      {outside > 0 ? (
        <p className="muted small">
          {outside} of {points.length} outside the view (C3S {view.x[0]}–{view.x[1]}, free lime{' '}
          {view.y[0]}–{view.y[1]}); counted above.
        </p>
      ) : null}
    </div>
  )
}
