import L, { type LatLngTuple } from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Pane, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { triggerManualAlert } from '../../services/api'
import { useDashboardStore } from '../../store/dashboardStore'
import FlowPipeline from './FlowPipeline'
import MapControls from './MapControls'
import ValveNode from './ValveNode'

type DiameterBand = 'xl' | 'lg' | 'md' | 'sm' | 'unknown'
type DmaZoneLevel = 'High' | 'Medium-High' | 'Medium' | 'Low'

type DmaZone = {
  id: string
  lat: number
  lng: number
  radius: number
  elevation: number
  zone: DmaZoneLevel
  feedsInto: string[]
}

type GeneratedDma = {
  id: string
  name: string
  center: LatLngTuple
  radiusM: number
  elevation: number
  zone: DmaZoneLevel
  feedsInto: string[]
  points: LatLngTuple[]
}

const DMA_ZONES: DmaZone[] = [
  { id: 'DMA-01', lat: 18.475, lng: 73.82, radius: 1600, elevation: 520, zone: 'Low', feedsInto: ['DMA-04', 'DMA-05'] },
  { id: 'DMA-02', lat: 18.475, lng: 73.856, radius: 1600, elevation: 510, zone: 'Low', feedsInto: ['DMA-05', 'DMA-06'] },
  { id: 'DMA-03', lat: 18.475, lng: 73.892, radius: 1600, elevation: 505, zone: 'Low', feedsInto: ['DMA-06'] },
  { id: 'DMA-04', lat: 18.5, lng: 73.838, radius: 1600, elevation: 535, zone: 'Medium', feedsInto: ['DMA-07', 'DMA-08'] },
  { id: 'DMA-05', lat: 18.5, lng: 73.874, radius: 1600, elevation: 525, zone: 'Medium', feedsInto: ['DMA-08', 'DMA-09'] },
  { id: 'DMA-06', lat: 18.5, lng: 73.91, radius: 1600, elevation: 518, zone: 'Medium', feedsInto: ['DMA-09'] },
  { id: 'DMA-07', lat: 18.525, lng: 73.82, radius: 1600, elevation: 548, zone: 'Medium-High', feedsInto: ['DMA-10'] },
  { id: 'DMA-08', lat: 18.525, lng: 73.856, radius: 1600, elevation: 542, zone: 'Medium-High', feedsInto: ['DMA-10', 'DMA-11'] },
  { id: 'DMA-09', lat: 18.525, lng: 73.892, radius: 1600, elevation: 530, zone: 'Medium', feedsInto: ['DMA-11', 'DMA-12'] },
  { id: 'DMA-10', lat: 18.55, lng: 73.838, radius: 1600, elevation: 565, zone: 'High', feedsInto: ['DMA-07', 'DMA-11'] },
  { id: 'DMA-11', lat: 18.55, lng: 73.874, radius: 1600, elevation: 558, zone: 'High', feedsInto: ['DMA-08', 'DMA-12'] },
  { id: 'DMA-12', lat: 18.55, lng: 73.91, radius: 1600, elevation: 545, zone: 'Medium-High', feedsInto: ['DMA-09'] },
]

const DMA_BASE_CENTER: LatLngTuple = [18.52, 73.856]

const DEFAULT_CENTER: LatLngTuple = [12.9716, 77.5946]

function getDMAColor(zone: DmaZoneLevel) {
  switch (zone) {
    case 'High':
      return { color: '#FF0000', fillColor: '#FF4444' }
    case 'Medium-High':
      return { color: '#FF6600', fillColor: '#FF8833' }
    case 'Medium':
      return { color: '#FFD700', fillColor: '#FFE566' }
    case 'Low':
      return { color: '#00CC44', fillColor: '#33DD66' }
    default:
      return { color: '#FF6600', fillColor: '#FF8833' }
  }
}

function getFlowDirection(zone: DmaZoneLevel) {
  switch (zone) {
    case 'High':
      return 'Downhill ↓ (Source Zone)'
    case 'Medium-High':
      return 'Receives & Distributes ↕'
    case 'Medium':
      return 'Receives & Distributes ↕'
    case 'Low':
      return 'Terminal Zone ✓ (End Point)'
    default:
      return 'Receives & Distributes ↕'
  }
}

function getZoneEmoji(zone: DmaZoneLevel) {
  switch (zone) {
    case 'High':
      return '🔴'
    case 'Medium-High':
      return '🟠'
    case 'Medium':
      return '🟡'
    case 'Low':
      return '🟢'
    default:
      return '🟠'
  }
}

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
    default:
      return '#4a9ff5'
  }
}

