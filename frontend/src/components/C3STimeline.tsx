/**
 * C3S prediction-vs-actual trend, drawn with Highcharts.
 *
 * The x axis is a real datetime axis in the plant's time zone and can be zoomed and
 * panned horizontally: drag to zoom into a stretch of time, scroll the wheel to zoom about
 * the cursor, hold Shift and drag to pan, and use "Reset zoom" to return to the selected
 * range. The reset control is the page's own button: Highcharts' built-in one is not shown
 * after a wheel zoom, so it cannot be relied on. Zoom is a view of the data already loaded; the global time picker still decides
 * what is fetched.
 *
 * Two rules from the data carry over unchanged:
 *   - Laboratory measurements are never interpolated. The line breaks across any gap
 *     longer than a multiple of the series' own median interval (a null point is inserted
 *     there; core Highcharts has no `gapSize`).
 *   - Samples are plotted at their own timestamps; nothing is resampled.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Highcharts from 'highcharts'
import 'highcharts/modules/accessibility'
import 'highcharts/modules/mouse-wheel-zoom'
import { HighchartsReact } from 'highcharts-react-official'
import type { Band, MatchedSample, Point } from '../lib/series'
import { breakAtGaps, medianIntervalMs } from '../lib/series'
import { DISPLAY_TIMEZONE, MINUTE_MS } from '../lib/time'
import { useLine } from '../config/LineContext'
import { ZONE_STYLE } from '../lib/zones'
import type { ZoneKey } from '../lib/zones'

/** An RCA event drawn on the trend, in its classification colour. */
export interface TrendEvent {
  id: string
  t: number
  c3s: number
  zone: ZoneKey
}

/** Series colours; the same values as --c-actual / --c-pred / --c-low / --c-high in App.css. */
const COLOR = {
  actual: '#1f6fd0',
  pred: '#0f9b74',
  low: '#d6324b',
  high: '#e2820c',
  band: 'rgba(31, 111, 208, 0.09)',
  grid: '#dfe5ee',
  text: '#7b8799',
  ink: '#0f1b2d',
}

/**
 * Join two consecutive samples only when the gap is no more than this multiple of the
 * series' own median interval. Beyond that the line breaks, showing the gap honestly.
 */
const GAP_FACTOR = 2.5

/** Narrowest span the chart can be zoomed to. */
const MIN_ZOOM_MS = 15 * MINUTE_MS

Highcharts.setOptions({
  time: { timezone: DISPLAY_TIMEZONE },
  lang: { thousandsSep: '', resetZoom: 'Reset zoom', resetZoomTitle: 'Show the whole selected range' },
})

/**
 * Plot-line methods exist on every Highcharts axis at runtime but are not part of this
 * version's `Axis` typings. Moving a plot line this way, rather than with `axis.update()`,
 * leaves the user's zoom untouched.
 */
type PlotLineAxis = Highcharts.Axis & {
  addPlotLine(options: Highcharts.XAxisPlotLinesOptions): unknown
  removePlotLine(id: string): void
}

interface Props {
  predicted: readonly Point[]
  actual: readonly Point[]
  matched: readonly MatchedSample[]
  band: Band | null
  windowStart: number | null
  windowEnd: number | null
  selectedTime: number | null
  onSelect: (labTime: number) => void
  /** C3S target, drawn as a line inside the band. */
  target?: number | null
  /** RCA events, as markers in the central zone colours. */
  events?: readonly TrendEvent[]
  onSelectEvent?: (id: string) => void
  /** Classification of each prediction, by its timestamp, for the tooltip. */
  predictionZones?: ReadonlyMap<number, ZoneKey>
}

