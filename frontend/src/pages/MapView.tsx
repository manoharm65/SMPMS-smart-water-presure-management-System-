import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Bengaluru center
const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946]

const STATUS_COLORS: Record<string, string> = {
  ok:   '#007A3D',
  warn: '#CC5500',
  low:  '#004DB3',
  crit: '#E8001D',
}

const ZONE_DATA: Record<string, { pressure: string, valve: string, ai: string, time: string }> = {
  'DMA-01': { pressure: '3.20 bar', valve: '42%', ai: '94%', time: '14:32:01' },
  'DMA-02': { pressure: '4.80 bar', valve: '65%', ai: '88%', time: '14:31:45' },
  'DMA-03': { pressure: '2.90 bar', valve: '38%', ai: '91%', time: '14:32:12' },
  'DMA-04': { pressure: '4.50 bar', valve: '71%', ai: '85%', time: '14:31:58' },
  'DMA-05': { pressure: '6.20 bar', valve: '18%', ai: '99%', time: '14:28:41' },
  'DMA-06': { pressure: '3.50 bar', valve: '55%', ai: '93%', time: '14:32:08' },
  'DMA-07': { pressure: '3.10 bar', valve: '45%', ai: '96%', time: '14:32:20' },
  'DMA-08': { pressure: '1.40 bar', valve: '82%', ai: '91%', time: '14:15:03' },
}

const ACTIVE_ALERTS = [
  { zone: 'DMA-05 Central',  sev: 'crit', msg: 'Overpressure — 6.20 bar' },
  { zone: 'DMA-08 Tail-end', sev: 'crit', msg: 'Pressure drop anomaly' },
  { zone: 'DMA-02 South',    sev: 'warn', msg: 'Elevated reading — 4.80 bar' },
]

// Zone markers positioned around Bengaluru
const ZONES = [
  { id: 'DMA-01', name: 'North',      lat: 13.05, lng: 77.59, status: 'ok'   },
  { id: 'DMA-02', name: 'South',      lat: 12.91, lng: 77.62, status: 'warn' },
  { id: 'DMA-03', name: 'East',       lat: 12.93, lng: 77.72, status: 'low'  },
  { id: 'DMA-04', name: 'West',       lat: 12.97, lng: 77.52, status: 'ok'   },
  { id: 'DMA-05', name: 'Central',    lat: 12.98, lng: 77.59, status: 'crit' },
  { id: 'DMA-06', name: 'Elevated',   lat: 12.88, lng: 77.58, status: 'ok'  },
  { id: 'DMA-07', name: 'Industrial', lat: 12.95, lng: 77.50, status: 'ok'   },
  { id: 'DMA-08', name: 'Tail-end',   lat: 12.85, lng: 77.65, status: 'crit' },
]

