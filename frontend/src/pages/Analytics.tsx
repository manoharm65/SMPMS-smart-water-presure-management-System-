import { useEffect, useRef } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  ScatterController,
  PointElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  ScatterController,
  PointElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
)

const ZONES = ['DMA-01', 'DMA-02', 'DMA-03', 'DMA-04', 'DMA-05', 'DMA-06', 'DMA-07', 'DMA-08']

const ZONE_STATUS: Record<string, string> = {
  'DMA-01': 'ok',
  'DMA-02': 'low',
  'DMA-03': 'ok',
  'DMA-04': 'warn',
  'DMA-05': 'crit',
  'DMA-06': 'ok',
  'DMA-07': 'ok',
  'DMA-08': 'crit',
}

const STATUS_COLORS: Record<string, string> = {
  ok:   '#007A3D',
  warn: '#CC5500',
  low:  '#004DB3',
  crit: '#E8001D',
}

const PRESSURE_DATA = [3.2, 4.8, 2.9, 4.5, 6.2, 3.5, 3.1, 1.4]
const VALVE_DATA = [42, 65, 38, 71, 18, 55, 45, 82]

const HEATMAP_DATA: number[][] = [
  [3.2, 3.4, 3.1, 2.9, 3.0, 3.3, 3.5, 3.2],
  [3.5, 4.1, 4.8, 4.2, 3.9, 3.6, 3.4, 3.3],
  [2.8, 3.2, 3.5, 3.1, 2.9, 3.0, 3.2, 3.4],
  [4.5, 4.2, 4.0, 4.5, 4.8, 4.3, 4.1, 4.0],
  [6.2, 5.8, 5.5, 5.2, 4.9, 4.7, 4.5, 4.3],
  [3.3, 3.5, 3.6, 3.4, 3.2, 3.5, 3.7, 3.9],
  [3.0, 3.1, 3.2, 3.0, 2.9, 3.1, 3.3, 3.5],
  [1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8],
]

function getHeatmapColor(value: number): string {
  if (value <= 2.0) return '#004DB3'
  if (value <= 3.0) return '#007A3D'
  if (value <= 4.5) return '#CC5500'
  return '#E8001D'
}

const PATTERNS = [
  { pattern: 'Morning Peak Surge',     freq: 'Daily (06:00-09:00)',  zones: 'DMA-02, DMA-04', severity: 'Warning' },
  { pattern: 'Night Flow Anomaly',      freq: 'Weekly (Mon/Thu)',     zones: 'DMA-05, DMA-08', severity: 'Critical' },
  { pattern: 'Valve Override Event',    freq: '3x this week',         zones: 'DMA-01, DMA-07', severity: 'Info' },
  { pattern: 'Pressure Oscillation',   freq: 'Bi-weekly',            zones: 'DMA-03, DMA-06', severity: 'Low' },
]

