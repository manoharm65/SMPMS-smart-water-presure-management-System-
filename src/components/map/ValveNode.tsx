import type { LatLngTuple } from 'leaflet'
import { CircleMarker, Tooltip } from 'react-leaflet'

export type ValveNodeProps = {
  id: string
  position: LatLngTuple
  label: string
  severity: 'normal' | 'warning' | 'critical' | 'low'
  onSelect: (valveId: string) => void
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
}: ValveNodeProps) {
  const color = severityColor(severity)

  return (
    <CircleMarker
      center={position}
      radius={6}
      pathOptions={{
        color,
        weight: 2,
        fillColor: '#080d14',
        fillOpacity: 0.9,
      }}
      eventHandlers={{
        click: () => onSelect(id),
      }}
    >
      <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
        <div className="font-mono text-xs">{label}</div>
      </Tooltip>
    </CircleMarker>
  )
}
