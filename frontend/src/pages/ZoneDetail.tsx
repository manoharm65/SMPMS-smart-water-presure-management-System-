import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Chart, registerables } from 'chart.js'
import {
  getZoneDetail,
  getZoneAnomalies,
  getPressureHistory,
  setValvePosition,
  revertValveToAuto,
  usePolling,
} from '../services/api'
import type { ZoneDetail, Anomaly, PressureHistory } from '../services/api'

Chart.register(...registerables)

const severityColors: Record<string, string> = {
  crit: '#E8001D',
  warn: '#CC5500',
  low: '#004DB3',
}

export default function ZoneDetail() {
  const { zoneId } = useParams<{ zoneId: string }>()
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<Chart | null>(null)

  // Data state
  const [zoneData, setZoneData] = useState<ZoneDetail | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [pressureHistory, setPressureHistory] = useState<PressureHistory | null>(null)

  // Loading states
  const [loading, setLoading] = useState(true)
  const [loadingAnomalies, setLoadingAnomalies] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Valve control state
  const [valvePosition, setValvePositionState] = useState(0)
  const [valveOperating, setValveOperating] = useState(false)
  const [valveMessage, setValveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Fetch zone detail data
  const fetchZoneDetail = async () => {
    if (!zoneId) return
    try {
      const data = await getZoneDetail(zoneId)
      setZoneData(data)
      setValvePositionState(data.valve_position)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load zone data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch anomalies
  const fetchAnomalies = async () => {
    if (!zoneId) return
    try {
      const data = await getZoneAnomalies(zoneId)
      setAnomalies(data)
    } catch (err) {
      console.error('Failed to load anomalies:', err)
    } finally {
      setLoadingAnomalies(false)
    }
  }

  // Fetch pressure history
  const fetchPressureHistory = async () => {
    if (!zoneId) return
    try {
      const data = await getPressureHistory(zoneId, '7d')
      setPressureHistory(data)
    } catch (err) {
      console.error('Failed to load pressure history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (!zoneId) return
    setLoading(true)
    setLoadingAnomalies(true)
    setLoadingHistory(true)
    fetchZoneDetail()
    fetchAnomalies()
    fetchPressureHistory()
  }, [zoneId])

  // Polling for zone detail (30s interval)
  usePolling(fetchZoneDetail, 30000, true)

  // Handle Apply Override
  const handleApplyOverride = async () => {
    if (!zoneId || !zoneData) return
    setValveOperating(true)
    setValveMessage(null)
    try {
      const response = await setValvePosition(zoneId, valvePosition)
      if (response.success) {
        setValveMessage({ type: 'success', text: `Valve set to ${valvePosition}%` })
        fetchZoneDetail()
      } else {
        setValveMessage({ type: 'error', text: 'Failed to set valve position' })
      }
    } catch (err) {
      setValveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Operation failed' })
    } finally {
      setValveOperating(false)
    }
  }

  // Handle Revert to Auto
  const handleRevertToAuto = async () => {
    if (!zoneId) return
    setValveOperating(true)
    setValveMessage(null)
    try {
      const response = await revertValveToAuto(zoneId)
      if (response.success) {
        setValveMessage({ type: 'success', text: 'Valve reverted to auto mode' })
        fetchZoneDetail()
      } else {
        setValveMessage({ type: 'error', text: 'Failed to revert valve' })
      }
    } catch (err) {
      setValveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Operation failed' })
    } finally {
      setValveOperating(false)
    }
  }

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setValvePositionState(value)
  }

  // Handle preset button click
  const handlePresetClick = (value: number) => {
    setValvePositionState(value)
  }

  // Update chart when pressure history changes
  useEffect(() => {
    if (!chartRef.current || !pressureHistory || loadingHistory) return

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    const labels = pressureHistory.readings.map(r => r.label)
    const pressureData = pressureHistory.readings.map(r => r.pressure)
    const thresholdData = pressureHistory.readings.map(() => 5.5)

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Pressure (BAR)',
            data: pressureData,
            borderColor: '#E8001D',
            backgroundColor: 'rgba(232, 0, 29, 0.15)',
            borderWidth: 2.5,
            tension: 0.2,
            pointRadius: 3,
            pointBackgroundColor: '#E8001D',
            fill: true,
          },
          {
            label: 'Threshold',
            data: thresholdData,
            borderColor: '#6B6B6B',
            borderWidth: 1,
            borderDash: [5, 5],
            tension: 0,
            pointRadius: 0,
            fill: false,
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
            },
          },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleFont: { family: 'Space Mono', size: 11 },
            bodyFont: { family: 'Space Mono', size: 10 },
          },
        },
        scales: {
          x: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
            },
          },
          y: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
              callback: (value) => `${value} BAR`,
            },
            min: 0,
            max: 10,
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
  }, [pressureHistory, loadingHistory])

  // Format time from ISO string
  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return '--:--'
    }
  }

  // Determine pressure status
  const getPressureStatus = (): { color: string; label: string } => {
    if (!zoneData) return { color: '#6B6B6B', label: 'LOADING' }
    if (zoneData.pressure > 5.5) return { color: '#E8001D', label: 'OVERPRESSURE — CRITICAL' }
    if (zoneData.pressure > 5.0) return { color: '#CC5500', label: 'ELEVATED' }
    return { color: '#00A83E', label: 'NORMAL' }
  }

  const pressureStatus = getPressureStatus()

  if (loading && !zoneData) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="font-mono text-[14px] text-dim">Loading zone data...</div>
        </div>
      </div>
    )
  }

  if (error && !zoneData) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono text-[14px] text-signal mb-2">Error loading zone</div>
          <div className="font-mono text-[12px] text-dim">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-paper min-h-screen">
      {/* Top Section - Giant Pressure Display */}
      <div className="min-h-[200px] border-b-2 border-rule grid grid-cols-1 lg:grid-cols-2">
        {/* Left - Live Pressure */}
        <div className="bg-ink p-6 flex flex-col justify-between">
          <div>
            <div className="font-condensed text-[10px] uppercase tracking-widest text-dim">
              {zoneData?.name ?? 'DMA-05'} · LIVE PRESSURE
            </div>
          </div>
          <div className="my-4">
            <span
              className="font-syne font-extrabold text-[88px] leading-none"
              style={{ color: pressureStatus.color }}
            >
              {zoneData?.pressure?.toFixed(2) ?? '--'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="font-condensed text-[14px] text-muted">
              BAR · MAX THRESHOLD 5.5
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full animate-blink" style={{ backgroundColor: pressureStatus.color }} />
              <span className="font-condensed text-[11px] uppercase tracking-wider" style={{ color: pressureStatus.color }}>
                {pressureStatus.label}
              </span>
            </div>
          </div>
        </div>

        {/* Right - 6-Stat Grid */}
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              MIN TODAY
            </div>
            <div className="font-mono text-[28px] text-low">{zoneData?.min_today?.toFixed(2) ?? '--'} BAR</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              MAX TODAY
            </div>
            <div className="font-mono text-[28px] text-signal">{zoneData?.max_today?.toFixed(2) ?? '--'} BAR</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              7D AVERAGE
            </div>
            <div className="font-mono text-[28px] text-warn">{zoneData?.avg_7d?.toFixed(2) ?? '--'} BAR</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              VALVE OPEN
            </div>
            <div className="font-mono text-[28px] text-warn">{zoneData?.valve_position ?? '--'}%</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              AI CONFIDENCE
            </div>
            <div className="font-mono text-[28px] text-pass">{zoneData?.ai_confidence ?? '--'}%</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              LAST READING
            </div>
            <div className="font-mono text-[28px] text-ink">{zoneData ? formatTime(zoneData.last_reading) : '--:--'}</div>
          </div>
        </div>
      </div>

      {/* Middle Section - Valve Control + AI Log */}
      <div className="border-b-2 border-rule grid grid-cols-1 lg:grid-cols-5">
        {/* Left - Valve Control (40%) */}
        <div className="lg:col-span-2 p-5 border-r border-rule">
          <h2 className="font-syne font-bold text-[18px] text-ink mb-4">
            VALVE CONTROL
          </h2>

          <div className="mb-4">
            <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
              Current Position
            </div>
            <div className="font-mono text-[36px] text-warn">{zoneData?.valve_position ?? '--'}%</div>
            <div className="font-condensed text-[10px] text-dim mt-1">
              Mode: {zoneData?.valve_mode === 'override' ? 'MANUAL OVERRIDE' : 'AUTO'}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 border border-rule mb-4">
            <div
              className="h-full bg-warn transition-all duration-200"
              style={{ width: `${zoneData?.valve_position ?? 0}%` }}
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex gap-2 mb-4">
            {[18, 35, 50, 75].map((val) => (
              <button
                key={val}
                onClick={() => handlePresetClick(val)}
                className={`px-3 py-1 font-condensed text-[12px] border transition-colors ${
                  valvePosition === val
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-paper text-ink border-rule hover:bg-ink hover:text-paper'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>

          {/* Range Slider */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max="100"
              value={valvePosition}
              onChange={handleSliderChange}
              className="w-full h-1 appearance-none cursor-pointer slider-red"
              style={{
                background: `linear-gradient(to right, #E8001D ${valvePosition}%, #1A1A1A ${valvePosition}%)`,
              }}
            />
            <div className="font-mono text-[14px] text-center mt-2">{valvePosition}%</div>
          </div>

          {/* AI Recommendation */}
          <div className="flex items-center justify-between mb-4 p-2 border border-rule">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-dim">
              AI Recommendation
            </span>
            <span className="font-mono text-[16px] text-pass">{zoneData?.ai_recommendation ?? '--'}%</span>
          </div>

          {/* Valve operation message */}
          {valveMessage && (
            <div
              className={`mb-4 p-2 font-condensed text-[12px] ${
                valveMessage.type === 'success' ? 'bg-pass/20 text-pass' : 'bg-signal/20 text-signal'
              }`}
            >
              {valveMessage.text}
            </div>
          )}

          {/* Apply Override */}
          <button
            onClick={handleApplyOverride}
            disabled={valveOperating || zoneData?.valve_mode === 'override'}
            className="w-full py-3 bg-ink text-paper font-condensed text-[12px] uppercase tracking-wider mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {valveOperating ? 'APPLYING...' : 'Apply Override'}
          </button>

          {/* Revert to Auto */}
          <button
            onClick={handleRevertToAuto}
            disabled={valveOperating || zoneData?.valve_mode === 'auto'}
            className="w-full py-3 border border-rule text-ink font-condensed text-[12px] uppercase tracking-wider hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {valveOperating ? 'REVERTING...' : 'Revert to Auto Mode'}
          </button>
        </div>

        {/* Right - AI Anomaly Log (60%) */}
        <div className="lg:col-span-3 p-5">
          <h2 className="font-syne font-bold text-[18px] text-ink mb-4">
            AI ANOMALY LOG — ISOLATION FOREST + LSTM
          </h2>

          {loadingAnomalies ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex items-center justify-center h-32 font-mono text-[14px] text-dim">
              No anomalies detected
            </div>
          ) : (
            <div className="space-y-2">
              {anomalies.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-3 border border-rule hover:bg-ink hover:text-paper transition-colors duration-150 cursor-pointer"
                >
                  <div
                    className="font-mono text-[22px] font-bold leading-none pt-1"
                    style={{ color: severityColors[entry.severity] }}
                  >
                    {entry.confidence}%
                  </div>
                  <div className="flex-1">
                    <div className="font-condensed text-[12px]">
                      {entry.message}
                    </div>
                    <div className="font-condensed text-[10px] text-dim mt-1">
                      {entry.model} · {entry.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom - 7-Day Chart */}
      <div className="p-5">
        <h2 className="font-syne font-bold text-[18px] text-ink mb-4">
          7-DAY PRESSURE HISTORY — {zoneData?.name ?? 'DMA'}
        </h2>
        <div className="h-[250px]">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <canvas ref={chartRef} />
          )}
        </div>
      </div>
    </div>
  )
}