/** A classification badge in the central zone colours (`lib/zones.ts`). */

import { ZONE_STYLE } from '../lib/zones'
import type { ZoneKey } from '../lib/zones'

export function ZoneBadge({ zone, title }: { zone: ZoneKey; title?: string }) {
  const s = ZONE_STYLE[zone]
  return (
    <span
      className="badge zone-badge"
      data-zone={zone}
      style={{ background: s.soft, color: s.ink, borderColor: s.fill }}
      title={title ?? s.meaning}
    >
      <span className="zone-badge__dot" style={{ background: s.fill }} aria-hidden="true" />
      {zone}
    </span>
  )
}
