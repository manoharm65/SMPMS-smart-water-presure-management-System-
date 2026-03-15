import type { LatLngTuple } from 'leaflet'
import { Polygon, Tooltip } from 'react-leaflet'

export default function ZonePolygon({
  id,
  name,
  points,
  onSelect,
}: {
  id: string
  name: string
  points: LatLngTuple[]
  onSelect?: (zoneId: string) => void
}) {
  return (
    <Polygon
      positions={points}
      pathOptions={{
        color: 'rgba(255,255,255,0.18)',
        weight: 1,
        fillColor: 'rgba(0,200,150,0.06)',
        fillOpacity: 0.4,
      }}
      eventHandlers={{
        click: () => onSelect?.(id),
        mouseover: (e) => {
          ;(e.target as any)?.setStyle?.({
            fillOpacity: 0.55,
            color: 'rgba(255,255,255,0.28)',
          })
        },
        mouseout: (e) => {
          ;(e.target as any)?.setStyle?.({
            fillOpacity: 0.4,
            color: 'rgba(255,255,255,0.18)',
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
