import { useEffect, useRef, useState, useCallback } from 'react'
import { Chart, registerables } from 'chart.js'
import { getZones, getKPI, getPressureHistory, usePolling, type Zone, type KPI, type PressureHistory } from '../services/api'

Chart.register(...registerables)

const statusColors: Record<string, string> = {
  ok: '#007A3D',
  warn: '#CC5500',
  low: '#004DB3',
  crit: '#E8001D',
}

const trendIcons: Record<string, string> = {
  up: '↑',
  down: '↓',
  stable: '→',
}

export default function Overview() {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<Chart | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [pressureHistory, setPressureHistory] = useState<PressureHistory | null>(null)
  const [selectedDma, setSelectedDma] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const fetchZones = useCallback(async () => {
    try {
      const data = await getZones()
      setZones(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch zones')
    }
  }, [])

  const fetchKpi = useCallback(async () => {
    try {
      const data = await getKPI()
      setKpi(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KPI')
    }
  }, [])

  const fetchPressureHistory = useCallback(async (zoneId: string) => {
    setChartLoading(true)
    try {
      const data = await getPressureHistory(zoneId, '24h')
      setPressureHistory(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pressure history')
    } finally {
      setChartLoading(false)
    }
  }, [])

  const refreshData = useCallback(async () => {
    await Promise.all([fetchZones(), fetchKpi()])
    if (selectedDma) {
      await fetchPressureHistory(selectedDma)
    }
  }, [fetchZones, fetchKpi, fetchPressureHistory, selectedDma])

  usePolling(refreshData, 30000, !loading)

  useEffect(() => {
    refreshData().finally(() => setLoading(false))
  }, [refreshData])

  useEffect(() => {
    if (zones.length > 0 && !selectedDma) {
      const firstZone = zones[0]
      const zoneIdLower = firstZone.id.toLowerCase()
      setSelectedDma(zoneIdLower)
    }
  }, [zones, selectedDma])

  useEffect(() => {
    if (selectedDma) {
      fetchPressureHistory(selectedDma)
    }
  }, [selectedDma, fetchPressureHistory])

  useEffect(() => {
    if (!chartRef.current || !pressureHistory) return

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    const labels = pressureHistory.readings.map(r => r.label)
    const data = pressureHistory.readings.map(r => r.pressure)
    const selectedZone = zones.find(z => z.id.toLowerCase() === selectedDma)
    const zoneLabel = selectedZone ? `${selectedZone.id} ${selectedZone.name}` : selectedDma

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: zoneLabel,
            data,
            borderColor: '#E8001D',
            backgroundColor: 'rgba(232, 0, 29, 0.1)',
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
  }, [pressureHistory, selectedDma, zones])

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
            {loading ? '-' : kpi ? `${kpi.zones_online}/${kpi.zones_total}` : '-'}
          </div>
        </div>
        <div className="px-4 py-3 border-r border-rule">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Avg Pressure
          </div>
          <div className="font-mono text-[42px] leading-none text-ink">
            {loading ? '-' : kpi ? `${kpi.avg_pressure.toFixed(2)} BAR` : '-'}
          </div>
        </div>
        <div className="px-4 py-3 border-r border-rule">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Active Alerts
          </div>
          <div className="font-mono text-[42px] leading-none" style={{ color: '#E8001D' }}>
            {loading ? '-' : kpi ? kpi.active_alerts : '-'}
          </div>
        </div>
        <div className="px-4 py-3 border-r border-rule">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Leaks Flagged
          </div>
          <div className="font-mono text-[42px] leading-none" style={{ color: '#CC5500' }}>
            {loading ? '-' : kpi ? kpi.leaks_flagged : '-'}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
            Valve Ops
          </div>
          <div className="font-mono text-[42px] leading-none text-ink">
            {loading ? '-' : kpi ? kpi.valve_ops : '-'}
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
              {loading ? '-' : zones.length} zones
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
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center font-condensed text-[12px] text-dim">
                      Loading zones...
                    </td>
                  </tr>
                ) : zones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center font-condensed text-[12px] text-dim">
                      No zones available
                    </td>
                  </tr>
                ) : (
                  zones.map((zone) => (
                    <tr
                      key={zone.id}
                      className="border-b border-rule/50 hover:bg-ink hover:text-paper transition-colors duration-150"
                    >
                      <td className="py-3">
                        <div className="font-mono text-[13px] font-bold">{zone.id}</div>
                        <div className="font-condensed text-[11px] text-dim">{zone.name}</div>
                      </td>
                      <td className="py-3 font-mono text-[14px]">
                        {zone.pressure.toFixed(2)} BAR
                      </td>
                      <td className="py-3 font-mono text-[14px]">
                        {zone.valve_position}%
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
                        {zone.ai_confidence}%
                      </td>
                      <td className="py-3">
                        <span className="text-[16px]">{trendIcons[zone.trend] || '→'}</span>
                      </td>
                    </tr>
                  ))
                )}
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
              disabled={loading}
            >
              {zones.map((zone) => (
                <option key={zone.id.toLowerCase()} value={zone.id.toLowerCase()}>
                  {zone.id} {zone.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-[300px] relative">
            {chartLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-paper/80 z-10">
                <span className="font-condensed text-[12px] text-dim">Loading chart...</span>
              </div>
            )}
            <canvas ref={chartRef} />
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-ink text-paper border border-rule rounded">
          <div className="font-condensed text-[11px] uppercase tracking-wider text-ink">
            Error
          </div>
          <div className="font-mono text-[12px]">{error}</div>
        </div>
      )}
    </div>
  )
}
