import { useState } from 'react'

const valves = [
  { id:'DMA-01', x:150, y:200, status:'ok'   },
  { id:'DMA-02', x:310, y:178, status:'warn' },
  { id:'DMA-03', x:172, y:320, status:'low'  },
  { id:'DMA-04', x:456, y:308, status:'ok'   },
  { id:'DMA-05', x:324, y:302, status:'crit' },
  { id:'DMA-06', x:338, y:406, status:'ok'   },
  { id:'DMA-07', x:460, y:192, status:'ok'   },
  { id:'DMA-08', x:180, y:412, status:'crit' },
]

const zonePolys = [
  { id:'DMA-01', points:"72,130 228,112 246,232 90,248", color:'#007A3D' },
  { id:'DMA-02', points:"228,112 386,126 402,240 246,232", color:'#004DB3' },
  { id:'DMA-03', points:"90,248 246,232 258,360 102,370", color:'#007A3D' },
  { id:'DMA-05', points:"246,232 402,240 414,358 258,360", color:'#E8001D' },
  { id:'DMA-08', points:"102,370 258,360 268,456 112,466", color:'#E8001D' },
  { id:'DMA-06', points:"258,360 414,358 424,456 268,456", color:'#007A3D' },
  { id:'DMA-07', points:"386,126 514,140 504,248 402,240", color:'#007A3D' },
  { id:'DMA-04', points:"402,240 504,248 494,358 414,358", color:'#CC5500' },
]

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