function FitToPreferredCenterOnce({
  center,
  zoom,
  enabled,
}: {
  center: LatLngTuple
  zoom: number
  enabled: boolean
}) {
  const map = useMap()
  const [didFit, setDidFit] = useState(false)

  useEffect(() => {
    if (!enabled || didFit) return
    map.setView(center, zoom, { animate: false })
    setDidFit(true)
  }, [center, didFit, enabled, map, zoom])

  return null
}

function FitToSelectedDma({ selectedDmaId, dmas }: { selectedDmaId: string | null; dmas: GeneratedDma[] }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedDmaId) return
    const dma = dmas.find((z) => z.id === selectedDmaId)
    if (!dma || dma.points.length === 0) return
    const bounds = L.latLngBounds(dma.points)
    if (!bounds.isValid()) return
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16, animate: true })
  }, [dmas, map, selectedDmaId])

  return null
}

function DmaLayerGroup({
  enabled,
  dmas,
  selectedDmaId,
  onSelect,
  onPipelineSelect,
}: {
  enabled: boolean
  dmas: GeneratedDma[]
  selectedDmaId: string | null
  onSelect: (dmaId: string) => void
  onPipelineSelect?: (pipelineId: string) => void
}) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) return

    const dmaLayer = L.layerGroup()
    dmaLayer.addTo(map)

    dmas.forEach((dma) => {
      const radiusM = dma.radiusM
      const colors = getDMAColor(dma.zone)

      const dmaCircle = L.circle(dma.center, {
        radius: radiusM,
        color: colors.color,
        weight: 2.5,
        opacity: 0.85,
        fillColor: colors.fillColor,
        fillOpacity: 0.15,
        interactive: true,
      })

      const onClick = () => {
        onSelect(dma.id)
        onPipelineSelect?.(dma.id)
      }

      dmaCircle.on('click', onClick)

      dmaCircle.bindTooltip(
        `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #0f172a; font-weight: 700;">${dma.id}</div>`,
        {
          permanent: true,
          direction: 'center',
          opacity: 0.95,
        },
      )

      dmaCircle.addTo(dmaLayer)
    })

    return () => {
      dmaLayer.remove()
    }
  }, [dmas, enabled, map, onPipelineSelect, onSelect, selectedDmaId])

  return null
}

function DmaLegendControl({ enabled }: { enabled: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) return

    const legend = new L.Control({ position: 'bottomleft' })

    legend.onAdd = () => {
      const div = L.DomUtil.create('div')
      div.style.background = '#ffffff'
      div.style.padding = '10px'
      div.style.borderRadius = '8px'
      div.style.fontSize = '13px'
      div.style.lineHeight = '1.35'
      div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
      div.innerHTML =
        '<div style="font-weight:700; margin-bottom:6px;">📍 DMA ELEVATION ZONES</div>' +
        '<div>🔴 High (550m+)</div>' +
        '<div>🟠 Medium-High (530-549m)</div>' +
        '<div>🟡 Medium (515-529m)</div>' +
        '<div>🟢 Low (&lt;515m)</div>' +
        '<div style="margin-top:6px;"><span style="display:inline-block; width:26px; border-bottom:3px solid #0055ff; transform: translateY(-2px);"></span> Pipeline Network</div>'
      return div
    }

    legend.addTo(map)

    return () => {
      legend.remove()
    }
  }, [enabled, map])

  return null
}

function pointInPolygon(point: LatLngTuple, polygon: LatLngTuple[]) {
  let inside = false
  const x = point[1]
  const y = point[0]

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]![1]
    const yi = polygon[i]![0]
    const xj = polygon[j]![1]
    const yj = polygon[j]![0]

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }

  return inside
}

function HardwarePointCapture({
  enabled,
  onPick,
}: {
  enabled: boolean
  onPick: (point: LatLngTuple) => void
}) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return
      onPick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

function severityColor(status: 'normal' | 'low' | 'warning' | 'critical' | 'unknown') {
  switch (status) {
    case 'critical':
      return '#DC2626'
    case 'warning':
      return '#F59E0B'
    case 'low':
      return '#FACC15'
    case 'normal':
      return '#16A34A'
    default:
      return '#64748B'
  }
}

function formatLatLng(point: LatLngTuple) {
  return `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`
}

function degreesPerMeterLat() {
  return 1 / 111320
}

function degreesPerMeterLng(lat: number) {
  const c = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  return 1 / (111320 * c)
}

