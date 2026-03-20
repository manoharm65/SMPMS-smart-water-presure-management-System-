import { useState } from 'react'

const ALERTS = [
  { id:1, zone:'DMA-05 Central',    sev:'crit', msg:'Overpressure sustained — 6.20 bar exceeds 5.5 bar hard limit. Valve throttled to 18%. Pressure still rising.',      pres:'6.20', ai:'99%', time:'14:28:41' },
  { id:2, zone:'DMA-08 Tail-end',   sev:'crit', msg:'Pressure drop anomaly detected. Suspected pipe leak. Estimated loss 0.3 L/s. Field inspection required immediately.', pres:'1.40', ai:'91%', time:'14:15:03' },
  { id:3, zone:'DMA-02 South',      sev:'warn', msg:'Elevated reading — 4.80 bar above soft limit of 4.5 bar. Valve throttled from 65% to 42%.',                          pres:'4.80', ai:'88%', time:'13:52:17' },
  { id:4, zone:'DMA-01 North',      sev:'res',  msg:'Pressure stabilised. Returned to 3.20 bar within normal range after auto valve adjustment.',                          pres:'3.20', ai:'94%', time:'11:22:30' },
  { id:5, zone:'DMA-07 Industrial', sev:'res',  msg:'Supply interruption resolved after valve reset. Pressure normalised over 14 minutes.',                               pres:'3.90', ai:'97%', time:'09:05:14' },
]

const SEV_COLORS = {
  crit: '#E8001D',
  warn: '#CC5500',
  res:  '#007A3D',
  low:  '#004DB3',
}

const FILTERS = ['ALL', 'CRITICAL', 'WARNING', 'RESOLVED'] as const
type Filter = typeof FILTERS[number]

export default function Alerts() {
  const [filter, setFilter] = useState<Filter>('ALL')

  const unackCount = ALERTS.filter(a => a.sev === 'crit' || a.sev === 'warn').length

  const filtered = filter === 'ALL'
    ? ALERTS
    : filter === 'CRITICAL'
    ? ALERTS.filter(a => a.sev === 'crit')
    : filter === 'WARNING'
    ? ALERTS.filter(a => a.sev === 'warn')
    : ALERTS.filter(a => a.sev === 'res')

  return (
    <div className="min-h-screen bg-paper text-ink font-condensed">
      {/* Editorial Header */}
      <header className="px-8 pt-10 pb-6 border-b-2 border-rule">
        <div className="flex items-baseline justify-between">
          <h1 className="font-syne font-black text-4xl tracking-tight text-ink">ALERT LOG</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
            <span className="font-mono text-sm text-signal font-bold">
              {unackCount} UNACKNOWLEDGED
            </span>
          </div>
        </div>
        <p className="font-mono text-xs text-dim mt-2">
          14 March 2026 · All DMA zones · Ordered by severity
        </p>
      </header>

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
          const color = SEV_COLORS[alert.sev as keyof typeof SEV_COLORS]
          const isResolved = alert.sev === 'res'
          return (
            <article
              key={alert.id}
              className={`flex gap-0 px-8 py-5 border-b-2 border-rule ${
                isResolved ? 'opacity-50' : ''
              }`}
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
                    {alert.zone}
                  </h2>
                  <time className="font-mono text-xs text-dim whitespace-nowrap">
                    {alert.time} IST
                  </time>
                </div>

                <p className="font-condensed text-sm leading-relaxed text-ink mb-3 max-w-3xl">
                  {alert.msg}
                </p>

                <div className="flex items-center gap-6 mb-4">
                  <div>
                    <span className="font-condensed text-xs text-dim uppercase tracking-wider block">Pressure</span>
                    <span className="font-mono text-sm font-bold" style={{ color }}>{alert.pres} BAR</span>
                  </div>
                  <div>
                    <span className="font-condensed text-xs text-dim uppercase tracking-wider block">AI Confidence</span>
                    <span className="font-mono text-sm text-ink">{alert.ai}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!isResolved && (
                    <button className="px-4 py-2 bg-ink text-paper font-condensed text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity">
                      Acknowledge
                    </button>
                  )}
                  <button className="px-4 py-2 border-2 border-rule text-ink font-condensed text-sm font-semibold uppercase tracking-wider hover:bg-ink hover:text-paper transition-colors">
                    View Zone
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="px-8 py-16 text-center">
          <p className="font-condensed text-dim text-lg">No alerts in this category.</p>
        </div>
      )}
    </div>
  )
}
