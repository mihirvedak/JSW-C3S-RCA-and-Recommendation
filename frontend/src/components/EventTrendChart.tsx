/**
 * One process tag over the Trend Analysis window, drawn with Highcharts.
 *
 * The x axis is fixed to the window in the plant's time zone: the selected time range, or the
 * hour and a half around an RCA event. When an event is open it is a solid vertical line
 * labelled with its time, the 30 minutes after it are shaded, and the reading in force at the
 * event is ringed, so every chart on the tab reads the same way. Drag across a chart to zoom in.
 */

import { useMemo } from 'react'
import Highcharts from 'highcharts'
import 'highcharts/modules/accessibility'
import { HighchartsReact } from 'highcharts-react-official'
import type { Point } from '../lib/series'
import { breakAtGaps } from '../lib/series'
import { DISPLAY_TIMEZONE, HOUR_MS, MINUTE_MS } from '../lib/time'

/** The same values as --c-actual / --c-brand / --c-border / --c-ink-3 in App.css. */
const COLOR = {
  line: '#1f6fd0',
  event: '#d6324b',
  after: 'rgba(214, 50, 75, 0.06)',
  grid: '#dfe5ee',
  text: '#7b8799',
}

Highcharts.setOptions({ time: { timezone: DISPLAY_TIMEZONE } })

/** Up to this span the axis is ticked every 15 minutes; beyond it Highcharts spaces the ticks. */
const SHORT_SPAN_MS = 3 * HOUR_MS

/** "+25 min", "−3.5 h", "+2.1 d" from the event. */
function fromEvent(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : ''
  const a = Math.abs(ms)
  if (a < 2 * HOUR_MS) return `${sign}${Math.round(a / MINUTE_MS)} min from the event`
  if (a < 48 * HOUR_MS) return `${sign}${(a / HOUR_MS).toFixed(1)} h from the event`
  return `${sign}${(a / (24 * HOUR_MS)).toFixed(1)} d from the event`
}

