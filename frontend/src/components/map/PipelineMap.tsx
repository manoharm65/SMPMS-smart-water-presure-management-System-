import L, { type LatLngTuple } from 'leaflet'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Pane, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { triggerManualAlert } from '../../services/api'
import { useDashboardStore } from '../../store/dashboardStore'
import FlowPipeline from './FlowPipeline'
import MapControls from './MapControls'
import ValveNode from './ValveNode'

type DiameterBand = 'xl' | 'lg' | 'md' | 'sm' | 'unknown'
type GeneratedDma = {
  id: string
  name: string
  center: LatLngTuple
  points: LatLngTuple[]
}

const DEFAULT_CENTER: LatLngTuple = [12.9716, 77.5946]

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

function irregularEllipsePoints(
  center: LatLngTuple,
  radiusXM: number,
  radiusYM: number,
  rotationDeg: number,
  wobble = 0.12,
  segments = 72,
) {
  const [lat, lng] = center
  const latScale = degreesPerMeterLat()
  const lngScale = degreesPerMeterLng(center[0])
  const rot = (rotationDeg * Math.PI) / 180
  const pts: LatLngTuple[] = []

  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2
    const w = 1 + wobble * (0.6 * Math.sin(3 * t + 0.4) + 0.4 * Math.sin(5 * t - 0.2))
    const x = Math.cos(t) * radiusXM * w
    const y = Math.sin(t) * radiusYM * w

    const xr = x * Math.cos(rot) - y * Math.sin(rot)
    const yr = x * Math.sin(rot) + y * Math.cos(rot)

    pts.push([lat + yr * latScale, lng + xr * lngScale])
  }

  pts.push(pts[0]!)
  return pts
}