export default function MapView() {
  const [selected, setSelected] = useState<string | null>(null)
  const [viewBox, setViewBox] = useState('0 0 600 600')
  const [showPipelines, setShowPipelines] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [showValves, setShowValves] = useState(true)

  const zoomIn = () => {
    const [minX, minY, w, h] = viewBox.split(' ').map(Number)
    const factor = 0.8
    setViewBox(`${minX + w * (1 - factor) / 2} ${minY + h * (1 - factor) / 2} ${w * factor} ${h * factor}`)
  }

  const zoomOut = () => {
    const [minX, minY, w, h] = viewBox.split(' ').map(Number)
    const factor = 1.25
    setViewBox(`${minX - w * (factor - 1) / 2} ${minY - h * (factor - 1) / 2} ${w * factor} ${h * factor}`)
  }

  const resetView = () => {
    setViewBox('0 0 600 600')
  }

  const pipelineConnections = [
    ['DMA-01', 'DMA-02'],
    ['DMA-02', 'DMA-04'],
    ['DMA-02', 'DMA-05'],
    ['DMA-01', 'DMA-03'],
    ['DMA-03', 'DMA-05'],
    ['DMA-05', 'DMA-06'],
    ['DMA-03', 'DMA-08'],
    ['DMA-05', 'DMA-08'],
    ['DMA-04', 'DMA-07'],
    ['DMA-07', 'DMA-05'],
  ]

  const getValveCoords = (id: string) => {
    const v = valves.find(v => v.id === id)
    return v ? { x: v.x, y: v.y, status: v.status } : null
  }

  const selectedValve = selected ? valves.find(v => v.id === selected) : null

  return (
    <div className="flex flex-1 overflow-hidden bg-paper">
      {/* LEFT: Black SVG Map */}
      <div className="flex-[0_0_62%] bg-ink flex flex-col">
        {/* Map Header */}
        <div className="h-[42px] flex items-center justify-between px-4 border-b border-rule text-paper">
          <span className="font-mono text-xs font-bold uppercase tracking-wider">
            Solapur — DMA Network
          </span>
          <div className="flex items-center gap-4">
            {/* Layer toggles */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showZones}
                onChange={(e) => setShowZones(e.target.checked)}
                className="sr-only"
              />
              <span className={`font-mono text-xs ${showZones ? 'text-pass' : 'text-dim'}`}>ZONES</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showPipelines}
                onChange={(e) => setShowPipelines(e.target.checked)}
                className="sr-only"
              />
              <span className={`font-mono text-xs ${showPipelines ? 'text-pass' : 'text-dim'}`}>PIPES</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showValves}
                onChange={(e) => setShowValves(e.target.checked)}
                className="sr-only"
              />
              <span className={`font-mono text-xs ${showValves ? 'text-pass' : 'text-dim'}`}>VALVES</span>
            </label>

            <div className="w-px h-4 bg-dim" />

            {/* Zoom controls */}
            <button
              onClick={zoomIn}
              className="font-mono text-xs text-paper hover:text-pass transition-colors px-1"
            >
              +
            </button>
            <button
              onClick={zoomOut}
              className="font-mono text-xs text-paper hover:text-pass transition-colors px-1"
            >
              −
            </button>
            <button
              onClick={resetView}
              className="font-mono text-xs text-dim hover:text-pass transition-colors"
            >
              RESET
            </button>
          </div>
        </div>

        {/* SVG Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            viewBox={viewBox}
            className="w-full h-full"
            style={{ backgroundColor: '#0A0A0A' }}
          >
            {/* Grid pattern */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A1A1A" strokeWidth="0.5" />
              </pattern>
            </defs>

            <rect x="0" y="0" width="600" height="600" fill="url(#grid)" />

            {/* Zone Polygons */}
            {showZones && zonePolys.map((zone) => (
              <polygon
                key={zone.id}
                points={zone.points}
                fill={zone.color + '15'}
                stroke={zone.color}
                strokeWidth="1.5"
                strokeDasharray="4 2"
                className="cursor-pointer hover:fill-opacity-30 transition-all"
                onClick={() => setSelected(zone.id)}
              />
            ))}

            {/* Pipelines */}
            {showPipelines && pipelineConnections.map((conn, i) => {
              const from = getValveCoords(conn[0])
              const to = getValveCoords(conn[1])
              if (!from || !to) return null
              const midX = (from.x + to.x) / 2
              const midY = (from.y + to.y) / 2
              const status = from.status
              const color = STATUS_COLORS[status]
              return (
                <g key={i}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={color}
                    strokeWidth="2"
                    strokeOpacity="0.6"
                  />
                  {/* Flow arrow */}
                  <polygon
                    points={`${midX - 4},${midY - 6} ${midX + 4},${midY} ${midX - 4},${midY + 6}`}
                    fill={color}
                    fillOpacity="0.8"
                  />
                </g>
              )
            })}

            {/* Valve Nodes */}
            {showValves && valves.map((valve) => {
              const color = STATUS_COLORS[valve.status]
              const isCritical = valve.status === 'crit'
              const isSelected = selected === valve.id

              return (
                <g
                  key={valve.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(valve.id)}
                >
                  {/* Pulse ring for critical valves */}
                  {isCritical && (
                    <circle
                      cx={valve.x}
                      cy={valve.y}
                      r="20"
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      className="animate-pulse"
                    />
                  )}

                  {/* Valve square */}
                  <rect
                    x={valve.x - 8}
                    y={valve.y - 8}
                    width="16"
                    height="16"
                    fill={color}
                    stroke={isSelected ? '#F5F0E8' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                  />

                  {/* Label */}
                  <text
                    x={valve.x}
                    y={valve.y + 22}
                    textAnchor="middle"
                    fill="#B8B2A8"
                    fontSize="9"
                    fontFamily="Space Mono, monospace"
                  >
                    {valve.id}
                  </text>
                </g>
              )
            })}
          </svg>
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
            <div key={i} className={`px-4 py-4 ${i % 2 === 0 ? 'border-r-2 border-rule' : ''} ${i < 2 ? 'border-b-2 border-rule' : ''}`}>
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

          {!selectedValve ? (
            <p className="font-condensed text-sm text-dim text-center py-8">
              — SELECT A VALVE NODE ON THE MAP —
            </p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-syne font-bold text-lg text-ink">{selectedValve.id}</h3>
                <span
                  className={`font-condensed text-xs font-semibold px-2 py-1 text-paper ${
                    selectedValve.status === 'crit' ? 'bg-signal' :
                    selectedValve.status === 'warn' ? 'bg-warn' :
                    selectedValve.status === 'low' ? 'bg-low' :
                    'bg-pass'
                  }`}
                >
                  {selectedValve.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Pressure',    value: ZONE_DATA[selectedValve.id].pressure },
                  { label: 'Valve',       value: ZONE_DATA[selectedValve.id].valve },
                  { label: 'AI Confidence', value: ZONE_DATA[selectedValve.id].ai },
                  { label: 'Reading',     value: ZONE_DATA[selectedValve.id].time },
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
              { color: '#E8001D', label: 'Critical' },
              { color: '#CC5500', label: 'Warning' },
              { color: '#004DB3', label: 'Low Pressure' },
              { color: '#007A3D', label: 'Normal' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-condensed text-xs text-dim">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-rule">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-dim rounded-sm" />
              <span className="font-condensed text-xs text-dim">Valve Node (square)</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-4 h-0.5 bg-pass" />
              <span className="font-condensed text-xs text-dim">Pipeline</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
