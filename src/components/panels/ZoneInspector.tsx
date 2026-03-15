import { useMemo } from 'react'
import { useDashboardStore } from '../../store/dashboardStore'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border py-2">
      <div className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div className="font-mono text-sm text-text tabular-nums">{value}</div>
    </div>
  )
}

export default function ZoneInspector() {
  const selectedValveId = useDashboardStore((s) => s.selectedValveId)
  const valves = useDashboardStore((s) => s.valves)
  const zones = useDashboardStore((s) => s.zones)

  const data = useMemo(() => {
    if (!selectedValveId) return null
    const valve = valves.find((v) => v.id === selectedValveId)
    if (!valve) return null
    const t = zones[valve.zoneId]
    return { valve, telemetry: t }
  }, [selectedValveId, valves, zones])

  return (
    <aside className="flex w-[360px] flex-col border-l border-border bg-panel">
      <div className="border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Inspector
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold text-text">
            {data ? data.valve.name : 'Select a valve'}
          </div>
          <div className="font-mono text-xs text-text-faint">
            {data ? data.valve.zoneId : '--'}
          </div>
        </div>
      </div>

      <div className="px-3 py-1">
        {!data ? (
          <div className="py-3 text-sm text-text-muted">
            Click a valve node to inspect zone telemetry.
          </div>
        ) : (
          <>
            <div className="mt-2 rounded border border-border bg-bg px-2 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-text-faint">
                  Live Snapshot
                </div>
                <div
                  className={
                    'rounded border px-2 py-1 font-mono text-[11px] tracking-wide ' +
                    (data.telemetry?.status === 'critical'
                      ? 'border-[rgba(240,77,77,0.35)] bg-[rgba(240,77,77,0.08)] text-critical'
                      : data.telemetry?.status === 'warning'
                        ? 'border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.08)] text-warning'
                        : data.telemetry?.status === 'low'
                          ? 'border-[rgba(74,159,245,0.35)] bg-[rgba(74,159,245,0.08)] text-info'
                          : 'border-[rgba(0,200,150,0.35)] bg-[rgba(0,200,150,0.08)] text-accent')
                  }
                >
                  {(data.telemetry?.status ?? 'unknown').toUpperCase()}
                </div>
              </div>
            </div>

            <Metric
              label="Zone"
              value={data.telemetry?.zoneName ?? data.valve.zoneId}
            />
            <Metric
              label="Pressure"
              value={
                data.telemetry
                  ? `${data.telemetry.pressure.toFixed(2)} bar`
                  : '--'
              }
            />
            <Metric
              label="Valve Position"
              value={
                data.telemetry
                  ? `${Math.round(data.telemetry.valvePosition)}%`
                  : '--'
              }
            />
            <Metric
              label="Flow Rate"
              value={
                data.telemetry
                  ? `${data.telemetry.flowRate.toFixed(1)} L/s`
                  : '--'
              }
            />
            <Metric
              label="AI Anomaly"
              value={
                data.telemetry
                  ? `${(data.telemetry.anomalyScore * 100).toFixed(0)}%`
                  : '--'
              }
            />

            <div className="mt-3 rounded border border-border bg-bg px-2 py-2">
              <div className="text-[11px] uppercase tracking-wider text-text-faint">
                Notes
              </div>
              <div className="mt-1 text-xs text-text-muted">
                Values update in real time from WebSocket telemetry.
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