function generateDmasFromPipelines(pipelines: Array<{ path: LatLngTuple[] }>, count = 16): GeneratedDma[] {
  const dmaSizeMultiplier = 4
  const samplePoints: LatLngTuple[] = []
  for (const p of pipelines) {
    if (p.path.length === 0) continue
    samplePoints.push(p.path[Math.floor(p.path.length / 2)]!)
  }
  if (samplePoints.length === 0) return []

  const sortedLat = samplePoints.map((p) => p[0]).sort((a, b) => a - b)
  const sortedLng = samplePoints.map((p) => p[1]).sort((a, b) => a - b)
  const q = (arr: number[], t: number) => {
    if (arr.length === 0) return 0
    const idx = Math.max(0, Math.min(arr.length - 1, Math.floor((arr.length - 1) * t)))
    return arr[idx]!
  }

  // Keep broad map coverage while avoiding extreme outliers that can push DMAs off-screen.
  let minLat = q(sortedLat, 0.03)
  let maxLat = q(sortedLat, 0.97)
  let minLng = q(sortedLng, 0.03)
  let maxLng = q(sortedLng, 0.97)

  if (!(minLat < maxLat && minLng < maxLng)) {
    minLat = sortedLat[0]!
    maxLat = sortedLat[sortedLat.length - 1]!
    minLng = sortedLng[0]!
    maxLng = sortedLng[sortedLng.length - 1]!
  }

  const latPad = Math.max((maxLat - minLat) * 0.2, 0.004)
  const lngPad = Math.max((maxLng - minLng) * 0.2, 0.004)
  minLat -= latPad
  maxLat += latPad
  minLng -= lngPad
  maxLng += lngPad

  const midLat = (minLat + maxLat) / 2
  const widthM = Math.max(1400, (maxLng - minLng) / degreesPerMeterLng(midLat))
  const heightM = Math.max(1200, (maxLat - minLat) / degreesPerMeterLat())

  const templates = [
    { x: 0.16, y: 0.18, rx: 0.18, ry: 0.13, rot: -22 },
    { x: 0.34, y: 0.15, rx: 0.14, ry: 0.11, rot: -10 },
    { x: 0.49, y: 0.20, rx: 0.14, ry: 0.11, rot: 12 },
    { x: 0.78, y: 0.25, rx: 0.22, ry: 0.16, rot: 8 },
    { x: 0.15, y: 0.45, rx: 0.16, ry: 0.12, rot: -8 },
    { x: 0.41, y: 0.42, rx: 0.22, ry: 0.16, rot: -14 },
    { x: 0.60, y: 0.53, rx: 0.19, ry: 0.15, rot: 20 },
    { x: 0.17, y: 0.76, rx: 0.22, ry: 0.19, rot: -18 },
    { x: 0.46, y: 0.84, rx: 0.22, ry: 0.15, rot: 4 },
    { x: 0.79, y: 0.74, rx: 0.21, ry: 0.18, rot: 10 },
  ] as const

  type LayoutPoint = {
    xM: number
    yM: number
    rot: number
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const layout: LayoutPoint[] = templates.slice(0, Math.min(count, templates.length)).map((tpl) => ({
    rot: tpl.rot,
    xM: tpl.x * widthM,
    yM: tpl.y * heightM,
  }))

  if (count > layout.length) {
    const extraCount = count - layout.length
    const cols = Math.max(3, Math.ceil(Math.sqrt(extraCount * 1.35)))
    const rows = Math.max(2, Math.ceil(extraCount / cols))

    for (let i = 0; i < extraCount; i += 1) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const xNorm = (col + 1) / (cols + 1)
      const yNorm = (row + 1) / (rows + 1)
      const jitterX = ((((i * 37) % 100) / 100) - 0.5) * 0.08
      const jitterY = ((((i * 53) % 100) / 100) - 0.5) * 0.08

      layout.push({
        rot: (((i * 47) % 56) - 28),
        xM: clamp((xNorm + jitterX) * widthM, 0.08 * widthM, 0.92 * widthM),
        yM: clamp((yNorm + jitterY) * heightM, 0.08 * heightM, 0.92 * heightM),
      })
    }
  }

  const areaPerDma = (widthM * heightM) / Math.max(1, layout.length)
  const naturalSpacingM = Math.sqrt(areaPerDma)
  const targetSpacingM = clamp(naturalSpacingM * 1.04, 620, 1300)
  const layoutMarginM = 120

  for (let iter = 0; iter < 120; iter += 1) {
    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        const a = layout[i]!
        const b = layout[j]!
        let dx = b.xM - a.xM
        let dy = b.yM - a.yM
        let d = Math.hypot(dx, dy)
        if (d < 1e-6) {
          dx = 1
          dy = 0
          d = 1
        }
        if (d >= targetSpacingM) continue
        const push = ((targetSpacingM - d) / 2) * 0.18
        const ux = dx / d
        const uy = dy / d
        a.xM -= ux * push
        a.yM -= uy * push
        b.xM += ux * push
        b.yM += uy * push
      }
    }

    for (const p of layout) {
      p.xM = clamp(p.xM, layoutMarginM, Math.max(layoutMarginM, widthM - layoutMarginM))
      p.yM = clamp(p.yM, layoutMarginM, Math.max(layoutMarginM, heightM - layoutMarginM))
    }
  }

  const dmas: GeneratedDma[] = layout.map((tpl, idx) => {
    let nearestM = Number.POSITIVE_INFINITY
    for (let j = 0; j < layout.length; j += 1) {
      if (j === idx) continue
      const other = layout[j]!
      const d = Math.hypot(other.xM - tpl.xM, other.yM - tpl.yM)
      if (d < nearestM) nearestM = d
    }

    const preferredRadiusM = clamp(targetSpacingM * 0.45, 300, 640)
    const collisionSafeRadiusM = Number.isFinite(nearestM)
      ? Math.max(70, (nearestM * 0.44 - 30) / (dmaSizeMultiplier * 1.08))
      : preferredRadiusM
    const baseRadiusM = Math.min(preferredRadiusM, collisionSafeRadiusM)
    const isDma07 = idx === 6
    const isDma15 = idx === 14
    const rxM =
      baseRadiusM *
      1.08 *
      dmaSizeMultiplier *
      (isDma07 ? 1.25 : 1) *
      (isDma15 ? 1.22 : 1)
    const ryM =
      baseRadiusM *
      0.9 *
      dmaSizeMultiplier *
      (isDma07 ? 1.25 : 1) *
      (isDma15 ? 1.45 : 1)

    const adjustedYM = isDma15
      ? clamp(tpl.yM + heightM * 0.06, layoutMarginM, Math.max(layoutMarginM, heightM - layoutMarginM))
      : tpl.yM

    const center: LatLngTuple = [
      minLat + adjustedYM * degreesPerMeterLat(),
      minLng + tpl.xM * degreesPerMeterLng(midLat),
    ]

    return {
      id: `DMA-${String(idx + 1).padStart(2, '0')}`,
      name: `District Metered Area ${idx + 1}`,
      center,
      points: irregularEllipsePoints(center, rxM, ryM, tpl.rot, 0.1, 72),
    }
  })

  return dmas
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

  const generatedDmas = useMemo(() => generateDmasFromPipelines(pipelines, 16), [pipelines])
  const allDmas = generatedDmas
  const dma15 = useMemo(() => allDmas.find((d) => d.id === 'DMA-15') ?? null, [allDmas])
  const dma15Telemetry = telemetryByZone['DMA-15']

  const hardwareLinkStatus: 'normal' | 'low' | 'warning' | 'critical' | 'unknown' =
    dma15Telemetry?.status ?? 'unknown'

  const onPickHardwarePoint = (point: LatLngTuple) => {
    if (!dma15) {
      setHardwareHint('DMA-15 not available yet.')
      return
    }
    if (!pointInPolygon(point, dma15.points)) {
      setHardwareHint('Pick points inside DMA-15 only.')
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
    if (!dma15Telemetry) return
    if (!(dma15Telemetry.status === 'warning' || dma15Telemetry.status === 'critical')) return

    const now = Date.now()
    const cooldownMs = 60_000
    if (lastTelegramStatus.current === dma15Telemetry.status && now - lastTelegramAt.current < cooldownMs) {
      return
    }

    lastTelegramAt.current = now
    lastTelegramStatus.current = dma15Telemetry.status

    const riskLevel = dma15Telemetry.status === 'critical' ? 'CRITICAL' : 'WARNING'
    void triggerManualAlert({
      nodeId: 'DMA-15-LINK',
      riskLevel,
      message:
        `Hardware link alert on District Metered Area 15 (DMA-15): ` +
        `ESP-A [${formatLatLng(hardwarePoints[0]!)}], ` +
        `ESP-B [${formatLatLng(hardwarePoints[1]!)}], ` +
        `status=${dma15Telemetry.status.toUpperCase()}, ` +
        `pressure=${dma15Telemetry.pressure.toFixed(2)}bar, flow=${dma15Telemetry.flowRate.toFixed(1)}L/s, ` +
        `anomaly=${(dma15Telemetry.anomalyScore * 100).toFixed(0)}%`,
    }).catch(() => undefined)
  }, [dma15Telemetry, hardwarePoints.length])

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

        <MapControls
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          isHardwareMarking={isHardwareMarking}
          hardwarePointCount={hardwarePoints.length}
          onToggleHardwareMarking={() => {
            setHardwareHint('')
            setIsHardwareMarking((v) => !v)
          }}
          onClearHardwarePoints={() => {
            setHardwarePoints([])
            setHardwareHint('')
          }}
        />

        <HardwarePointCapture
          enabled={mapMode === 'dma' && isHardwareMarking}
          onPick={onPickHardwarePoint}
        />

        {mapMode === 'dma' ? (
          <Pane name="zones" style={{ zIndex: 250 }}>
            {allDmas.map((z) => {
              const isSelected = selectedDmaId === z.id
              return (
                <Fragment key={`dma-${z.id}`}>
                  <Polygon
                    positions={z.points}
                    pathOptions={{
                      color: isSelected ? '#0F172A' : '#1E3A8A',
                      weight: isSelected ? 2 : 1,
                      fillColor: '#60A5FA',
                      fillOpacity: isSelected ? 0.28 : 0.14,
                    }}
                    eventHandlers={{
                      click: () => {
                        selectDma(z.id)
                        onPipelineSelect?.(z.id)
                      },
                    }}
                  >
                    <Tooltip>
                      <div className="text-xs">
                        <div className="font-mono">{z.id}</div>
                        <div className="text-text-muted">{z.name}</div>
                        <div className="mt-1 text-text-faint">Click to zoom</div>
                      </div>
                    </Tooltip>
                  </Polygon>

                  <CircleMarker center={z.center} radius={0} pathOptions={{ color: 'transparent', fillOpacity: 0 }}>
                    <Tooltip permanent direction="center" opacity={1}>
                      <div className="rounded border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-text">{z.id}</div>
                    </Tooltip>
                  </CircleMarker>
                </Fragment>
              )
            })}
          </Pane>
        ) : null}

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
                    <div className="font-mono">ESP LINK / DMA-15</div>
                    <div className="text-text-muted">Status: {hardwareLinkStatus.toUpperCase()}</div>
                    <div className="text-text-muted">
                      Pressure: {dma15Telemetry ? `${dma15Telemetry.pressure.toFixed(2)} bar` : '--'}
                    </div>
                    <div className="text-text-muted">
                      Flow: {dma15Telemetry ? `${dma15Telemetry.flowRate.toFixed(1)} L/s` : '--'}
                    </div>
                    <div className="text-text-muted">
                      Anomaly: {dma15Telemetry ? `${(dma15Telemetry.anomalyScore * 100).toFixed(0)}%` : '--'}
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
              <CircleMarker center={hardwarePoints[hardwarePoints.length - 1] ?? dma15?.center ?? DEFAULT_CENTER} radius={0} pathOptions={{ color: 'transparent', fillOpacity: 0 }}>
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
