import L, { type LatLngTuple } from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  TileLayer,
} from 'react-leaflet'
import { useDashboardStore, type PressureStatus } from '../../store/dashboardStore'
import FlowPipeline from './FlowPipeline'
import MapControls, { type MapLayers } from './MapControls'
import ValveNode from './ValveNode'
import ZonePolygon from './ZonePolygon'

function pressureStatusColor(status: PressureStatus) {
  switch (status) {
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

const leakIcon = L.divIcon({
  className: '',
  html: '<div class="leak-indicator"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

export default function PipelineMap({
  layers,
  onLayersChange,
  onValveSelect,
  onZoneSelect,
}: {
  layers: MapLayers
  onLayersChange: (next: MapLayers) => void
  onValveSelect: (valveId: string) => void
  onZoneSelect?: (zoneId: string) => void
}) {
  const pipelines = useDashboardStore((s) => s.pipelines)
  const valves = useDashboardStore((s) => s.valves)
  const zones = useDashboardStore((s) => s.zonesGeo)
  const telemetryByZone = useDashboardStore((s) => s.zones)
  const [hoveredPipelineId, setHoveredPipelineId] = useState<string | null>(null)

  const initialCenter = useMemo<LatLngTuple>(() => {
    // Solapur (fallback) — map will still render even before municipal GIS data is loaded.
    const solapur: LatLngTuple = [17.6599, 75.9064]
    return zones[0]?.centroid ?? solapur
  }, [zones])

  useEffect(() => {
    // Fix default Leaflet icon asset resolution issues by avoiding default icons.
  }, [])

  const leakMarkers = useMemo(() => {
    const markers: { id: string; pos: LatLngTuple }[] = []
    for (const zoneId of Object.keys(telemetryByZone)) {
      const t = telemetryByZone[zoneId]
      if (t && t.anomalyScore >= 0.85) {
        const centroid = zones.find((z) => z.id === zoneId)?.centroid
        if (centroid) markers.push({ id: zoneId, pos: centroid })
      }
    }
    return markers
  }, [telemetryByZone, zones])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={initialCenter}
        zoom={13}
        zoomControl={false}
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapControls layers={layers} onChange={onLayersChange} />

        <Pane name="zones" style={{ zIndex: 300 }}>
          {layers.zones &&
            zones.map((z) => (
              <ZonePolygon
                key={z.id}
                id={z.id}
                name={z.name}
                points={z.points}
                onSelect={onZoneSelect}
              />
            ))}
        </Pane>

        <Pane name="pipelines" style={{ zIndex: 350 }}>
          {layers.pipelines &&
            pipelines.map((p) => {
              const t = telemetryByZone[p.zoneId]
              const color = pressureStatusColor(t?.status ?? 'normal')
              const label = `${p.id} / ${p.zoneId}`
              return (
                <FlowPipeline
                  key={p.id}
                  id={p.id}
                  positions={p.path}
                  color={color}
                  label={label}
                  hovered={hoveredPipelineId === p.id}
                  onHover={setHoveredPipelineId}
                />
              )
            })}
        </Pane>

        <Pane name="valves" style={{ zIndex: 450 }}>
          {layers.valves &&
            valves.map((v) => {
              const t = telemetryByZone[v.zoneId]
              return (
                <ValveNode
                  key={v.id}
                  id={v.id}
                  position={v.position}
                  label={v.name}
                  severity={t?.status ?? 'normal'}
                  onSelect={onValveSelect}
                />
              )
            })}
        </Pane>

        <Pane name="leaks" style={{ zIndex: 600 }}>
          {leakMarkers.map((m) => (
            <Marker key={m.id} position={m.pos} icon={leakIcon} interactive={false} />
          ))}
        </Pane>

        {/* Extra subtle zone centroids for orientation */}
        <Pane name="centroids" style={{ zIndex: 320 }}>
          {zones.map((z) => (
            <CircleMarker
              key={z.id}
              center={z.centroid}
              radius={2}
              pathOptions={{ color: 'rgba(255,255,255,0.22)', weight: 1 }}
            />
          ))}
        </Pane>
      </MapContainer>
    </div>
  )
}