export function EventTrendChart({
  name,
  unit,
  points,
  eventMs,
  atEvent,
  windowStart,
  windowEnd,
  maxGapMs,
  band,
  flagAt,
}: {
  name: string
  unit: string | null
  points: readonly Point[]
  /** The open RCA event, or null to chart the range without one. */
  eventMs: number | null
  atEvent: Point | null
  windowStart: number
  windowEnd: number
  /** A longer silence than this breaks the line (a minute tag: 5 min; thinned data: longer). */
  maxGapMs: number
  /** A normal band to shade, e.g. the filling degree's 14–16 %. */
  band?: { lo: number; hi: number; label: string }
  /** A flag level drawn as a dashed line, e.g. 18 %. */
  flagAt?: number
}) {
  const options = useMemo<Highcharts.Options>(() => {
    const fmt = (v: number) => v.toFixed(Math.abs(v) >= 100 ? 1 : 2)
    const short = windowEnd - windowStart <= SHORT_SPAN_MS
    const eventFormat = short ? '%H:%M' : '%e %b %H:%M'
    return {
      chart: {
        height: 200,
        // Room above the plot for the event label, and on the right for the last time label.
        marginTop: 24,
        spacing: [10, 16, 8, 4],
        style: { fontFamily: 'inherit' },
        backgroundColor: 'transparent',
        zooming: { type: 'x' },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      time: { timezone: DISPLAY_TIMEZONE },
      accessibility: {
        description:
          eventMs == null
            ? `${name} over the selected time range.`
            : `${name} over the trend window, with the RCA event marked.`,
      },
      xAxis: {
        type: 'datetime',
        min: windowStart,
        max: windowEnd,
        lineColor: COLOR.grid,
        tickColor: COLOR.grid,
        crosshair: { width: 1, color: COLOR.grid },
        ...(short
          ? {
              // Ticks every 15 min, labelled every 30, so a narrow card is not crowded.
              tickInterval: 15 * MINUTE_MS,
              labels: {
                step: 2,
                style: { color: COLOR.text, fontSize: '10px', textOverflow: 'none', whiteSpace: 'nowrap' },
                format: '{value:%H:%M}',
              },
            }
          : {
              tickPixelInterval: 90,
              dateTimeLabelFormats: { minute: '%H:%M', hour: '%H:%M', day: '%e %b', week: '%e %b', month: '%b %Y' },
              labels: { style: { color: COLOR.text, fontSize: '10px', textOverflow: 'none', whiteSpace: 'nowrap' } },
            }),
        plotBands:
          eventMs == null
            ? []
            : [{ from: eventMs, to: Math.min(eventMs + 30 * MINUTE_MS, windowEnd), color: COLOR.after, zIndex: 0 }],
        plotLines:
          eventMs == null
            ? []
            : [
                {
                  value: eventMs,
                  color: COLOR.event,
                  width: 2,
                  zIndex: 4,
                  // Above the plot area, so it never sits on the line. Centred on the line in a
                  // short window; on a long range the event can sit near either edge, so the label
                  // runs into the plot from the line instead of past the chart.
                  label: {
                    text: `Event ${Highcharts.dateFormat(eventFormat, eventMs)}`,
                    rotation: 0,
                    align: 'center',
                    textAlign: short ? 'center' : eventMs > (windowStart + windowEnd) / 2 ? 'right' : 'left',
                    verticalAlign: 'top',
                    x: short ? 0 : eventMs > (windowStart + windowEnd) / 2 ? -3 : 3,
                    y: -6,
                    clip: false,
                    style: { color: COLOR.event, fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap', textOverflow: 'none' },
                  },
                },
              ],
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: COLOR.grid,
        labels: { style: { color: COLOR.text, fontSize: '10px' } },
        startOnTick: false,
        endOnTick: false,
        // Keep the band and the flag line in view even when the readings sit far from them.
        softMin: band ? band.lo : undefined,
        softMax: flagAt ?? (band ? band.hi : undefined),
        plotBands: band
          ? [{ from: band.lo, to: band.hi, color: 'rgba(34, 160, 107, 0.12)', label: { text: band.label, align: 'left', x: 4, style: { color: '#0b5c3b', fontSize: '9.5px' } } }]
          : [],
        plotLines:
          flagAt != null
            ? [{ value: flagAt, color: COLOR.event, width: 1, dashStyle: 'Dash', zIndex: 3, label: { text: `Flag > ${flagAt}`, align: 'right', x: -4, style: { color: COLOR.event, fontSize: '9.5px' } } }]
            : [],
      },
      tooltip: {
        useHTML: true,
        borderColor: COLOR.grid,
        formatter() {
          const x = this.x as number
          const rel = eventMs == null ? '' : x === eventMs ? 'at the event' : fromEvent(x - eventMs)
          return (
            `<div style="font-size:12px"><div style="font-weight:650">${Highcharts.dateFormat('%e %b %Y, %H:%M', x)}</div>` +
            (rel ? `<div style="color:${COLOR.text};margin-bottom:3px">${rel}</div>` : '') +
            `<strong>${fmt(this.y as number)}</strong>${unit ? ` ${unit}` : ''}</div>`
          )
        },
      },
      plotOptions: { series: { animation: false, states: { inactive: { opacity: 1 } } } },
      series: [
        {
          type: 'line',
          name,
          color: COLOR.line,
          lineWidth: short ? 1.75 : 1.25,
          marker: { enabled: false, symbol: 'circle', states: { hover: { enabled: true, radius: 3 } } },
          data: breakAtGaps(points, maxGapMs),
          zIndex: 2,
        },
        ...(atEvent
          ? [
              {
                type: 'scatter' as const,
                name: 'At event',
                color: COLOR.event,
                marker: { symbol: 'circle', radius: 5, fillColor: '#fff', lineColor: COLOR.event, lineWidth: 2 },
                data: [[atEvent.t, atEvent.v]],
                enableMouseTracking: false,
                zIndex: 5,
              },
            ]
          : []),
      ],
    }
  }, [name, unit, points, eventMs, atEvent, windowStart, windowEnd, maxGapMs, band, flagAt])

  // Highcharts merges an update into the chart, so switching between the quarter-hour axis and the
  // day axis would keep the other's tick settings and labels; a fresh chart for each avoids that.
  const axisKind = windowEnd - windowStart <= SHORT_SPAN_MS ? 'short' : 'long'
  return (
    <HighchartsReact
      key={axisKind}
      highcharts={Highcharts}
      options={options}
      containerProps={{ className: 'etrend__chart' }}
    />
  )
}