function metersBetween(a: LatLngTuple, b: LatLngTuple) {
  const midLat = (a[0] + b[0]) / 2
  const dLat = (a[0] - b[0]) / degreesPerMeterLat()
  const dLng = (a[1] - b[1]) / degreesPerMeterLng(midLat)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

function seededUnitNoise(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function organicCirclePoints(center: LatLngTuple, radiusM: number, seed: number, segments = 20): LatLngTuple[] {
  const [lat, lng] = center
  const latScale = degreesPerMeterLat()
  const lngScale = degreesPerMeterLng(lat)
  const pts: LatLngTuple[] = []

  for (let i = 0; i < segments; i += 1) {
    const baseTheta = (i / segments) * Math.PI * 2
    const thetaJitter = (seededUnitNoise(seed * 100 + i) - 0.5) * 0.18
    const theta = baseTheta + thetaJitter
    const jitterMagM = 50 + seededUnitNoise(seed * 1000 + i * 13) * 50
    const jitterSign = seededUnitNoise(seed * 2000 + i * 19) > 0.5 ? 1 : -1
    const r = radiusM + jitterSign * jitterMagM

    const x = Math.cos(theta) * r
    const y = Math.sin(theta) * r
    pts.push([lat + y * latScale, lng + x * lngScale])
  }

  pts.push(pts[0]!)
  return pts
}

function generatePresetOrganicDmas(anchorCenter?: LatLngTuple): GeneratedDma[] {
  const latOffset = anchorCenter ? anchorCenter[0] - DMA_BASE_CENTER[0] : 0
  const lngOffset = anchorCenter ? anchorCenter[1] - DMA_BASE_CENTER[1] : 0

  return DMA_ZONES.map((zone, idx) => {
    const center: LatLngTuple = [zone.lat + latOffset, zone.lng + lngOffset]
    return {
      id: zone.id,
      name: zone.id,
      center,
      radiusM: zone.radius,
      elevation: zone.elevation,
      zone: zone.zone,
      feedsInto: zone.feedsInto,
      points: organicCirclePoints(center, zone.radius, idx + 1, 20),
    }
  })
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
  const telemetryByZone = useDashboardStore((s) => s.zones)
  const mapDataStatus = useDashboardStore((s) => s.mapDataStatus)
  const mapMode = useDashboardStore((s) => s.mapMode)
  const setMapMode = useDashboardStore((s) => s.setMapMode)
  const selectedDmaId = useDashboardStore((s) => s.selectedDmaId)
  const selectDma = useDashboardStore((s) => s.selectDma)
  const selectedValveId = useDashboardStore((s) => s.selectedValveId)
  const selectedPipelineId = useDashboardStore((s) => s.selectedPipelineId)
  const [hoveredPipelineId, setHoveredPipelineId] = useState<string | null>(null)
  const [isHardwareMarking, setIsHardwareMarking] = useState(false)
  const [hardwarePoints, setHardwarePoints] = useState<LatLngTuple[]>([])
  const [hardwareHint, setHardwareHint] = useState<string>('')
  const [selectedHardwareDmaId, setSelectedHardwareDmaId] = useState<string>('DMA-01')
  const lastTelegramAt = useRef<number>(0)
  const lastTelegramStatus = useRef<string | null>(null)

  const pipelineRendering = useMemo(() => {
    const count = pipelines.length
    return { simple: count > 1500, animated: count <= 400 }
  }, [pipelines.length])

  const initialCenter = useMemo<LatLngTuple>(() => pipelines[0]?.path?.[0] ?? DEFAULT_CENTER, [pipelines])
  const preferredCenter = useMemo<LatLngTuple>(() => {
    if (pipelines.length === 0) return DEFAULT_CENTER

    const samplePoints: LatLngTuple[] = []
    for (const p of pipelines) {
      if (p.path.length === 0) continue
      samplePoints.push(p.path[Math.floor(p.path.length / 2)]!)
    }
    if (samplePoints.length === 0) return initialCenter

    const mean: LatLngTuple = [
      samplePoints.reduce((s, p) => s + p[0], 0) / samplePoints.length,
      samplePoints.reduce((s, p) => s + p[1], 0) / samplePoints.length,
    ]

    const dense = [...samplePoints]
      .sort((a, b) => metersBetween(a, mean) - metersBetween(b, mean))
      .slice(0, Math.min(400, samplePoints.length))

    return [
      dense.reduce((s, p) => s + p[0], 0) / dense.length,
      dense.reduce((s, p) => s + p[1], 0) / dense.length,
    ]
  }, [initialCenter, pipelines])

  const generatedDmas = useMemo(() => generatePresetOrganicDmas(preferredCenter), [preferredCenter])
  const allDmas = generatedDmas
  const activeDma = useMemo(
    () => allDmas.find((d) => d.id === selectedHardwareDmaId) ?? allDmas[0] ?? null,
    [allDmas, selectedHardwareDmaId],
  )
  const activeDmaTelemetry = activeDma ? telemetryByZone[activeDma.id] : undefined

  const hardwareLinkStatus: 'normal' | 'low' | 'warning' | 'critical' | 'unknown' =
    activeDmaTelemetry?.status ?? 'unknown'

  const onPickHardwarePoint = (point: LatLngTuple) => {
    if (!activeDma) {
      setHardwareHint('No DMA available yet.')
      return
    }
    if (!pointInPolygon(point, activeDma.points)) {
      setHardwareHint(`Pick points inside ${activeDma.id} only.`)
      return
    }

    setHardwareHint('')
    setHardwarePoints((prev) => {
      if (prev.length >= 2) return [prev[1]!, point]
      return [...prev, point]
    })
  }

  useEffect(() => {
    if (hardwarePoints.length < 2) return
    if (!activeDma || !activeDmaTelemetry) return
    if (!(activeDmaTelemetry.status === 'warning' || activeDmaTelemetry.status === 'critical')) return

    const now = Date.now()
    const cooldownMs = 60_000
    if (lastTelegramStatus.current === activeDmaTelemetry.status && now - lastTelegramAt.current < cooldownMs) {
      return
    }

    lastTelegramAt.current = now
    lastTelegramStatus.current = activeDmaTelemetry.status

    const riskLevel = activeDmaTelemetry.status === 'critical' ? 'CRITICAL' : 'WARNING'
    void triggerManualAlert({
      nodeId: `${activeDma.id}-LINK`,
      riskLevel,
      message:
        `Hardware link alert on ${activeDma.name} (${activeDma.id}): ` +
        `ESP-A [${formatLatLng(hardwarePoints[0]!)}], ` +
        `ESP-B [${formatLatLng(hardwarePoints[1]!)}], ` +
        `status=${activeDmaTelemetry.status.toUpperCase()}, ` +
        `pressure=${activeDmaTelemetry.pressure.toFixed(2)}bar, flow=${activeDmaTelemetry.flowRate.toFixed(1)}L/s, ` +
        `anomaly=${(activeDmaTelemetry.anomalyScore * 100).toFixed(0)}%`,
    }).catch(() => undefined)
  }, [activeDma, activeDmaTelemetry, hardwarePoints.length])

  const batchedPipelines = useMemo(() => {
    if (pipelines.length <= 10_000) return null
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
  }, [pipelines])

  const hugeValves = valves.length > 10_000

  useEffect(() => {
    // Intentionally empty.
  }, [])

  return (
    <div className="relative h-full w-full">
      <MapContainer center={initialCenter} zoom={13} zoomControl preferCanvas>
        <Pane name="basemap" style={{ zIndex: 100 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </Pane>

        <FitToPreferredCenterOnce
          center={preferredCenter}
          zoom={14}
          enabled={mapDataStatus === 'ready' || mapDataStatus === 'demo'}
        />
        <FitToSelectedDma selectedDmaId={selectedDmaId} dmas={allDmas} />
        <DmaLegendControl enabled={mapMode === 'dma'} />

        <MapControls
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          isHardwareMarking={isHardwareMarking}
          hardwarePointCount={hardwarePoints.length}
          dmaOptions={allDmas.map((d) => ({ id: d.id, elevation: d.elevation, zone: d.zone, feedsInto: d.feedsInto }))}
          selectedHardwareDmaId={activeDma?.id ?? 'DMA-01'}
          onSelectedHardwareDmaChange={(dmaId) => {
            setSelectedHardwareDmaId(dmaId)
            selectDma(dmaId)
            setHardwarePoints([])
            setHardwareHint('')
          }}
          onToggleHardwareMarking={() => {
            setHardwareHint('')
            setIsHardwareMarking((v) => !v)
          }}
          onClearHardwarePoints={() => {
            setHardwarePoints([])
            setHardwareHint('')
          }}
          selectedDmaElevation={activeDma?.elevation ?? 0}
          selectedDmaZone={activeDma?.zone ?? 'Medium'}
          selectedDmaZoneEmoji={getZoneEmoji(activeDma?.zone ?? 'Medium')}
          selectedDmaFlowDirection={getFlowDirection(activeDma?.zone ?? 'Medium')}
          selectedDmaFeedsInto={activeDma?.feedsInto?.join(', ') ?? '--'}
        />

        <HardwarePointCapture
          enabled={mapMode === 'dma' && isHardwareMarking}
          onPick={onPickHardwarePoint}
        />

        <DmaLayerGroup
          enabled={mapMode === 'dma'}
          dmas={allDmas}
          selectedDmaId={selectedDmaId}
          onSelect={selectDma}
          onPipelineSelect={onPipelineSelect}
        />

        {mapMode === 'dma' && hardwarePoints.length > 0 ? (
          <Pane name="hardware-link" style={{ zIndex: 320 }}>
            {hardwarePoints.length === 2 ? (
              <Polyline
                positions={hardwarePoints}
                pathOptions={{
                  color: severityColor(hardwareLinkStatus),
                  weight: 6,
                  opacity: 0.95,
                }}
              >
                <Tooltip>
                  <div className="text-xs">
                    <div className="font-mono">ESP LINK / {activeDma?.id ?? 'DMA'}</div>
                    <div className="text-text-muted">Status: {hardwareLinkStatus.toUpperCase()}</div>
                    <div className="text-text-muted">
                      Pressure: {activeDmaTelemetry ? `${activeDmaTelemetry.pressure.toFixed(2)} bar` : '--'}
                    </div>
                    <div className="text-text-muted">
                      Flow: {activeDmaTelemetry ? `${activeDmaTelemetry.flowRate.toFixed(1)} L/s` : '--'}
                    </div>
                    <div className="text-text-muted">
                      Anomaly: {activeDmaTelemetry ? `${(activeDmaTelemetry.anomalyScore * 100).toFixed(0)}%` : '--'}
                    </div>
                    <div className="mt-1 text-text-faint">Telegram triggers on WARNING/CRITICAL.</div>
                  </div>
                </Tooltip>
              </Polyline>
            ) : null}

            {hardwarePoints.map((pt, idx) => (
              <CircleMarker
                key={`esp-point-${idx}`}
                center={pt}
                radius={7}
                pathOptions={{
                  color: '#0F172A',
                  fillColor: idx === 0 ? '#22C55E' : '#06B6D4',
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" opacity={1}>
                  <div className="rounded border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-text">
                    {idx === 0 ? 'ESP-A' : 'ESP-B'}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}

            {hardwareHint ? (
              <CircleMarker center={hardwarePoints[hardwarePoints.length - 1] ?? activeDma?.center ?? DEFAULT_CENTER} radius={0} pathOptions={{ color: 'transparent', fillOpacity: 0 }}>
                <Tooltip permanent direction="right" opacity={1}>
                  <div className="rounded border border-border bg-panel px-2 py-1 text-[11px] text-text-muted">{hardwareHint}</div>
                </Tooltip>
              </CircleMarker>
            ) : null}
          </Pane>
        ) : null}

        <Pane name="pipelines" style={{ zIndex: 350 }}>
          {batchedPipelines
            ? (['xl', 'lg', 'md', 'sm', 'unknown'] as DiameterBand[]).map((band) => {
                const paths = batchedPipelines[band]
                if (!paths || paths.length === 0) return null
                return (
                  <>
                    <Polyline
                      key={`batch-casing-${band}`}
                      positions={paths}
                      pathOptions={{ color: '#080d14', weight: 4, opacity: 0.55 }}
                      interactive={false}
                    />
                    <Polyline
                      key={`batch-${band}`}
                      positions={paths}
                      pathOptions={{ color: diameterBandColor(band), weight: 2, opacity: 0.9 }}
                      interactive={false}
                    />
                  </>
                )
              })
            : pipelines.map((p) => {
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
                        pathOptions={{ color: '#080d14', weight: casingWeight, opacity: 0.55 }}
                        interactive={false}
                      />
                      <Polyline
                        key={p.id}
                        positions={p.path}
                        pathOptions={{ color, weight: lineWeight, opacity: 0.92 }}
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
                      pathOptions={{ color: '#080d14', weight: casingWeight, opacity: 0.55 }}
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
              })}
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
                radius={hugeValves ? 3 : 6}
                showTooltip={!hugeValves}
                interactive={!hugeValves}
                selected={selectedValveId === v.id}
              />
            )
          })}
        </Pane>
      </MapContainer>
    </div>
  )
}