function createValveIcon(status: string, isSelected: boolean) {
  const color = STATUS_COLORS[status]
  const size = isSelected ? 28 : 24
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
        ${status === 'crit' ? `
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

function ZoneMarker({ zone, selected, onSelect }: { zone: typeof ZONES[0], selected: boolean, onSelect: (id: string) => void }) {
  const icon = createValveIcon(zone.status, selected)

  return (
    <Marker
      position={[zone.lat, zone.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(zone.id),
      }}
    >
      <Popup>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", minWidth: 140 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{zone.id} — {zone.name}</div>
          <div style={{ fontSize: 11, color: '#6B6B6B', marginBottom: 6 }}>
            Pressure: <strong style={{ color: STATUS_COLORS[zone.status] }}>{ZONE_DATA[zone.id].pressure}</strong>
          </div>
          <button
            onClick={() => onSelect(zone.id)}
            style={{
              background: '#0A0A0A',
              color: '#F5F0E8',
              border: 'none',
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
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

export default function MapView() {
  const [selected, setSelected] = useState<string | null>(null)
  const [showZones, setShowZones] = useState(true)

  const selectedZone = selected ? ZONES.find(z => z.id === selected) : null

  return (
    <div className="flex flex-1 overflow-hidden bg-paper">
      {/* LEFT: OSM Map */}
      <div className="flex-[0_0_62%] flex flex-col">
        {/* Map Header */}
        <div className="h-[42px] flex items-center justify-between px-4 border-b-2 border-rule bg-paper">
          <span className="font-condensed text-xs font-bold uppercase tracking-wider text-ink">
            Bengaluru — DMA Network
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowZones(!showZones)}
              className={`font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                showZones ? 'text-pass' : 'text-dim'
              }`}
            >
              ZONES
            </button>
          </div>
        </div>

        {/* Leaflet Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={BENGALURU_CENTER}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {showZones && ZONES.map((zone) => (
              <ZoneMarker
                key={zone.id}
                zone={zone}
                selected={selected === zone.id}
                onSelect={setSelected}
              />
            ))}
          </MapContainer>

          {/* Map overlay label */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-paper/90 border border-rule px-3 py-1.5">
            <span className="font-condensed text-[10px] text-dim uppercase tracking-wider">
              OpenStreetMap — Bengaluru, Karnataka
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT: White Panel */}
      <div className="flex-[0_0_38%] bg-paper flex flex-col overflow-y-auto">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 border-b-2 border-rule">
          {[
            { label: 'ZONES ONLINE',   value: '8/8' },
            { label: 'AVG PRESSURE',    value: '3.49 BAR' },
            { label: 'CRITICAL',       value: '2' },
            { label: 'SUSPECTED LEAKS', value: '1' },
          ].map((kpi, i) => (
            <div
              key={i}
              className={`px-4 py-4 ${i % 2 === 0 ? 'border-r-2 border-rule' : ''} ${i < 2 ? 'border-b-2 border-rule' : ''}`}
            >
              <span className="font-condensed text-xs text-dim uppercase tracking-wider block mb-1">
                {kpi.label}
              </span>
              <span className="font-mono text-lg font-bold text-ink">{kpi.value}</span>
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
                  { label: 'Pressure',    value: ZONE_DATA[selectedZone.id].pressure },
                  { label: 'Valve',       value: ZONE_DATA[selectedZone.id].valve },
                  { label: 'AI Confidence', value: ZONE_DATA[selectedZone.id].ai },
                  { label: 'Reading',     value: ZONE_DATA[selectedZone.id].time },
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
                <a href="#" className="font-condensed text-sm text-ink hover:text-signal transition-colors flex items-center gap-1">
                  VIEW ZONE DETAIL
                  <span className="text-xs">→</span>
                </a>
                <a href="#" className="font-condensed text-sm text-ink hover:text-signal transition-colors flex items-center gap-1">
                  VALVE CONTROL
                  <span className="text-xs">→</span>
                </a>
                <a href="#" className="font-condensed text-sm text-ink hover:text-signal transition-colors flex items-center gap-1">
                  PRESSURE TREND
                  <span className="text-xs">→</span>
                </a>
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
            {ACTIVE_ALERTS.map((alert, i) => {
              const sevColor = alert.sev === 'crit' ? '#E8001D' : '#CC5500'
              return (
                <div key={i} className="flex gap-3">
                  <div
                    className="w-1 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: sevColor }}
                  />
                  <div>
                    <span className="font-syne font-bold text-xs text-ink block">
                      {alert.zone}
                    </span>
                    <span className="font-condensed text-xs text-dim">{alert.msg}</span>
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
                  style={{
                    backgroundColor: item.color,
                    borderRadius: item.shape === 'circle' ? '50%' : '2px',
                  }}
                />
                <span className="font-condensed text-xs text-dim">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-rule">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-dim rounded-sm" />
              <span className="font-condensed text-xs text-dim">Zone Marker</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-4 h-0.5 bg-pass" />
              <span className="font-condensed text-xs text-dim">OSM Standard Layer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
