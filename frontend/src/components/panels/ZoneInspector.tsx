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
  const connection = useDashboardStore((s) => s.connection)
  const selectedDmaId = useDashboardStore((s) => s.selectedDmaId)
  const hardwareModeEnabled = useDashboardStore((s) => s.hardwareModeEnabled)
  const activeHardwareDmaId = useDashboardStore((s) => s.activeHardwareDmaId)
  const selectedValveId = useDashboardStore((s) => s.selectedValveId)
  const selectedPipelineId = useDashboardStore((s) => s.selectedPipelineId)
  const valves = useDashboardStore((s) => s.valves)
  const pipelines = useDashboardStore((s) => s.pipelines)
  const zones = useDashboardStore((s) => s.zones)
  const zonesGeo = useDashboardStore((s) => s.zonesGeo)

  const selectedDmaMeta = useMemo(
    () => (selectedDmaId ? zonesGeo.find((z) => z.id === selectedDmaId) : null),
    [selectedDmaId, zonesGeo],
  )

  const dmaTelemetry = selectedDmaId ? zones[selectedDmaId] : undefined

  const dmaCounts = useMemo(() => {
    if (!selectedDmaId) return null

    const dmaPipelines = pipelines.filter((p) => p.zoneId === selectedDmaId)
    const dmaValves = valves.filter((v) => v.zoneId === selectedDmaId)

    const tankLikeWords = ['tank', 'reservoir', 'esr', 'oht', 'ugr']
    const tanks = dmaValves.filter((v) => {
      const props = v.properties
      if (!props) return false
      const blob = Object.entries(props)
        .map(([k, val]) => `${k}:${String(val ?? '')}`)
        .join(' ')
        .toLowerCase()
      return tankLikeWords.some((w) => blob.includes(w))
    })

    return {
      pipelines: dmaPipelines.length,
      valves: dmaValves.length,
      tanks: tanks.length,
    }
  }, [pipelines, selectedDmaId, valves])

  const data = useMemo(() => {
    if (selectedValveId) {
      const valve = valves.find((v) => v.id === selectedValveId)
      if (!valve) return null
      const t = zones[valve.zoneId]
      return { kind: 'valve' as const, valve, telemetry: t }
    }
    if (selectedPipelineId) {
      const pipeline = pipelines.find((p) => p.id === selectedPipelineId)
      if (!pipeline) return null
      const t = zones[pipeline.zoneId]
      return { kind: 'pipeline' as const, pipeline, telemetry: t }
    }
    return null
  }, [pipelines, selectedPipelineId, selectedValveId, valves, zones])

  const properties = useMemo(() => {
    if (!data) return [] as Array<[string, string]>
    const raw = data.kind === 'valve' ? data.valve.properties : data.pipeline.properties
    if (!raw) return []
    const pairs = Object.entries(raw)
      .map(([k, v]) => {
        let value = ''
        if (v == null) value = ''
        else if (typeof v === 'string') value = v
        else if (typeof v === 'number') value = Number.isFinite(v) ? String(v) : ''
        else if (typeof v === 'boolean') value = v ? 'true' : 'false'
        else {
          try {
            value = JSON.stringify(v)
          } catch {
            value = String(v)
          }
        }
        return [k, value] as [string, string]
      })
      .filter(([, v]) => v.trim().length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
    return pairs
  }, [data])

  const hardwareModeClass = hardwareModeEnabled ? 'text-accent' : 'text-critical'
  const hardwarePanelClass = hardwareModeEnabled
    ? 'border-[rgba(0,200,150,0.35)] bg-[rgba(0,200,150,0.08)]'
    : 'border-[rgba(240,77,77,0.35)] bg-[rgba(240,77,77,0.08)]'
  const activeDmaClass = activeHardwareDmaId ? 'text-text' : 'text-warning'
  const activeDmaDotClass = activeHardwareDmaId ? 'bg-accent' : 'bg-warning'
  const socketClass =
    connection.status === 'connected'
      ? 'text-accent'
      : connection.status === 'connecting'
        ? 'text-warning'
        : 'text-critical'
  const socketDotClass =
    connection.status === 'connected'
      ? 'bg-accent'
      : connection.status === 'connecting'
        ? 'bg-warning'
        : 'bg-critical'

  return (
    <aside className="flex w-[360px] flex-col border-l border-border bg-panel">
      <div className="border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Inspector
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold text-text">
            {selectedDmaId
              ? selectedDmaMeta?.name ?? selectedDmaId
              : !data
                ? 'Select a DMA, pipeline, or asset'
                : data.kind === 'valve'
                  ? data.valve.name
                  : data.pipeline.id}
          </div>
          <div className="font-mono text-xs text-text-faint">
            {selectedDmaId
              ? selectedDmaId
              : !data
                ? '--'
                : data.kind === 'valve'
                  ? data.valve.zoneId
                  : data.pipeline.zoneId}
          </div>
        </div>
      </div>

      <div className="px-3 py-1">
        {selectedDmaId && dmaCounts ? (
          <>
            <div className="mt-2 rounded border border-border bg-bg px-2 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-text-faint">
                  DMA Focus
                </div>
                <div className="font-mono text-xs text-text">
                  {selectedDmaMeta?.id ?? selectedDmaId}
                </div>
              </div>
              <div className="mt-1 text-xs text-text-muted">{selectedDmaMeta?.name ?? 'Selected DMA'}</div>
            </div>

            <Metric label="Pipelines" value={String(dmaCounts.pipelines)} />
            <Metric label="Valves" value={String(dmaCounts.valves)} />
            <Metric label="Tanks" value={String(dmaCounts.tanks)} />
            <Metric
              label="AI Status"
              value={(dmaTelemetry?.status ?? 'unknown').toUpperCase()}
            />
            <Metric
              label="Pressure"
              value={dmaTelemetry ? `${dmaTelemetry.pressure.toFixed(2)} bar` : '--'}
            />
            <Metric
              label="Flow Rate"
              value={dmaTelemetry ? `${dmaTelemetry.flowRate.toFixed(1)} L/s` : '--'}
            />

            <div className={`mt-3 rounded border px-2 py-2 ${hardwarePanelClass}`}>
              <div className="text-[11px] uppercase tracking-wider text-text-faint">
                Hardware Mode
              </div>
              <div className={`mt-1 flex items-center gap-2 text-xs font-semibold ${hardwareModeClass}`}>
                <span className={`h-2 w-2 rounded-full ${hardwareModeEnabled ? 'bg-accent' : 'bg-critical'}`} />
                <span>Mode: {hardwareModeEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div className={`mt-1 flex items-center gap-2 text-xs ${activeDmaClass}`}>
                <span className={`h-2 w-2 rounded-full ${activeDmaDotClass}`} />
                <span>Active DMA: {activeHardwareDmaId ?? '--'}</span>
              </div>
              <div className={`mt-1 flex items-center gap-2 text-xs font-semibold ${socketClass}`}>
                <span className={`h-2 w-2 rounded-full ${socketDotClass}`} />
                <span>Socket: {connection.status.toUpperCase()}</span>
              </div>
            </div>
          </>
        ) : !data ? (
          <div className="py-3 text-sm text-text-muted">
            Click a DMA, pipeline, or asset node to inspect details.
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
              value={
                data.telemetry?.zoneName ??
                (data.kind === 'valve' ? data.valve.zoneId : data.pipeline.zoneId)
              }
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
                Properties
              </div>
              {properties.length === 0 ? (
                <div className="mt-1 text-xs text-text-muted">No properties available.</div>
              ) : (
                <div className="mt-2 max-h-[240px] space-y-1 overflow-auto pr-1">
                  {properties.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-2">
                      <div className="max-w-[160px] truncate text-[11px] text-text-faint">{k}</div>
                      <div className="max-w-[160px] truncate font-mono text-[11px] text-text">{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