export function C3STimeline({
  predicted,
  actual,
  matched,
  band,
  windowStart,
  windowEnd,
  selectedTime,
  onSelect,
  target = null,
  events = [],
  onSelectEvent,
  predictionZones,
}: Props) {
  const line = useLine()
  const ACTUAL_LABEL = line.label(line.actualC3S)
  const PREDICTED_LABEL = line.label(line.predictedC3S)
  const chartRef = useRef<HighchartsReact.RefObject>(null)

  // The click handler is read through a ref so a new callback identity never rebuilds the
  // options — which would reset the user's zoom.
  const onSelectRef = useRef(onSelect)
  const onSelectEventRef = useRef(onSelectEvent)
  useEffect(() => {
    onSelectRef.current = onSelect
    onSelectEventRef.current = onSelectEvent
  }, [onSelect, onSelectEvent])

  // Whether the view is narrower than the selected range, however it got that way.
  const [zoomed, setZoomed] = useState(false)
  const windowRef = useRef({ start: windowStart, end: windowEnd })
  useEffect(() => {
    windowRef.current = { start: windowStart, end: windowEnd }
  }, [windowStart, windowEnd])

  const options = useMemo<Highcharts.Options>(() => {
    const predGap = medianIntervalMs(predicted)
    const actualGap = medianIntervalMs(actual)
    const predMaxGap = predGap == null ? null : predGap * GAP_FACTOR
    const actualMaxGap = actualGap == null ? null : actualGap * GAP_FACTOR
    const matchedByTime = new Map(matched.map((m) => [m.labTime, m]))

    const bandText = (v: number) =>
      band == null ? '' : v < band.low ? 'below band' : v > band.high ? 'above band' : 'in band'
    const eventByTime = new Map(events.map((e) => [e.t, e]))

    return {
      chart: {
        height: 300,
        spacing: [12, 12, 22, 4], // bottom room keeps the Highcharts credit clear of the axis labels
        style: { fontFamily: 'inherit' },
        backgroundColor: 'transparent',
        // Horizontal zoom: drag a region, wheel about the cursor, Shift+drag to pan.
        zooming: {
          type: 'x',
          mouseWheel: { enabled: true, type: 'x' },
          // Hidden: the page renders its own reset button (see the file header).
          resetButton: { theme: { style: { display: 'none' } } },
        },
        panning: { enabled: true, type: 'x' },
        panKey: 'shift',
      },
      title: { text: undefined },
      credits: { enabled: true },
      legend: { enabled: false }, // the page's own legend below carries the series names
      time: { timezone: DISPLAY_TIMEZONE },
      accessibility: {
        description: 'C3S predicted versus actual laboratory values over the selected range.',
      },
      xAxis: {
        type: 'datetime',
        min: windowStart ?? undefined,
        max: windowEnd ?? undefined,
        minRange: MIN_ZOOM_MS,
        lineColor: COLOR.grid,
        tickColor: COLOR.grid,
        labels: {
          style: { color: COLOR.text, fontSize: '10px' },
          // 24-hour clock like the rest of the page, with the date at each midnight so a
          // multi-day axis never shows two identical-looking "12:00" labels.
          formatter() {
            const t = this.value as number
            const clock = Highcharts.dateFormat('%H:%M', t)
            return clock === '00:00' ? Highcharts.dateFormat('%e %b', t).trim() : clock
          },
        },
        crosshair: { width: 1, color: COLOR.grid },
        // A plot line for the selected event is added and moved without touching the zoom.
        plotLines: [],
        events: {
          afterSetExtremes(e) {
            const { start, end } = windowRef.current
            if (start == null || end == null) return
            setZoomed(Math.abs(e.min - start) > 1 || Math.abs(e.max - end) > 1)
          },
        },
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: COLOR.grid,
        labels: { style: { color: COLOR.text, fontSize: '10px' }, format: '{value:.1f}' },
        startOnTick: false,
        endOnTick: false,
        plotBands: band
          ? [{ from: band.low, to: band.high, color: COLOR.band, zIndex: 0 }]
          : [],
        plotLines:
          target != null
            ? [
                {
                  value: target,
                  color: COLOR.text,
                  width: 1,
                  dashStyle: 'Dash',
                  zIndex: 1,
                  // With a band the legend names the target; a label on the line would sit on the
                  // newest points at the right edge and be cut off on a narrow chart.
                  label: band ? undefined : { text: `Target ${target}`, align: 'left', x: 4, style: { color: COLOR.text, fontSize: '10px' } },
                },
              ]
            : [],
      },
      tooltip: {
        shared: true,
        useHTML: true,
        borderColor: COLOR.grid,
        formatter() {
          const x = this.x as number
          const head = Highcharts.dateFormat('%e %b %Y, %H:%M', x)
          const rows = (this.points ?? [])
            .filter((p) => p.series.options.id !== 'rca-events')
            .map((p) => {
              const v = p.y as number
              const zone = p.series.options.id === 'predicted' ? predictionZones?.get(x) : undefined
              return (
                `<div style="display:flex;gap:12px;justify-content:space-between">` +
                `<span><span style="color:${p.color}">●</span> ${p.series.name}</span>` +
                `<strong>${v.toFixed(2)}%</strong></div>` +
                (band ? `<div style="color:${COLOR.text};text-align:right">${bandText(v)}</div>` : '') +
                (zone ? `<div style="text-align:right"><span style="color:${ZONE_STYLE[zone].fill}">■</span> ${zone}</div>` : '')
              )
            })
            .join('')
          const ev = eventByTime.get(x)
          const evRow = ev
            ? `<div style="margin-top:4px;border-top:1px solid ${COLOR.grid};padding-top:4px">` +
              `<span style="color:${ZONE_STYLE[ev.zone].fill}">◆</span> RCA event · <b>${ev.zone}</b> · predicted ${ev.c3s.toFixed(2)}%</div>`
            : ''
          const m = matchedByTime.get(x)
          const extra = m
            ? m.error != null
              ? `<div style="color:${COLOR.text}">Error ${m.error >= 0 ? '+' : ''}${m.error.toFixed(2)} pp</div>`
              : `<div style="color:${COLOR.text}">No prediction within tolerance</div>`
            : ''
          return `<div style="font-size:12px"><div style="font-weight:650;margin-bottom:4px">${head}</div>${rows}${extra}${evRow}</div>`
        },
      },
      plotOptions: {
        series: {
          animation: false,
          states: { inactive: { opacity: 1 } },
        },
      },
      series: [
        {
          type: 'line',
          id: 'predicted',
          name: PREDICTED_LABEL,
          color: COLOR.pred,
          lineWidth: 1.75,
          marker: { enabled: false, symbol: 'circle', states: { hover: { enabled: true, radius: 3 } } },
          // A null between distant samples breaks the line (see breakAtGaps).
          data: breakAtGaps(predicted, predMaxGap),
          zIndex: 1,
        },
        {
          type: 'line',
          name: ACTUAL_LABEL,
          color: COLOR.actual,
          lineWidth: 2,
          cursor: 'pointer',
          marker: { enabled: true, symbol: 'circle', radius: 3.5, lineColor: '#fff', lineWidth: 1.5 },
          data: breakAtGaps(actual, actualMaxGap),
          point: {
            events: {
              click() {
                onSelectRef.current(this.x)
              },
            },
          },
          zIndex: 2,
        },
        {
          type: 'scatter',
          id: 'rca-events',
          name: 'RCA events',
          cursor: 'pointer',
          data: events.map((e) => ({
            x: e.t,
            y: e.c3s,
            id: e.id,
            marker: { symbol: 'diamond', radius: 6, fillColor: ZONE_STYLE[e.zone].fill, lineColor: '#fff', lineWidth: 1.5 },
          })),
          point: {
            events: {
              click() {
                onSelectEventRef.current?.(String(this.options.id))
              },
            },
          },
          stickyTracking: false,
          zIndex: 4,
        },
      ],
    }
  }, [predicted, actual, matched, band, windowStart, windowEnd, target, events, predictionZones, ACTUAL_LABEL, PREDICTED_LABEL])

  // New data or a new range rebuilds the chart at full extent.
  useEffect(() => {
    setZoomed(false)
  }, [options])

  // Mark the selected event without rebuilding the chart, so zoom is kept.
  useEffect(() => {
    const chart = chartRef.current?.chart
    const axis = chart?.xAxis[0] as PlotLineAxis | undefined
    if (!axis) return
    axis.removePlotLine('selected')
    if (selectedTime != null) {
      axis.addPlotLine({
        id: 'selected',
        value: selectedTime,
        color: COLOR.ink,
        width: 1,
        dashStyle: 'ShortDash',
        zIndex: 3,
      })
    }
  }, [selectedTime, options])

  if (predicted.length === 0 && actual.length === 0) {
    return (
      <div className="state state--empty">
        <p className="state__msg">No C3S data in this window.</p>
        <p className="state__hint">
          Try a longer range, or choose a &ldquo;Last &hellip;&rdquo; range, which ends at the
          newest data.
        </p>
      </div>
    )
  }

  return (
    <div className="timeline">
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        options={options}
        containerProps={{ className: 'timeline__chart' }}
      />

      {zoomed ? (
        <div className="timeline__tools">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => chartRef.current?.chart.zoomOut()}
          >
            Reset zoom
          </button>
        </div>
      ) : null}

      <ul className="legend">
        <li><span className="dot dot--actual" /> {ACTUAL_LABEL}</li>
        <li><span className="dot dot--pred" /> {PREDICTED_LABEL}</li>
        {events.length > 0 ? <li><span className="legend__diamond" /> RCA event (zone colour)</li> : null}
        {band ? (
          <li>
            <span className="swatch swatch--band" /> Target band {band.low}–{band.high}%
            {target != null ? `, target ${target}` : ''} · from RCA insight
          </li>
        ) : (
          <li className="legend__muted">No acceptable range supplied by the insight</li>
        )}
      </ul>
    </div>
  )
}