export default function Analytics() {
  const barRef = useRef<HTMLCanvasElement>(null)
  const scatterRef = useRef<HTMLCanvasElement>(null)
  const barChartRef = useRef<Chart | null>(null)
  const scatterChartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!barRef.current) return
    if (barChartRef.current) barChartRef.current.destroy()

    const ctx = barRef.current.getContext('2d')
    if (!ctx) return

    const colors = ZONES.map(z => STATUS_COLORS[ZONE_STATUS[z]])

    barChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ZONES,
        datasets: [{
          label: 'Pressure (bar)',
          data: PRESSURE_DATA,
          backgroundColor: colors.map(c => c + '33'),
          borderColor: colors,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleFont: { family: 'Space Mono' },
            bodyFont: { family: 'Space Mono' },
          }
        },
        scales: {
          x: {
            grid: { color: '#B8B2A8' },
            ticks: { font: { family: 'Space Mono', size: 10 }, color: '#6B6B6B' }
          },
          y: {
            grid: { color: '#B8B2A8' },
            ticks: { font: { family: 'Space Mono', size: 10 }, color: '#6B6B6B' },
            min: 0,
            max: 8,
          }
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!scatterRef.current) return
    if (scatterChartRef.current) scatterChartRef.current.destroy()

    const ctx = scatterRef.current.getContext('2d')
    if (!ctx) return

    const scatterColors = ZONES.map(z => STATUS_COLORS[ZONE_STATUS[z]])

    scatterChartRef.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Zone',
          data: ZONES.map((_, i) => ({ x: VALVE_DATA[i], y: PRESSURE_DATA[i] })),
          backgroundColor: scatterColors.map(c => c + '33'),
          borderColor: scatterColors,
          borderWidth: 2,
          pointStyle: 'rect',
          pointRadius: 16,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleFont: { family: 'Space Mono' },
            bodyFont: { family: 'Space Mono' },
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex
                return `${ZONES[idx]} — Valve: ${VALVE_DATA[idx]}%, Pressure: ${PRESSURE_DATA[idx]} bar`
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'VALVE %', font: { family: 'Space Mono', size: 10 }, color: '#6B6B6B' },
            grid: { color: '#B8B2A8' },
            ticks: { font: { family: 'Space Mono', size: 10 }, color: '#6B6B6B' },
            min: 0,
            max: 100,
          },
          y: {
            title: { display: true, text: 'PRESSURE (bar)', font: { family: 'Space Mono', size: 10 }, color: '#6B6B6B' },
            grid: { color: '#B8B2A8' },
            ticks: { font: { family: 'Space Mono', size: 10 }, color: '#6B6B6B' },
            min: 0,
            max: 8,
          }
        }
      }
    })
  }, [])

  return (
    <div className="min-h-screen bg-paper text-ink font-condensed">
      {/* Header */}
      <header className="px-8 pt-10 pb-6 border-b-2 border-rule">
        <div className="flex items-baseline justify-between">
          <h1 className="font-syne font-black text-4xl tracking-tight text-ink">ANALYTICS</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pass animate-pulse" />
            <span className="font-mono text-xs text-pass font-bold uppercase">Live</span>
          </div>
        </div>
      </header>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 border-b-2 border-rule">
        {[
          { label: 'AVG PRESSURE',  value: '3.49 BAR' },
          { label: 'CRITICAL ZONES', value: '2' },
          { label: 'SUSPECTED LEAKS', value: '1' },
          { label: 'VALVE OVERRIDES',value: '3' },
          { label: '24H UPTIME',     value: '98.2%' },
        ].map((kpi, i) => (
          <div key={i} className="px-6 py-5 border-r-2 border-rule last:border-r-0">
            <span className="font-condensed text-xs text-dim uppercase tracking-wider block mb-1">
              {kpi.label}
            </span>
            <span className="font-mono text-xl font-bold text-ink">{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-12 border-b-2 border-rule">
        {/* Bar Chart */}
        <div className="col-span-7 p-6 border-r-2 border-rule">
          <h2 className="font-syne font-bold text-lg text-ink mb-4">PRESSURE BY ZONE</h2>
          <div className="h-64">
            <canvas ref={barRef} />
          </div>
        </div>

        {/* Scatter Chart */}
        <div className="col-span-5 p-6">
          <h2 className="font-syne font-bold text-lg text-ink mb-4">VALVE vs PRESSURE</h2>
          <div className="h-64">
            <canvas ref={scatterRef} />
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="p-6 border-b-2 border-rule">
        <h2 className="font-syne font-bold text-lg text-ink mb-4">PRESSURE HEATMAP — 24H</h2>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-16 flex-shrink-0" />
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="w-14 text-center font-mono text-xs text-dim">
                  {`${i * 3}h`}
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {HEATMAP_DATA.map((row, rowIdx) => (
              <div key={rowIdx} className="flex mb-1">
                <div className="w-16 flex-shrink-0 font-mono text-xs text-dim flex items-center">
                  {ZONES[rowIdx]}
                </div>
                {row.map((value, colIdx) => (
                  <div
                    key={colIdx}
                    className="w-14 h-10 flex items-center justify-center font-mono text-xs font-bold mx-0.5"
                    style={{
                      backgroundColor: getHeatmapColor(value),
                      color: '#F5F0E8',
                    }}
                  >
                    {value.toFixed(1)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap legend */}
        <div className="flex items-center gap-4 mt-4">
          <span className="font-condensed text-xs text-dim">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4" style={{ backgroundColor: '#004DB3' }} />
            <span className="font-mono text-xs text-dim">Low (&lt;2.0)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4" style={{ backgroundColor: '#007A3D' }} />
            <span className="font-mono text-xs text-dim">Normal (2-3)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4" style={{ backgroundColor: '#CC5500' }} />
            <span className="font-mono text-xs text-dim">Warning (3-4.5)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4" style={{ backgroundColor: '#E8001D' }} />
            <span className="font-mono text-xs text-dim">Critical (&gt;4.5)</span>
          </div>
        </div>
      </div>

      {/* Pattern Analysis */}
      <div className="p-6">
        <h2 className="font-syne font-bold text-lg text-ink mb-4">PATTERN ANALYSIS</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-rule">
              <th className="text-left py-3 px-4 font-condensed text-sm font-semibold text-dim uppercase tracking-wider">Pattern</th>
              <th className="text-left py-3 px-4 font-condensed text-sm font-semibold text-dim uppercase tracking-wider">Frequency</th>
              <th className="text-left py-3 px-4 font-condensed text-sm font-semibold text-dim uppercase tracking-wider">Zones Affected</th>
              <th className="text-left py-3 px-4 font-condensed text-sm font-semibold text-dim uppercase tracking-wider">Severity</th>
            </tr>
          </thead>
          <tbody>
            {PATTERNS.map((p, i) => (
              <tr key={i} className="border-b border-rule">
                <td className="py-3 px-4 font-condensed text-sm text-ink">{p.pattern}</td>
                <td className="py-3 px-4 font-mono text-xs text-dim">{p.freq}</td>
                <td className="py-3 px-4 font-mono text-xs text-dim">{p.zones}</td>
                <td className="py-3 px-4">
                  <span className={`font-condensed text-xs font-semibold px-2 py-1 ${
                    p.severity === 'Critical' ? 'bg-signal text-paper' :
                    p.severity === 'Warning' ? 'bg-warn text-paper' :
                    p.severity === 'Low' ? 'bg-low text-paper' :
                    'bg-muted text-ink'
                  }`}>
                    {p.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
