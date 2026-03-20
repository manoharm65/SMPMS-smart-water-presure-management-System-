import { useState, useEffect, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { loadAllKMLData, SpatialIndex, getPipesInBounds, type PipeData, type ValveData, type ValveCluster } from '../data/kmlParser'
import { getZones, getKPI, getAlerts, usePolling, type Zone, type KPI, type Alert } from '../services/api'

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// New default location: 12.8997° N, 77.4827° E
const DEFAULT_CENTER: [number, number] = [12.8997, 77.4827]

const STATUS_COLORS: Record<string, string> = {
  ok:   '#007A3D',
  warn: '#CC5500',
  low:  '#004DB3',
  crit: '#E8001D',
}

function createValveIcon(status: string, isSelected: boolean, aiConfidence?: number) {
  const color = STATUS_COLORS[status]
  const size = isSelected ? 28 : 24
  const showLeakPulse = status === 'crit' && aiConfidence !== undefined && aiConfidence > 85
  return L.divIcon({
    className: 'custom-valve-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid ${isSelected ? '#F5F0E8' : 'none'};
        border-radius: ${status === 'crit' ? '50%' : '2px'};
        box-shadow: 0 0 8px ${color}80;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        ${showLeakPulse ? `
          <div style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: pulse 1.5s ease-out infinite;
          "></div>
        ` : ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Cluster icon showing count
function createClusterIcon(count: number) {
  const size = Math.min(20 + Math.log2(count) * 6, 44)
  return L.divIcon({
    className: 'valve-cluster-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: #0A0A0A;
        border: 2px solid #F5F0E8;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #F5F0E8;
        font-family: 'Space Mono', monospace;
        font-size: ${Math.max(8, Math.min(13, size / 3))}px;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      ">${count > 999 ? '999+' : count}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Tracks map bounds + zoom and reports everything back to parent
function MapStateTracker({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: L.LatLngBounds, zoom: number) => void
}) {
  const map = useMap()

  useEffect(() => {
    const update = () => {
      onBoundsChange(map.getBounds(), map.getZoom())
    }
    map.on('moveend', update)
    map.on('zoomend', update)
    update()
    return () => {
      map.off('moveend', update)
      map.off('zoomend', update)
    }
  }, [map])

  return null
}

function ZoneMarker({ zone, selected, onSelect }: { zone: Zone, selected: boolean, onSelect: (id: string) => void }) {
  const icon = createValveIcon(zone.status, selected, zone.ai_confidence)
  return (
    <Marker
      position={[zone.lat, zone.lng]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(zone.id) }}
    >
      <Popup>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", minWidth: 140 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{zone.id} — {zone.name}</div>
          <div style={{ fontSize: 11, color: '#6B6B6B', marginBottom: 6 }}>
            Pressure: <strong style={{ color: STATUS_COLORS[zone.status] }}>{zone.pressure.toFixed(2)} bar</strong>
          </div>
          <button
            onClick={() => onSelect(zone.id)}
            style={{
              background: '#0A0A0A', color: '#F5F0E8', border: 'none',
              padding: '4px 8px', fontSize: 11, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
            }}
          >
            Select Zone →
          </button>
        </div>
      </Popup>
    </Marker>
  )
}

function ValveClusterMarker({ cluster, onSelect }: { cluster: ValveCluster, onSelect: (valves: ValveData[]) => void }) {
  const icon = createClusterIcon(cluster.count)
  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(cluster.valves) }}
    >
      <Popup>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", minWidth: 140 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            {cluster.count} Valve{cluster.count > 1 ? 's' : ''} Cluster
          </div>
          <div style={{ fontSize: 11, color: '#6B6B6B', marginBottom: 6 }}>
            Zoom in to see individual valves
          </div>
          {cluster.valves.slice(0, 5).map((v, i) => (
            <div key={i} style={{ fontSize: 11, marginBottom: 2 }}>
              Valve {v.name}
              {v.diameter ? ` — Ø${v.diameter}mm` : ''}
            </div>
          ))}
          {cluster.valves.length > 5 && (
            <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 4 }}>
              +{cluster.valves.length - 5} more
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

export default function MapView() {
  const [selected, setSelected] = useState<string | null>(null)
  const [showZones, setShowZones] = useState(true)
  const [showPipes, setShowPipes] = useState(true)
  const [showValves, setShowValves] = useState(true)
  const [zones, setZones] = useState<Zone[]>([])
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [visibleZoneIds, setVisibleZoneIds] = useState<string[]>([])
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null)
  const [mapZoom, setMapZoom] = useState(12)
  const [spatialIndex, setSpatialIndex] = useState<SpatialIndex | null>(null)
  const [allPipes, setAllPipes] = useState<PipeData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingApi, setLoadingApi] = useState(true)
  const [stats, setStats] = useState({ visibleValves: 0, visiblePipes: 0, clusters: 0 })

  // Fetch live data from API
  const fetchApiData = useCallback(async () => {
    try {
      const [zonesData, kpiData, alertsData] = await Promise.all([
        getZones(),
        getKPI(),
        getAlerts(),
      ])
      setZones(zonesData)
      setKpi(kpiData)
      setAlerts(alertsData)
      setLoadingApi(false)
    } catch (err) {
      console.warn('Failed to fetch API data', err)
      setLoadingApi(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchApiData()
  }, [fetchApiData])

  // Poll every 30 seconds
  usePolling(fetchApiData, 30000)

  // Visible zone IDs from live zones
  const visibleZoneIdsFromZones = useMemo(() => {
    if (!mapBounds) return zones.map(z => z.id)
    return zones.filter(z => mapBounds.contains([z.lat, z.lng])).map(z => z.id)
  }, [zones, mapBounds])

  // Derive visible zone set
  const visibleZoneSet = useMemo(() => new Set(visibleZoneIds), [visibleZoneIds])

  // Selected zone from live data
  const selectedZone = selected ? zones.find(z => z.id === selected) : null

  // Compute worst status for pipe coloring (from visible zones)
  const worstStatus = useMemo(() => {
    if (zones.length === 0) return 'ok'
    const priority: Record<string, number> = { crit: 4, warn: 3, low: 2, ok: 1 }
    let worst = 'ok'
    for (const zone of zones) {
      if ((priority[zone.status] || 0) > (priority[worst] || 0)) {
        worst = zone.status
      }
    }
    return worst
  }, [zones])

  const pipeColor = STATUS_COLORS[worstStatus]

  // Build spatial index once when KML data loads
  useEffect(() => {
    // Only load operationally relevant features:
    // - Gate valves (TypeID 1) and washout/NRVs (TypeID 3) — skip TypeID 4 distribution valves
    // - All pipe segments from the main file
    loadAllKMLData({ valveTypeIds: [1, 3] }).then(({ pipes, valves }) => {
      const index = new SpatialIndex()
      for (const v of valves) index.addValve(v)
      setSpatialIndex(index)
      setAllPipes(pipes)
      setLoading(false)
    }).catch(e => {
      console.warn('Failed to load KML data', e)
      setLoading(false)
    })
  }, [])

  // Update visible zone IDs when zones load or map bounds change
  useEffect(() => {
    setVisibleZoneIds(visibleZoneIdsFromZones)
  }, [visibleZoneIdsFromZones])

  // Derive visible pipes and valve clusters from current bounds/zoom
  const { visiblePipes, visibleClusters, visibleIndividualValves } = useMemo(() => {
    if (!mapBounds || !spatialIndex) {
      return { visiblePipes: [], visibleClusters: [], visibleIndividualValves: [] }
    }

    const margin = 0.01 // small margin so edges don't pop
    const minLat = mapBounds.getSouth() - margin
    const maxLat = mapBounds.getNorth() + margin
    const minLng = mapBounds.getWest() - margin
    const maxLng = mapBounds.getEast() + margin

    // Pipes: only those with at least one point in bounds
    const pipes = getPipesInBounds(allPipes, minLat, maxLat, minLng, maxLng)

    // Valves: cluster or individual based on zoom
    const clusters = spatialIndex.clusterValves(mapZoom, minLat, maxLat, minLng, maxLng)

    // At zoom >= 14, clusters contain single valves — extract them for individual rendering
    const individualValves: ValveData[] = []
    const collapsedClusters: ValveCluster[] = []
    for (const c of clusters) {
      if (c.count === 1) {
        individualValves.push(c.valves[0])
      } else {
        collapsedClusters.push(c)
      }
    }

    return { visiblePipes: pipes, visibleClusters: collapsedClusters, visibleIndividualValves: individualValves }
  }, [mapBounds, mapZoom, spatialIndex, allPipes])

  // Update stats for the info overlay
  useEffect(() => {
    setStats({
      visibleValves: visibleIndividualValves.length,
      visiblePipes: visiblePipes.length,
      clusters: visibleClusters.length,
    })
  }, [visiblePipes, visibleClusters, visibleIndividualValves])

  // Handle map bounds changes
  const handleBoundsChange = (bounds: L.LatLngBounds, zoom: number) => {
    setMapBounds(bounds)
    setMapZoom(zoom)
    // Update zone visibility based on live zones
    const visible = zones.filter(z => bounds.contains([z.lat, z.lng])).map(z => z.id)
    setVisibleZoneIds(visible)
  }

  // Handle cluster click → expand view
  const handleClusterClick = (valves: ValveData[]) => {
    if (valves.length === 1) {
      setSelected(valves[0].id)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-paper">
      {/* LEFT: OSM Map */}
      <div className="flex-[0_0_70%] flex flex-col">
        {/* Map Header */}
        <div className="h-[42px] flex items-center justify-between px-4 border-b-2 border-rule bg-paper">
          <div className="flex items-center gap-4">
            <span className="font-condensed text-xs font-bold uppercase tracking-wider text-ink">
              Bengaluru — DMA Network
            </span>
            {loading && (
              <span className="font-mono text-[10px] text-dim animate-pulse">LOADING KML…</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowZones(!showZones)}
              className={`font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                showZones ? 'text-pass' : 'text-dim'
              }`}
            >
              ZONES
            </button>
            <button
              onClick={() => setShowPipes(!showPipes)}
              className={`font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                showPipes ? 'text-pass' : 'text-dim'
              }`}
            >
              PIPES
            </button>
            <button
              onClick={() => setShowValves(!showValves)}
              className={`font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                showValves ? 'text-pass' : 'text-dim'
              }`}
            >
              VALVES
            </button>
          </div>
        </div>

        {/* Leaflet Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapStateTracker onBoundsChange={handleBoundsChange} />

            {/* Zone markers — only render if visible and toggled on */}
            {showZones && zones.map((zone) => {
              if (!visibleZoneSet.has(zone.id)) return null
              return (
                <ZoneMarker
                  key={zone.id}
                  zone={zone}
                  selected={selected === zone.id}
                  onSelect={setSelected}
                />
              )
            })}

            {/* Pipe polylines from KML — viewport culled, colored by zone pressure status */}
            {showPipes && visiblePipes.map((pipe) => (
              <Polyline
                key={`pipe-${pipe.id}`}
                positions={pipe.coordinates}
                pathOptions={{
                  color: pipeColor,
                  weight: pipe.diameter ? Math.max(2, Math.min(pipe.diameter / 50, 8)) : 3,
                  opacity: 0.6,
                }}
              />
            ))}

            {/* Valve clusters — shown when zoomed out (cluster.count > 1) */}
            {showValves && visibleClusters.map((cluster, i) => (
              <ValveClusterMarker
                key={`cluster-${i}`}
                cluster={cluster}
                onSelect={handleClusterClick}
              />
            ))}

            {/* Individual valve markers — shown when zoomed in */}
            {showValves && visibleIndividualValves.map((valve) => (
              <CircleMarker
                key={`valve-${valve.id}`}
                center={[valve.lat, valve.lng]}
                radius={valve.diameter ? Math.max(3, Math.min(valve.diameter / 30, 8)) : 4}
                pathOptions={{
                  color: '#0A0A0A',
                  fillColor: '#0A0A0A',
                  fillOpacity: 0.8,
                  weight: 1,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", minWidth: 120 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Valve {valve.name}</div>
                    {valve.diameter && (
                      <div style={{ fontSize: 11, color: '#6B6B6B' }}>Diameter: {valve.diameter}mm</div>
                    )}
                    {valve.status && (
                      <div style={{ fontSize: 11, color: '#6B6B6B' }}>Status: {valve.status}</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Map overlay label */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-paper/90 border border-rule px-3 py-1.5 flex flex-col gap-0.5">
            <span className="font-condensed text-[10px] text-dim uppercase tracking-wider">
              OpenStreetMap — Bengaluru, Karnataka
            </span>
            {!loading && (
              <span className="font-mono text-[9px] text-dim">
                Valves: {stats.visibleValves}{stats.clusters > 0 ? ` + ${stats.clusters} clusters` : ''} · Pipes: {stats.visiblePipes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: White Panel */}
      <div className="flex-[0_0_30%] bg-paper flex flex-col overflow-y-auto">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 border-b-2 border-rule">
          {[
            { label: 'ZONES ONLINE',    value: kpi ? `${kpi.zones_online}/${kpi.zones_total}` : '—' },
            { label: 'AVG PRESSURE',    value: kpi ? `${kpi.avg_pressure.toFixed(2)} BAR` : '—' },
            { label: 'CRITICAL',        value: kpi ? String(kpi.active_alerts) : '—' },
            { label: 'SUSPECTED LEAKS', value: kpi ? String(kpi.leaks_flagged) : '—' },
          ].map((kpiItem, i) => (
            <div
              key={i}
              className={`px-4 py-4 ${i % 2 === 0 ? 'border-r-2 border-rule' : ''} ${i < 2 ? 'border-b-2 border-rule' : ''}`}
            >
              <span className="font-condensed text-xs text-dim uppercase tracking-wider block mb-1">
                {kpiItem.label}
              </span>
              <span className="font-mono text-lg font-bold text-ink">{loadingApi && !kpi ? '…' : kpiItem.value}</span>
            </div>
          ))}
        </div>

        {/* Zone Inspector */}
        <div className="p-5 border-b-2 border-rule">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-sm text-ink uppercase tracking-wider">
              Zone Inspector
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="font-mono text-xs text-dim hover:text-ink transition-colors"
            >
              CLEAR
            </button>
          </div>

          {!selectedZone ? (
            <p className="font-condensed text-sm text-dim text-center py-8">
              — CLICK A ZONE MARKER ON THE MAP —
            </p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-syne font-bold text-lg text-ink">{selectedZone.id}</h3>
                <span
                  className={`font-condensed text-xs font-semibold px-2 py-1 text-paper ${
                    selectedZone.status === 'crit' ? 'bg-signal' :
                    selectedZone.status === 'warn' ? 'bg-warn' :
                    selectedZone.status === 'low' ? 'bg-low' :
                    'bg-pass'
                  }`}
                >
                  {selectedZone.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Pressure',      value: `${selectedZone.pressure.toFixed(2)} bar` },
                  { label: 'Valve',         value: `${selectedZone.valve_position}%` },
                  { label: 'AI Confidence', value: `${selectedZone.ai_confidence}%` },
                  { label: 'Reading',       value: selectedZone.last_reading },
                ].map((item, i) => (
                  <div key={i} className="bg-ink/5 p-2 rounded">
                    <span className="font-condensed text-xs text-dim uppercase tracking-wider block">
                      {item.label}
                    </span>
                    <span className="font-mono text-sm font-bold text-ink">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <Link to={`/zones/${selectedZone.id}`} className="font-condensed text-sm text-ink hover:text-signal transition-colors flex items-center gap-1">
                  VIEW ZONE DETAIL <span className="text-xs">→</span>
                </Link>
                <Link to={`/zones/${selectedZone.id}`} className="font-condensed text-sm text-ink hover:text-signal transition-colors flex items-center gap-1">
                  VALVE CONTROL <span className="text-xs">→</span>
                </Link>
                <Link to={`/zones/${selectedZone.id}`} className="font-condensed text-sm text-ink hover:text-signal transition-colors flex items-center gap-1">
                  PRESSURE TREND <span className="text-xs">→</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Active Alerts */}
        <div className="p-5 border-b-2 border-rule">
          <h2 className="font-syne font-bold text-sm text-ink uppercase tracking-wider mb-3">
            Active Alerts
          </h2>
          <div className="space-y-3">
            {alerts.length === 0 && !loadingApi && (
              <p className="font-condensed text-sm text-dim text-center py-4">No active alerts</p>
            )}
            {alerts.map((alert, i) => {
              const sevColor = alert.severity === 'crit' ? '#E8001D' : '#CC5500'
              return (
                <div key={i} className="flex gap-3">
                  <div className="w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: sevColor }} />
                  <div>
                    <span className="font-syne font-bold text-xs text-ink block">{alert.zone_name}</span>
                    <span className="font-condensed text-xs text-dim">{alert.message}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="p-5">
          <h2 className="font-syne font-bold text-sm text-ink uppercase tracking-wider mb-3">
            Legend
          </h2>
          <div className="space-y-2">
            {[
              { color: '#E8001D', label: 'Critical', shape: 'circle' },
              { color: '#CC5500', label: 'Warning', shape: 'square' },
              { color: '#004DB3', label: 'Low Pressure', shape: 'square' },
              { color: '#007A3D', label: 'Normal', shape: 'square' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 flex-shrink-0"
                  style={{ backgroundColor: item.color, borderRadius: item.shape === 'circle' ? '50%' : '2px' }}
                />
                <span className="font-condensed text-xs text-dim">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-rule space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-dim rounded-full" />
              <span className="font-condensed text-xs text-dim">Valve Cluster (zoom out)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-ink" />
              <span className="font-condensed text-xs text-dim">Pipe (from KML)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-ink rounded-full" />
              <span className="font-condensed text-xs text-dim">Valve (zoom in)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
