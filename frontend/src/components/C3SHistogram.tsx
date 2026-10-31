/**
 * C3S distribution histogram, drawn with Highcharts.
 *
 * Shows one dataset at a time (the caller passes either the actual or the predicted bins);
 * each bar is labelled with its sample count and share of all samples in that dataset.
 */

import { useMemo } from 'react'
import Highcharts from 'highcharts'
import { HighchartsReact } from 'highcharts-react-official'
import { binLabel } from '../lib/histogram'
import type { Histogram } from '../lib/histogram'

const COLOR = { text: '#7b8799', grid: '#dfe5ee', ink: '#0f1b2d' }

export function C3SHistogram({
  histogram,
  seriesName,
  color,
}: {
  histogram: Histogram
  /** "Actual C3S (Lab)" or "Predicted C3S" — the same names the trend uses. */
  seriesName: string
  color: string
}) {
  const options = useMemo<Highcharts.Options>(() => {
    const { bins, total } = histogram
    return {
      chart: {
        type: 'column',
        height: 280,
        spacing: [16, 8, 8, 4],
        style: { fontFamily: 'inherit' },
        backgroundColor: 'transparent',
      },
      title: { text: undefined },
      credits: { enabled: true },
      legend: { enabled: false },
      accessibility: {
        description: `Distribution of ${seriesName} values in percent, ${total} samples.`,
      },
      xAxis: {
        categories: bins.map(binLabel),
        title: { text: 'C3S (%)', style: { color: COLOR.text, fontSize: '11px' } },
        lineColor: COLOR.grid,
        tickColor: COLOR.grid,
        labels: { style: { color: COLOR.text, fontSize: '10px' } },
      },
      yAxis: {
        title: { text: 'Samples', style: { color: COLOR.text, fontSize: '11px' } },
        allowDecimals: false,
        min: 0,
        gridLineColor: COLOR.grid,
        labels: { style: { color: COLOR.text, fontSize: '10px' } },
      },
      tooltip: {
        useHTML: true,
        borderColor: COLOR.grid,
        formatter() {
          const bin = bins[(this as unknown as { point: { index: number } }).point.index]
          return (
            `<div style="font-size:12px"><div style="font-weight:650;margin-bottom:4px">${binLabel(bin)} %</div>` +
            `<div>${seriesName}</div>` +
            `<div><strong>${bin.count}</strong> sample${bin.count === 1 ? '' : 's'} · <strong>${bin.pct.toFixed(1)}%</strong> of ${total}</div></div>`
          )
        },
      },
      plotOptions: {
        column: {
          animation: false,
          borderWidth: 0,
          borderRadius: 2,
          pointPadding: 0.04,
          groupPadding: 0.02,
          color,
          dataLabels: {
            enabled: true,
            // Empty bins stay unlabelled rather than printing a column of zeros.
            formatter() {
              const y = this.y as number
              if (!y) return ''
              const bin = bins[(this as unknown as { point: { index: number } }).point.index]
              return `${y}<br/>${bin.pct.toFixed(1)}%`
            },
            style: { color: COLOR.ink, fontSize: '10px', fontWeight: '600', textOutline: 'none' },
          },
        },
      },
      series: [{ type: 'column', name: seriesName, data: bins.map((b) => b.count) }],
    }
  }, [histogram, seriesName, color])

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ className: 'histogram__chart' }}
    />
  )
}
