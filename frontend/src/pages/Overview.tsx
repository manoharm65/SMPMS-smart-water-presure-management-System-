import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const ZONES = [
  { id: 'DMA-01', name: 'North',      pres: 3.20, valve: 78, ai: 97, status: 'ok'   },
  { id: 'DMA-02', name: 'South',      pres: 4.80, valve: 42, ai: 88, status: 'warn' },
  { id: 'DMA-03', name: 'East',       pres: 2.10, valve: 92, ai: 82, status: 'low'  },
  { id: 'DMA-04', name: 'West',       pres: 3.50, valve: 71, ai: 99, status: 'ok'   },
  { id: 'DMA-05', name: 'Central',    pres: 6.20, valve: 18, ai: 99, status: 'crit' },
  { id: 'DMA-06', name: 'Elevated',   pres: 2.80, valve: 84, ai: 96, status: 'ok'  },
  { id: 'DMA-07', name: 'Industrial', pres: 3.90, valve: 68, ai: 98, status: 'ok'   },
  { id: 'DMA-08', name: 'Tail-end',   pres: 1.40, valve: 98, ai: 91, status: 'crit' },
]

const statusColors: Record<string, string> = {
  ok: '#007A3D',
  warn: '#CC5500',
  low: '#004DB3',
  crit: '#E8001D',
}

const DMA_OPTIONS = [
  { value: 'dma-05', label: 'DMA-05 Central' },
  { value: 'dma-08', label: 'DMA-08 Tail-end' },
  { value: 'dma-02', label: 'DMA-02 South' },
]

export default function Overview() {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<Chart | null>(null)
  const [selectedDma, setSelectedDma] = useState('dma-05')

  useEffect(() => {
    if (!chartRef.current) return

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)
    const generateData = (base: number, variance: number) =>
      hours.map(() => base + (Math.random() - 0.5) * variance)

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [
          {
            label: 'DMA-05 Central',
            data: generateData(5.8, 0.8),
            borderColor: '#E8001D',
            backgroundColor: 'rgba(232, 0, 29, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            fill: true,
          },
          {
            label: 'DMA-08 Tail-end',
            data: generateData(1.6, 0.4),
            borderColor: '#CC5500',
            backgroundColor: 'rgba(204, 85, 0, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            fill: true,
          },
          {
            label: 'DMA-02 South',
            data: generateData(4.5, 0.6),
            borderColor: '#004DB3',
            backgroundColor: 'rgba(0, 77, 179, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
              boxWidth: 12,
              padding: 8,
            },
          },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleFont: { family: 'Space Mono', size: 11 },
            bodyFont: { family: 'Space Mono', size: 10 },
            callbacks: {
              label: (context) => `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(2)} BAR`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 9 },
              color: '#6B6B6B',
              maxTicksLimit: 12,
            },
          },
          y: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 9 },
              color: '#6B6B6B',
              callback: (value) => `${value} BAR`,
            },
            min: 0,
            max: 8,
          },
        },
      },
    })

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="bg-paper min-h-screen">
      {/* Masthead Strip */}
      <div className="border-b-2 border-rule px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="font-syne font-extrabold text-[36px] text-ink leading-none">
            SYSTEM STATUS
          </h1>
          <div className="flex items-center gap-4">
            <span className="font-condensed text-[12px] text-dim">
              14 March 2026 · Solapur Municipal Corporation
            </span>
            <div className="flex items-center gap-2 px-3 py-1 border border-rule rounded-full">
              <span className="w-2 h-2 rounded-full bg-pass animate-blink" />
              <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                Live Feed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 border-b-2 border-rule">
        <div className="px-4 py-3 border-r border-rule">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Zones Online
          </div>
          <div className="font-mono text-[42px] leading-none" style={{ color: '#007A3D' }}>
            8/8
          </div>
        </div>
        <div className="px-4 py-3 border-r border-rule">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Avg Pressure
          </div>
          <div className="font-mono text-[42px] leading-none text-ink">
            3.49 BAR
          </div>
        </div>
        <div className="px-4 py-3 border-r border-rule">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Active Alerts
          </div>
          <div className="font-mono text-[42px] leading-none" style={{ color: '#E8001D' }}>
            3
          </div>
        </div>
        <div className="px-4 py-3 border-r border-rule">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Leaks Flagged
          </div>
          <div className="font-mono text-[42px] leading-none" style={{ color: '#CC5500' }}>
            1
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Valve Ops
          </div>
          <div className="font-mono text-[42px] leading-none text-ink">
            14
          </div>
        </div>
      </div>

      {/* 60/40 Split */}
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Left - Zone Table (60%) */}
        <div className="lg:col-span-3 border-r border-rule p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-[18px] text-ink">
              ALL DMA ZONES
            </h2>
            <span className="font-mono text-[14px] text-dim">
              {ZONES.length} zones
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left py-2 font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Zone
                  </th>
                  <th className="text-left py-2 font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Pressure
                  </th>
                  <th className="text-left py-2 font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Valve
                  </th>
                  <th className="text-left py-2 font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Status
                  </th>
                  <th className="text-left py-2 font-condensed text-[10px] uppercase tracking-wider text-dim">
                    AI Conf.
                  </th>
                  <th className="text-left py-2 font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {ZONES.map((zone) => (
                  <tr
                    key={zone.id}
                    className="border-b border-rule/50 hover:bg-ink hover:text-paper transition-colors duration-150"
                  >
                    <td className="py-3">
                      <div className="font-mono text-[13px] font-bold">{zone.id}</div>
                      <div className="font-condensed text-[11px] text-dim">{zone.name}</div>
                    </td>
                    <td className="py-3 font-mono text-[14px]">
                      {zone.pres.toFixed(2)} BAR
                    </td>
                    <td className="py-3 font-mono text-[14px]">
                      {zone.valve}%
                    </td>
                    <td className="py-3">
                      <span
                        className="px-2 py-0.5 font-condensed text-[10px] uppercase tracking-wider border"
                        style={{
                          color: statusColors[zone.status],
                          borderColor: statusColors[zone.status],
                        }}
                      >
                        {zone.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[14px]">
                      {zone.ai}%
                    </td>
                    <td className="py-3">
                      {zone.pres > 3.5 ? (
                        <span className="text-[16px]">↑</span>
                      ) : zone.pres < 2.5 ? (
                        <span className="text-[16px]">↓</span>
                      ) : (
                        <span className="text-[16px]">→</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right - Chart (40%) */}
        <div className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-[18px] text-ink">
              24H PRESSURE CHART
            </h2>
            <select
              value={selectedDma}
              onChange={(e) => setSelectedDma(e.target.value)}
              className="font-condensed text-[11px] px-2 py-1 border border-rule bg-paper text-ink"
            >
              {DMA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-[300px]">
            <canvas ref={chartRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
