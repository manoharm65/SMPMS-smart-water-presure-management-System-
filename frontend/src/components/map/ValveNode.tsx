import type { LatLngTuple } from 'leaflet'
import { CircleMarker, Tooltip } from 'react-leaflet'

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

function severityColor(sev: ValveNodeProps['severity']) {
  switch (sev) {
    case 'critical':
      return '#f04d4d'
    case 'warning':
      return '#f5a623'
    case 'low':
      return '#4a9ff5'
    case 'normal':
    default:
      return '#00c896'
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
}: ValveNodeProps) {
  const color = severityColor(severity)
  const pairs = pickTooltipPairs(properties)

  return (
    <CircleMarker
      center={position}
      radius={radius}
      interactive={interactive}
      pathOptions={{
        color,
        weight: 2,
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
    </CircleMarker>
  )
}
