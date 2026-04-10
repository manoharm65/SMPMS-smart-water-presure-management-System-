import type { LatLngTuple } from 'leaflet'
import { Polygon, Tooltip } from 'react-leaflet'

export default function ZonePolygon({
  id,
  name,
  points,
  onSelect,
  selected = false,
  dimmed = false,
  fillColor = '#00C896',
  borderColor = '#ffffff',
  fillOpacity = 0.4,
}: {
  id: string
  name: string
  points: LatLngTuple[]
  onSelect?: (zoneId: string) => void
  selected?: boolean
  dimmed?: boolean
  fillColor?: string
  borderColor?: string
  fillOpacity?: number
}) {
  const baseFillOpacity = dimmed ? 0.1 : fillOpacity
  const strokeOpacity = dimmed ? 0.22 : selected ? 0.85 : 0.45

  return (
    <Polygon
      positions={points}
      pathOptions={{
        color: borderColor,
        weight: selected ? 2 : 1,
        opacity: strokeOpacity,
        fillColor,
        fillOpacity: baseFillOpacity,
      }}
      eventHandlers={{
        click: () => onSelect?.(id),
        mouseover: (e) => {
          ;(e.target as any)?.setStyle?.({
            fillOpacity: Math.min(0.72, baseFillOpacity + 0.14),
            opacity: Math.min(1, strokeOpacity + 0.2),
          })
        },
        mouseout: (e) => {
          ;(e.target as any)?.setStyle?.({
            fillOpacity: baseFillOpacity,
            opacity: strokeOpacity,
          })
        },
      }}
    >
      <Tooltip opacity={0.9}>
        <div className="text-xs">
          <div className="font-mono">{id}</div>
          <div className="text-text-muted">{name}</div>
          <div className="mt-1 text-text-faint">Click: open details</div>
        </div>
      </Tooltip>
    </Polygon>
  )
}
