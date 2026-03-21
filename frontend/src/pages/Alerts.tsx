import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAlerts, setValvePosition, revertValveToAuto, usePolling, type Alert } from '../services/api'
import { useAuthStore } from '../store/authStore'

const SEV_COLORS = {
  crit: '#E8001D',
  warn: '#CC5500',
  low:  '#004DB3',
}

const FILTERS = ['ALL', 'CRITICAL', 'WARNING', 'RESOLVED'] as const
type Filter = typeof FILTERS[number]

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [isLive, setIsLive] = useState(false)
  const [selectedZone, setSelectedZone] = useState<{ zoneId: string; name: string } | null>(null)
  const [valvePosition, setValvePositionState] = useState(50)
  const [valveOperating, setValveOperating] = useState(false)
  const [valveMessage, setValveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlerts()
      setAlerts(data)
      setError(null)
      setIsLive(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  usePolling(fetchAlerts, 30000, true)

  const unackCount = alerts.filter(a => a.severity === 'crit' || a.severity === 'warn').length

  const filtered = filter === 'ALL'
    ? alerts
    : filter === 'CRITICAL'
    ? alerts.filter(a => a.severity === 'crit')
    : filter === 'WARNING'
    ? alerts.filter(a => a.severity === 'warn')
    : []

  const handleAcknowledge = async (alert: Alert) => {
    const token = useAuthStore.getState().token
    try {
      const res = await fetch(`/api/v1/alerts/${alert.id}/acknowledge`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Remove acknowledged alert from list optimistically
      setAlerts(prev => prev.filter(a => a.id !== alert.id))
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  const handleApplyValve = async () => {
    if (!selectedZone) return
    setValveOperating(true)
    setValveMessage(null)
    try {
      const res = await setValvePosition(selectedZone.zoneId, valvePosition)
      if (res.success) {
        setValveMessage({ type: 'success', text: `Valve set to ${valvePosition}%` })
      } else {
        setValveMessage({ type: 'error', text: 'Failed to set valve position' })
      }
    } catch (err) {
      setValveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Operation failed' })
    } finally {
      setValveOperating(false)
    }
  }

  const handleRevertValve = async () => {
    if (!selectedZone) return
    setValveOperating(true)
    setValveMessage(null)
    try {
      const res = await revertValveToAuto(selectedZone.zoneId)
      if (res.success) {
        setValveMessage({ type: 'success', text: 'Valve reverted to auto mode' })
      } else {
        setValveMessage({ type: 'error', text: 'Failed to revert valve' })
      }
    } catch (err) {
      setValveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Operation failed' })
    } finally {
      setValveOperating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper text-ink font-condensed flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-sm text-dim">Loading alerts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-condensed">
      {/* Editorial Header */}
      <header className="px-8 pt-10 pb-6 border-b-2 border-rule">
        <div className="flex items-baseline justify-between">
          <h1 className="font-syne font-black text-4xl tracking-tight text-ink">ALERT LOG</h1>
          <div className="flex items-center gap-2">
            {isLive && (
              <>
                <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
                <span className="font-mono text-xs text-signal font-bold">LIVE</span>
              </>
            )}
            <span className="font-mono text-sm text-dim font-bold ml-4">
              {unackCount} UNACKNOWLEDGED
            </span>
          </div>
        </div>
        <p className="font-mono text-xs text-dim mt-2">
          All DMA zones · Ordered by severity
        </p>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="px-8 py-3 bg-red-50 border-b-2 border-red-200">
          <p className="font-mono text-xs text-red-600">Error: {error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-0 px-8 border-b-2 border-rule">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-3 font-condensed text-sm font-semibold uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-ink text-paper border-b-2 border-rule'
                : 'text-dim hover:text-ink'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 65/40 Split: Alert List + Valve Control */}
      <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-rule">

        {/* Left: Alert List (65%) */}
        <div className="lg:col-span-3 divide-y-0">
          {filtered.map((alert) => {
            const color = SEV_COLORS[alert.severity as keyof typeof SEV_COLORS]
            return (
              <article
                key={alert.id}
                className="flex gap-0 px-8 py-5 border-b-2 border-rule"
              >
                {/* Vertical bar */}
                <div
                  className="w-1 self-stretch mr-5 flex-shrink-0"
                  style={{ backgroundColor: color }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <h2 className="font-syne font-bold text-lg text-ink">
                      {alert.zone_name}
                    </h2>
                    <time className="font-mono text-xs text-dim whitespace-nowrap">
                      {alert.time}
                    </time>
                  </div>

                  <p className="font-condensed text-sm leading-relaxed text-ink mb-3 max-w-3xl">
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleAcknowledge(alert)}
                      className="px-4 py-2 bg-ink text-paper font-condensed text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => setSelectedZone({ zoneId: alert.zone_id, name: alert.zone_name })}
                      className="px-4 py-2 border-2 border-rule text-ink font-condensed text-sm font-semibold uppercase tracking-wider hover:bg-ink hover:text-paper transition-colors"
                    >
                      Valve Control
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Right: Valve Control Panel (35%) */}
        <div className="lg:col-span-2 p-6 bg-white/40">
          <h2 className="font-syne font-bold text-[18px] text-ink mb-4 border-b-2 border-rule pb-2">
            VALVE CONTROL
          </h2>

          {selectedZone ? (
            <>
              <div className="mb-1 font-condensed text-[10px] uppercase tracking-wider text-dim">
                Selected Zone
              </div>
              <div className="font-syne font-bold text-[22px] text-ink mb-4">
                {selectedZone.name}
              </div>

              {/* Valve position display */}
              <div className="mb-1 font-condensed text-[10px] uppercase tracking-wider text-dim">
                Target Position
              </div>
              <div className="font-mono text-[36px] text-warn mb-2">
                {valvePosition}%
              </div>

              {/* Progress bar */}
              <div className="h-1 border border-rule mb-4">
                <div
                  className="h-full bg-warn transition-all duration-200"
                  style={{ width: `${valvePosition}%` }}
                />
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2 mb-4">
                {[18, 35, 50, 75].map((val) => (
                  <button
                    key={val}
                    onClick={() => setValvePositionState(val)}
                    className={`flex-1 py-1 font-condensed text-[12px] border transition-colors ${
                      valvePosition === val
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-paper text-ink border-rule hover:bg-ink hover:text-paper'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>

              {/* Slider */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={valvePosition}
                  onChange={(e) => setValvePositionState(parseInt(e.target.value, 10))}
                  className="w-full h-1 appearance-none cursor-pointer slider-red"
                  style={{
                    background: `linear-gradient(to right, #E8001D ${valvePosition}%, #1A1A1A ${valvePosition}%)`,
                  }}
                />
                <div className="font-mono text-[14px] text-center mt-2">{valvePosition}%</div>
              </div>

              {/* Valve message */}
              {valveMessage && (
                <div
                  className={`mb-4 p-2 font-condensed text-[12px] ${
                    valveMessage.type === 'success' ? 'bg-pass/20 text-pass' : 'bg-signal/20 text-signal'
                  }`}
                >
                  {valveMessage.text}
                </div>
              )}

              {/* Action buttons */}
              <button
                onClick={handleApplyValve}
                disabled={valveOperating}
                className="w-full py-3 bg-ink text-paper font-condensed text-[12px] uppercase tracking-wider mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {valveOperating ? 'APPLYING...' : 'Apply Override'}
              </button>
              <button
                onClick={handleRevertValve}
                disabled={valveOperating}
                className="w-full py-3 border border-rule text-ink font-condensed text-[12px] uppercase tracking-wider hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {valveOperating ? 'REVERTING...' : 'Revert to Auto Mode'}
              </button>

              <div className="mt-4 pt-4 border-t-2 border-rule">
                <Link
                  to={`/zones/${selectedZone.zoneId}`}
                  className="font-condensed text-[11px] text-dim hover:text-ink uppercase tracking-wider"
                >
                  Full Zone Detail →
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="font-condensed text-[13px] text-dim uppercase tracking-wider mb-2">
                No zone selected
              </div>
              <p className="font-condensed text-[12px] text-dim">
                Click "Valve Control" on any alert to control that zone's valve directly from here.
              </p>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="px-8 py-16 text-center">
          <p className="font-condensed text-dim text-lg">
            {filter === 'RESOLVED'
              ? 'No resolved alerts. The API only returns unresolved alerts.'
              : 'No alerts in this category.'}
          </p>
        </div>
      )}
    </div>
  )
}