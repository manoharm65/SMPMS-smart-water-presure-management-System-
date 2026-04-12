import { useMemo, useState } from 'react'
import { useMapData } from '../../hooks/useMapData'
import { useDashboardStore } from '../../store/dashboardStore'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-rule py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="font-mono text-sm text-paper tabular-nums">{value}</div>
    </div>
  )
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-rule">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-ink/50"
      >
        <div className="text-[11px] uppercase tracking-wider text-muted">
          {title}
        </div>
        <div
          className={`text-paper transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        >
          ▸
        </div>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

export default function ZoneInspector() {
  const q = useMapData()
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

  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [mapsOpen, setMapsOpen] = useState(true)

  const handlePropertiesToggle = () => {
    setPropertiesOpen(!propertiesOpen)
    if (!propertiesOpen) setMapsOpen(false)
  }

  const handleMapsToggle = () => {
    setMapsOpen(!mapsOpen)
    if (!mapsOpen) setPropertiesOpen(false)
  }

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

  return (
    <aside className="flex w-[360px] flex-col border-l border-rule bg-ink">
      <div className="border-b border-rule px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-muted">
          Inspector
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold text-paper">
            {selectedDmaId
              ? selectedDmaMeta?.name ?? selectedDmaId
              : !data
                ? 'Select a DMA, pipeline, or asset'
                : data.kind === 'valve'
                  ? data.valve.name
                  : data.pipeline.id}
          </div>
          <div className="font-mono text-xs text-muted">
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

      <CollapsibleSection
        title="Maps"
        isOpen={mapsOpen}
        onToggle={handleMapsToggle}
      >
        <div className="rounded border border-rule bg-bg px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted">
              Map data
            </div>
            <div
              className={`rounded border px-2 py-1 font-mono text-[11px] tracking-wide ${
                q.isLoading
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : q.isError
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-accent/50 bg-accent/10 text-accent'
              }`}
            >
              {q.isLoading ? 'LOADING' : q.isError ? 'ERROR' : 'READY'}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <div className="overflow-auto flex-1 px-3 py-1">
        {selectedDmaId && dmaCounts ? (
          <>
            <div className="mt-2 rounded border border-rule bg-bg px-2 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted">
                  DMA Focus
                </div>
                <div className="font-mono text-xs text-paper">
                  {selectedDmaMeta?.id ?? selectedDmaId}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted">{selectedDmaMeta?.name ?? 'Selected DMA'}</div>
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

            <div className="mt-3 rounded border border-rule bg-bg px-2 py-2">
              <div className="text-[11px] uppercase tracking-wider text-muted">
                Hardware Mode
              </div>
              <div className="mt-1 text-xs text-muted">
                Mode: {hardwareModeEnabled ? 'ON' : 'OFF'}
              </div>
              <div className="mt-1 text-xs text-muted">
                Active DMA: {activeHardwareDmaId ?? '--'}
              </div>
              <div className="mt-1 text-xs text-muted">
                Socket: {connection.status.toUpperCase()}
              </div>
            </div>
          </>
        ) : !data ? (
          <div className="py-3 text-sm text-muted">
            Click a DMA, pipeline, or asset node to inspect details.
          </div>
        ) : (
          <>
            <div className="mt-2 rounded border border-rule bg-bg px-2 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted">
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

            <CollapsibleSection
              title="Properties"
              isOpen={propertiesOpen}
              onToggle={handlePropertiesToggle}
            >
              <div className="rounded border border-rule bg-bg px-2 py-2">
              {properties.length === 0 ? (
                <div className="text-xs text-muted">No properties available.</div>
              ) : (
                <div className="mt-2 max-h-[240px] space-y-1 overflow-auto pr-1">
                  {properties.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-2">
                      <div className="max-w-[160px] truncate text-[11px] text-muted">{k}</div>
                      <div className="max-w-[160px] truncate font-mono text-[11px] text-paper">{v}</div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </CollapsibleSection>

            <div className="mt-3 rounded border border-rule bg-bg px-2 py-2">
              <div className="text-[11px] uppercase tracking-wider text-muted">
                Notes
              </div>
              <div className="mt-1 text-xs text-muted">
                Values update in real time from WebSocket telemetry.
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
