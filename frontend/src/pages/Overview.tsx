import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import { getZones, getKPI, getPressureHistory, usePolling, getMpcStatus, type Zone, type KPI, type PressureHistory, type MpcStatus } from '../services/api'

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

const hardwarePipeColors: Record<string, string> = {
  crit: '#E8001D',
  warn: '#CC5500',
  low: '#D4A017',
  ok: '#007A3D',
}

function normalizeZoneId(zoneId: string) {
  return zoneId.replace(/[-_\s]/g, '').toUpperCase()
}

export default function Overview() {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<Chart | null>(null)
  const hasShownHardwarePopupRef = useRef(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [pressureHistory, setPressureHistory] = useState<PressureHistory | null>(null)
  const [selectedDma, setSelectedDma] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [mpcStatus, setMpcStatus] = useState<MpcStatus | null>(null)
  const [showHardwareDisconnectedPopup, setShowHardwareDisconnectedPopup] = useState(false)

  const hardwareConnected = useMemo(() => {
    if (!mpcStatus) return true

    const statusAny = mpcStatus as MpcStatus & {
      running?: boolean
      active_nodes?: number
      total_nodes?: number
      enabled?: boolean
      status?: string
    }

    if (typeof statusAny.active_nodes === 'number') {
      return statusAny.active_nodes > 0
    }

    if (typeof statusAny.isRunning === 'boolean') {
      return statusAny.isRunning
    }

    if (typeof statusAny.running === 'boolean') {
      return statusAny.running
    }

    const statusText = String(statusAny.status ?? '').toLowerCase()
    if (statusText.includes('offline') || statusText.includes('disconnected')) {
      return false
    }
    if (statusText.includes('connected') || statusText.includes('running') || statusText.includes('active')) {
      return true
    }

    if (typeof statusAny.total_nodes === 'number') {
      return statusAny.total_nodes > 0
    }

    return true
  }, [mpcStatus])

  const hardwareDma = useMemo(() => {
    const exact = zones.find((z) => normalizeZoneId(z.id) === 'DMA08')
    if (exact) return exact
    return zones.find((z) => normalizeZoneId(z.id).includes('DMA08')) ?? null
  }, [zones])

  const hardwareFlow = useMemo(() => {
    if (!hardwareDma) return null
    return hardwareDma.flow_rate ?? hardwareDma.flowRate ?? null
  }, [hardwareDma])

  const hardwareValve = useMemo(() => {
    if (!hardwareDma) return null
    return hardwareDma.valvePosition ?? hardwareDma.valve_position
  }, [hardwareDma])

  const hardwarePipeColor = hardwareDma ? (hardwarePipeColors[hardwareDma.status] ?? '#6B7280') : '#9CA3AF'

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

  const fetchMpc = useCallback(async () => {
    try {
      const data = await getMpcStatus()
      setMpcStatus(data)
    } catch (err) {
      console.error('Failed to fetch MPC', err)
    }
  }, [])

  const refreshData = useCallback(async () => {
    await Promise.all([fetchZones(), fetchKpi(), fetchMpc()])
    if (selectedDma) {
      await fetchPressureHistory(selectedDma)
    }
  }, [fetchZones, fetchKpi, fetchMpc, fetchPressureHistory, selectedDma])

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
    if (loading || !mpcStatus || hasShownHardwarePopupRef.current) return
    if (!hardwareConnected) {
      setShowHardwareDisconnectedPopup(true)
      hasShownHardwarePopupRef.current = true
    }
  }, [hardwareConnected, loading, mpcStatus])

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
      {showHardwareDisconnectedPopup && (
        <div className="alert-overlay-enter fixed inset-0 z-50 flex items-start justify-center bg-[radial-gradient(circle_at_top,rgba(232,0,29,0.24),rgba(10,10,10,0.72))] px-4 pt-24">
          <div className="alert-popup-enter relative w-full max-w-md overflow-hidden rounded border-2 border-[#E8001D] bg-[linear-gradient(160deg,#FFF4F4_0%,#FFE7E8_52%,#FFECEC_100%)] p-4 shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[#E8001D]" />
            <div className="font-condensed text-[10px] uppercase tracking-wider text-[#E8001D]">
              DMA-08 Hardware
            </div>
            <h2 className="mt-1 font-syne text-[22px] font-bold leading-tight text-ink">
              Hardware is not connected
            </h2>
            <p className="mt-2 font-condensed text-[12px] text-dim">
              Live hardware data is unavailable right now. Pressure logic and dashboard simulation can continue in fallback mode.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHardwareDisconnectedPopup(false)}
                className="border border-ink px-3 py-1 font-condensed text-[11px] uppercase tracking-wider text-ink hover:bg-ink hover:text-paper"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

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
            {mpcStatus && (
              <div className="flex items-center gap-2 px-3 py-1 border border-rule rounded-full bg-paper">
                <span className={`w-2 h-2 rounded-full ${mpcStatus.isRunning ? 'bg-pass' : 'bg-[#E8001D]'}`} />
                <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                  MPC {mpcStatus.isRunning ? 'Active' : 'Offline'}
                </span>
                {mpcStatus.status && (
                   <span className="font-condensed text-[10px] text-dim border-l pl-2 border-rule">Status: {mpcStatus.status}</span>
                )}
              </div>
            )}
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
            {loading ? '-' : kpi ? `${kpi.avg_pressure.toFixed(1)} BAR` : '-'}
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

          <div className="mt-5 border border-rule rounded p-4 bg-paper">
            <h3 className="font-syne font-bold text-[16px] text-ink">DMA-08 Hardware Model Link</h3>
            <div className="mt-2 space-y-1 font-mono text-[12px] text-ink">
              <div>Pressure: {hardwareDma ? `${hardwareDma.pressure.toFixed(2)} BAR` : 'N/A'}</div>
              <div>Flow: {hardwareFlow !== null ? `${Number(hardwareFlow).toFixed(1)} L/s` : 'N/A'}</div>
              <div>Valve: {hardwareValve !== null ? `${Number(hardwareValve).toFixed(0)}%` : 'N/A'}</div>
              <div>Status: {hardwareDma?.status?.toUpperCase() ?? 'UNKNOWN'}</div>
            </div>

            <div className="mt-3">
              <div className="font-condensed text-[10px] uppercase tracking-wider text-dim mb-1">Pipe State</div>
              <div className="h-2 rounded" style={{ backgroundColor: hardwarePipeColor }} />
            </div>
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
