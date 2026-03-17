import L, { type LatLngTuple } from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Pane, Polyline, useMap } from 'react-leaflet'
import { useDashboardStore, type PressureStatus } from '../../store/dashboardStore'
import FlowPipeline from './FlowPipeline'
import ValveNode from './ValveNode'

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

function FitToNetworkOnce({
  points,
  enabled,
}: {
  points: LatLngTuple[]
  enabled: boolean
}) {
  const map = useMap()
  const [didFit, setDidFit] = useState(false)

  useEffect(() => {
    if (!enabled) return
    if (didFit) return
    if (points.length < 2) return

    const bounds = L.latLngBounds(points)
    if (!bounds.isValid()) return

    map.fitBounds(bounds, {
      padding: [24, 24],
      maxZoom: 16,
      animate: false,
    })
    setDidFit(true)
  }, [didFit, enabled, map, points])

  return null
}

export default function PipelineMap({
  onValveSelect,
  onPipelineSelect,
}: {
  onValveSelect: (valveId: string) => void
  onPipelineSelect?: (pipelineId: string) => void
}) {
  const pipelines = useDashboardStore((s) => s.pipelines)
  const valves = useDashboardStore((s) => s.valves)
  const zones = useDashboardStore((s) => s.zonesGeo)
  const telemetryByZone = useDashboardStore((s) => s.zones)
  const mapDataStatus = useDashboardStore((s) => s.mapDataStatus)
  const [hoveredPipelineId, setHoveredPipelineId] = useState<string | null>(null)

  const perf = useMemo(() => {
    return {
      hugePipelines: pipelines.length > 10_000,
      hugeValves: valves.length > 10_000,
      // Keep fit bounds work bounded even for very dense datasets.
      maxFitValvePoints: 5_000,
    }
  }, [pipelines.length, valves.length])

  const pipelineRendering = useMemo(() => {
    const count = pipelines.length
    return {
      simple: count > 1500,
      animated: count <= 400,
    }
  }, [pipelines.length])

  const initialCenter = useMemo<LatLngTuple>(() => {
    const solapur: LatLngTuple = [17.6599, 75.9064]
    return zones[0]?.centroid ?? solapur
  }, [zones])

  const fitPoints = useMemo<LatLngTuple[]>(() => {
    const pts: LatLngTuple[] = []

    // Always include valve/asset points (cheap + reliable).
    if (valves.length <= perf.maxFitValvePoints) {
      for (const v of valves) pts.push(v.position)
    } else {
      const step = Math.ceil(valves.length / perf.maxFitValvePoints)
      for (let i = 0; i < valves.length; i += step) {
        pts.push(valves[i]!.position)
      }
    }

    // Sample each pipeline lightly for performance.
    for (const p of pipelines) {
      const path = p.path
      if (path.length === 0) continue
      pts.push(path[0])
      if (path.length > 2) pts.push(path[Math.floor(path.length / 2)])
      pts.push(path[path.length - 1])
    }

    return pts
  }, [pipelines, valves, perf.maxFitValvePoints])

  const batchedPipelines = useMemo(() => {
    if (!perf.hugePipelines) return null

    const groups: Record<PressureStatus, LatLngTuple[][]> = {
      normal: [],
      low: [],
      warning: [],
      critical: [],
    }

    for (const p of pipelines) {
      const t = telemetryByZone[p.zoneId]
      const status: PressureStatus = t?.status ?? 'normal'
      if (p.path.length < 2) continue
      groups[status].push(p.path)
    }

    return groups
  }, [perf.hugePipelines, pipelines, telemetryByZone])

  useEffect(() => {
    // Intentionally empty.
  }, [])

  return (
    <div className="relative h-full w-full">
      <MapContainer center={initialCenter} zoom={13} zoomControl preferCanvas>
        {/* No basemap/background tiles: show only pipelines + assets */}

        <FitToNetworkOnce
          points={fitPoints}
          enabled={mapDataStatus === 'ready' || mapDataStatus === 'demo'}
        />

        <Pane name="pipelines" style={{ zIndex: 350 }}>
          {perf.hugePipelines && batchedPipelines ? (
            (['critical', 'warning', 'low', 'normal'] as PressureStatus[]).map((status) => {
              const paths = batchedPipelines[status]
              if (!paths || paths.length === 0) return null

              return (
                <Polyline
                  key={`batch-${status}`}
                  positions={paths}
                  pathOptions={{
                    color: pressureStatusColor(status),
                    weight: 2,
                    opacity: 0.85,
                  }}
                  interactive={false}
                />
              )
            })
          ) : (
            pipelines.map((p) => {
              const t = telemetryByZone[p.zoneId]
              const color = pressureStatusColor(t?.status ?? 'normal')
              const label = `${p.id} / ${p.zoneId}`

              if (pipelineRendering.simple) {
                return (
                  <Polyline
                    key={p.id}
                    positions={p.path}
                    pathOptions={{
                      color,
                      weight: hoveredPipelineId === p.id ? 4 : 2,
                      opacity: 0.9,
                    }}
                    eventHandlers={{
                      mouseover: () => setHoveredPipelineId(p.id),
                      mouseout: () => setHoveredPipelineId(null),
                      click: () => onPipelineSelect?.(p.id),
                    }}
                  />
                )
              }

              return (
                <FlowPipeline
                  key={p.id}
                  id={p.id}
                  positions={p.path}
                  color={color}
                  label={label}
                  hovered={hoveredPipelineId === p.id}
                  onHover={setHoveredPipelineId}
                  onSelect={() => onPipelineSelect?.(p.id)}
                  animated={pipelineRendering.animated}
                  interactive
                />
              )
            })
          )}
        </Pane>

        <Pane name="valves" style={{ zIndex: 450 }}>
          {valves.map((v) => {
            const t = telemetryByZone[v.zoneId]
            return (
              <ValveNode
                key={v.id}
                id={v.id}
                position={v.position}
                label={v.name}
                severity={t?.status ?? 'normal'}
                onSelect={onValveSelect}
                zoneId={v.zoneId}
                properties={v.properties}
                radius={perf.hugeValves ? 3 : 6}
                showTooltip={!perf.hugeValves}
                interactive={!perf.hugeValves}
              />
            )
          })}
        </Pane>
      </MapContainer>
    </div>
  )
}
