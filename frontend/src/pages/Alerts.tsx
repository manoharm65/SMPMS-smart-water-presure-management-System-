import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAlerts, usePolling, type Alert } from '../services/api'

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

  const handleAcknowledge = (alert: Alert) => {
    console.log('Acknowledge alert:', alert.id)
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

      {/* Alert List */}
      <div className="divide-y-0">
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
                    Acknowledge
                  </button>
                  <Link
                    to={`/zones/${alert.zone_id}`}
                    className="px-4 py-2 border-2 border-rule text-ink font-condensed text-sm font-semibold uppercase tracking-wider hover:bg-ink hover:text-paper transition-colors"
                  >
                    View Zone
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
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