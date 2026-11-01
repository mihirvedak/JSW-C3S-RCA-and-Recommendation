/**
 * Plant, line and time range: the scope every view reads, in one bar above the view's content.
 *
 * Plants and lines come from `config/plants.ts`. Picking a plant offers its lines; picking a
 * line rescopes every load on the page (its devices and RCA insight). A selector with a single
 * option stays enabled so it reads as a choice that exists, not a broken control.
 */

import type { ReactNode } from 'react'
import { TimeRangePicker } from './TimeRangePicker'
import type { TimeSelection } from '../hooks/useDashboardData'
import { PLANTS, resolveLine } from '../config/plants'
import type { LineSelection } from '../config/plants'

export function ScopeBar({
  line,
  onLineChange,
  selection,
  onSelectionChange,
  windowStart,
  windowEnd,
  anchorMs,
  trailing,
}: {
  line: LineSelection
  onLineChange: (sel: LineSelection) => void
  selection: TimeSelection
  onSelectionChange: (s: TimeSelection) => void
  windowStart: number | null
  windowEnd: number | null
  anchorMs: number | null
  /** A control shown at the end of the bar (the Data sources toggle). */
  trailing?: ReactNode
}) {
  const { plant, line: current } = resolveLine(line)
  return (
    <div className="scopebar" role="group" aria-label="Plant, line and time range">
      <label className="field">
        <span className="field__label">Plant</span>
        <select
          className="field__input"
          value={plant.id}
          onChange={(e) => {
            const next = PLANTS.find((p) => p.id === e.target.value) ?? PLANTS[0]
            onLineChange({ plantId: next.id, lineId: next.lines[0].id })
          }}
        >
          {PLANTS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Line</span>
        <select
          className="field__input"
          value={current.id}
          onChange={(e) => onLineChange({ plantId: plant.id, lineId: e.target.value })}
          title={`${current.devices.map((d) => d.devID).join(' · ')} · ${current.insightId}`}
        >
          {plant.lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>

      <TimeRangePicker
        selection={selection}
        onChange={onSelectionChange}
        windowStart={windowStart}
        windowEnd={windowEnd}
        anchorMs={anchorMs}
      />
      {trailing ? <div className="scopebar__trailing">{trailing}</div> : null}
    </div>
  )
}
