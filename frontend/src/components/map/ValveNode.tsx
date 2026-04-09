import type { LatLngTuple } from 'leaflet'
import { CircleMarker, Popup, Tooltip } from 'react-leaflet'

export type ValveNodeProps = {
  id: string
  position: LatLngTuple
  label: string
  severity: 'normal' | 'warning' | 'critical' | 'low'
  onSelect: (valveId: string) => void
  zoneId?: string
  properties?: Record<string, unknown>
  radius?: number
  showTooltip?: boolean
  interactive?: boolean
  selected?: boolean
  highlighted?: boolean
}

function formatValue(v: unknown) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function pickTooltipPairs(properties?: Record<string, unknown>) {
  if (!properties) return [] as Array<[string, string]>
  const pairs = Object.entries(properties)
    .map(([k, v]) => [k, formatValue(v)] as [string, string])
    .filter(([, v]) => v.trim().length > 0)
  return pairs.slice(0, 4)
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const m = v.match(/-?\d+(?:\.\d+)?/)
    if (!m) return null
    const n = Number(m[0])
    return Number.isFinite(n) ? n : null
  }
  return null
}

function findNumericByKey(
  properties: Record<string, unknown> | undefined,
  keyPattern: RegExp,
): number | null {
  if (!properties) return null
  for (const [k, v] of Object.entries(properties)) {
    if (!keyPattern.test(k)) continue
    const n = asNumber(v)
    if (n != null) return n
  }
  return null
}

function findFirstNumeric(
  properties: Record<string, unknown> | undefined,
): { key: string; value: number } | null {
  if (!properties) return null
  for (const [k, v] of Object.entries(properties)) {
    const n = asNumber(v)
    if (n == null) continue
    if (/lat|lng|long|x\b|y\b/i.test(k)) continue
    return { key: k, value: n }
  }
  return null
}

function severityColor(sev: ValveNodeProps['severity']) {
  switch (sev) {
    case 'critical':
      return '#6d28d9'
    case 'warning':
      return '#7c3aed'
    case 'low':
      return '#a855f7'
    case 'normal':
    default:
      return '#8b5cf6'
  }
}

export default function ValveNode({
  id,
  position,
  label,
  severity,
  onSelect,
  zoneId,
  properties,
  radius = 6,
  showTooltip = true,
  interactive = true,
  selected = false,
  highlighted = false,
}: ValveNodeProps) {
  const color = highlighted ? '#22c55e' : severityColor(severity)
  const pairs = pickTooltipPairs(properties)
  const r = highlighted ? 8 : (selected ? Math.max(radius + 3, radius * 1.4) : radius)
  const capacity = findNumericByKey(properties, /capacity|staging/i)
  const diameter = findNumericByKey(properties, /diameter|dia\b/i)
  const firstNumeric = findFirstNumeric(properties)
  const sourceType =
    (typeof properties?.sourceLayer === 'string' && properties.sourceLayer) ||
    (typeof properties?.['Type of St'] === 'string' && properties['Type of St']) ||
    undefined
  const [lat, lng] = position

  return (
    <CircleMarker
      center={position}
      radius={r}
      interactive={interactive}
      pathOptions={{
        color,
        weight: selected ? 3 : 2,
        fillColor: '#080d14',
        fillOpacity: 0.9,
      }}
      eventHandlers={
        interactive
          ? {
              click: () => onSelect(id),
            }
          : undefined
      }
    >
      {showTooltip ? (
        <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
          <div className="text-xs">
            <div className="font-mono">{label}</div>
            {zoneId ? <div className="text-text-muted">{zoneId}</div> : null}
            {pairs.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {pairs.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2">
                    <div className="max-w-[140px] truncate text-text-faint">{k}</div>
                    <div className="max-w-[160px] truncate font-mono text-text">{v}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Tooltip>
      ) : null}

      <Popup>
        <div className="min-w-[220px] text-xs">
          <div className="font-mono text-sm">{label}</div>
          {zoneId ? <div className="mt-0.5 text-text-muted">Zone: {zoneId}</div> : null}
          {sourceType ? <div className="mt-0.5 text-text-muted">Type: {sourceType}</div> : null}

          <div className="mt-2 space-y-1">
            {capacity != null ? (
              <div className="flex items-center justify-between gap-2">
                <div className="text-text-faint">Capacity</div>
                <div className="font-mono text-text">{capacity}</div>
              </div>
            ) : null}

            {diameter != null ? (
              <div className="flex items-center justify-between gap-2">
                <div className="text-text-faint">Diameter</div>
                <div className="font-mono text-text">{diameter}</div>
              </div>
            ) : null}

            {capacity == null && diameter == null && firstNumeric ? (
              <div className="flex items-center justify-between gap-2">
                <div className="max-w-[120px] truncate text-text-faint">{firstNumeric.key}</div>
                <div className="font-mono text-text">{firstNumeric.value}</div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <div className="text-text-faint">Latitude</div>
              <div className="font-mono text-text">{lat.toFixed(6)}</div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-text-faint">Longitude</div>
              <div className="font-mono text-text">{lng.toFixed(6)}</div>
            </div>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )
}
