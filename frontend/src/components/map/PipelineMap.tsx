import L, { type LatLngTuple } from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Pane, Polyline, TileLayer, useMap } from 'react-leaflet'
import { useDashboardStore } from '../../store/dashboardStore'
import FlowPipeline from './FlowPipeline'
import ValveNode from './ValveNode'

type DiameterBand = 'xl' | 'lg' | 'md' | 'sm' | 'unknown'

// Valves to highlight with green color and zoom to
const HIGHLIGHTED_VALVES = ['27492', '27521']
// Midpoint between valves 27492 and 27521
const HIGHLIGHTED_CENTER: LatLngTuple = [12.9165618, 77.4980033]

function parseDiameterMm(props?: Record<string, unknown>) {
  if (!props) return undefined
  const v = props.diameterMm ?? props.diameter ?? props.Diameter ?? props.DIA ?? props.dia
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  if (typeof v === 'string') {
    const m = v.match(/(\d{2,4})\s*(?:mm)?/i)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  const name = props.name
  if (typeof name === 'string') {
    const m = name.match(/(\d{2,4})\s*(?:mm)?/i)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  return undefined
}

function diameterBand(mm?: number): DiameterBand {
  if (!mm) return 'unknown'
  if (mm >= 300) return 'xl'
  if (mm >= 200) return 'lg'
  if (mm >= 100) return 'md'
  return 'sm'
}

function diameterBandColor(band: DiameterBand) {
  switch (band) {
    case 'xl':
      return '#004DB3'
    case 'lg':
      return '#0055ff'
    case 'md':
      return '#4a9ff5'
    case 'sm':
      return '#9ac7ff'
    case 'unknown':
    default:
      return '#4a9ff5'
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
  const selectedValveId = useDashboardStore((s) => s.selectedValveId)
  const selectedPipelineId = useDashboardStore((s) => s.selectedPipelineId)
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
    // Check if highlighted valves exist in the data
    const hasHighlighted = valves.some(v => HIGHLIGHTED_VALVES.includes(v.id))
    if (hasHighlighted) return HIGHLIGHTED_CENTER
    const bengaluru: LatLngTuple = [12.9716, 77.5946]
    return zones[0]?.centroid ?? valves[0]?.position ?? pipelines[0]?.path?.[0] ?? bengaluru
  }, [pipelines, valves, zones])

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

    const groups: Record<DiameterBand, LatLngTuple[][]> = {
      xl: [],
      lg: [],
      md: [],
      sm: [],
      unknown: [],
    }

    for (const p of pipelines) {
      if (p.path.length < 2) continue
      const mm = parseDiameterMm(p.properties)
      groups[diameterBand(mm)].push(p.path)
    }

    return groups
  }, [perf.hugePipelines, pipelines])

  useEffect(() => {
    // Intentionally empty.
  }, [])

  return (
    <div className="relative h-full w-full">
      <MapContainer center={initialCenter} zoom={17} zoomControl preferCanvas>
        <Pane name="basemap" style={{ zIndex: 100 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </Pane>

        <FitToNetworkOnce
          points={fitPoints}
          enabled={mapDataStatus === 'ready' || mapDataStatus === 'demo'}
        />

        <Pane name="pipelines" style={{ zIndex: 350 }}>
          {perf.hugePipelines && batchedPipelines ? (
            (['xl', 'lg', 'md', 'sm', 'unknown'] as DiameterBand[]).map((band) => {
              const paths = batchedPipelines[band]
              if (!paths || paths.length === 0) return null

              // Casing underlay to improve contrast on basemap.
              const casingWeight = 4
              const lineWeight = 2

              return (
                <>
                  <Polyline
                    key={`batch-casing-${band}`}
                    positions={paths}
                    pathOptions={{
                      color: '#080d14',
                      weight: casingWeight,
                      opacity: 0.55,
                    }}
                    interactive={false}
                  />
                  <Polyline
                    key={`batch-${band}`}
                    positions={paths}
                    pathOptions={{
                      color: diameterBandColor(band),
                      weight: lineWeight,
                      opacity: 0.9,
                    }}
                    interactive={false}
                  />
                </>
              )
            })
          ) : (
            pipelines.map((p) => {
              const mm = parseDiameterMm(p.properties)
              const color = diameterBandColor(diameterBand(mm))
              const label = `${p.id} / ${p.zoneId}`
              const isSelected = selectedPipelineId === p.id
              const isHovered = hoveredPipelineId === p.id
              const emphasize = isSelected || isHovered

              const casingWeight = emphasize ? 8 : 6
              const lineWeight = emphasize ? 4 : 3

              if (pipelineRendering.simple) {
                return (
                  <>
                    <Polyline
                      key={`${p.id}-casing`}
                      positions={p.path}
                      pathOptions={{
                        color: '#080d14',
                        weight: casingWeight,
                        opacity: 0.55,
                      }}
                      interactive={false}
                    />
                    <Polyline
                      key={p.id}
                      positions={p.path}
                      pathOptions={{
                        color,
                        weight: lineWeight,
                        opacity: 0.92,
                      }}
                      eventHandlers={{
                        mouseover: () => setHoveredPipelineId(p.id),
                        mouseout: () => setHoveredPipelineId(null),
                        click: () => onPipelineSelect?.(p.id),
                      }}
                    />
                  </>
                )
              }

              return (
                <>
                  <Polyline
                    key={`${p.id}-casing`}
                    positions={p.path}
                    pathOptions={{
                      color: '#080d14',
                      weight: casingWeight,
                      opacity: 0.55,
                    }}
                    interactive={false}
                  />
                  <FlowPipeline
                    key={p.id}
                    id={p.id}
                    positions={p.path}
                    color={color}
                    label={label}
                    hovered={emphasize}
                    onHover={setHoveredPipelineId}
                    onSelect={() => onPipelineSelect?.(p.id)}
                    animated={pipelineRendering.animated}
                    interactive
                  />
                </>
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
                selected={selectedValveId === v.id}
                highlighted={HIGHLIGHTED_VALVES.includes(v.id)}
              />
            )
          })}
        </Pane>
      </MapContainer>
    </div>
  )
}
