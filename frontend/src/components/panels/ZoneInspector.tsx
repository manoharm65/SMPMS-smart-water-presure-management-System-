import { useMemo } from 'react'
import { useDashboardStore } from '../../store/dashboardStore'

function ZoomButtons({ onZoomIn, onZoomOut }: { onZoomIn?: () => void; onZoomOut?: () => void }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className="rounded border border-border bg-bg px-2 py-1 text-xs text-text hover:bg-bg/70"
        onClick={onZoomIn}
      >
        +
      </button>
      <button
        type="button"
        className="rounded border border-border bg-bg px-2 py-1 text-xs text-text hover:bg-bg/70"
        onClick={onZoomOut}
      >
        -
      </button>
    </div>
  )
}

const DMA_ZONES = [
  { id: 'DMA-01', elevation: 520, zone: 'Low' as const, feedsInto: ['DMA-04', 'DMA-05'] },
  { id: 'DMA-02', elevation: 510, zone: 'Low' as const, feedsInto: ['DMA-05', 'DMA-06'] },
  { id: 'DMA-03', elevation: 505, zone: 'Low' as const, feedsInto: ['DMA-06'] },
  { id: 'DMA-04', elevation: 535, zone: 'Medium' as const, feedsInto: ['DMA-07', 'DMA-08'] },
  { id: 'DMA-05', elevation: 525, zone: 'Medium' as const, feedsInto: ['DMA-08', 'DMA-09'] },
  { id: 'DMA-06', elevation: 518, zone: 'Medium' as const, feedsInto: ['DMA-09'] },
  { id: 'DMA-07', elevation: 548, zone: 'Medium-High' as const, feedsInto: ['DMA-10'] },
  { id: 'DMA-08', elevation: 542, zone: 'Medium-High' as const, feedsInto: ['DMA-10', 'DMA-11'] },
  { id: 'DMA-09', elevation: 530, zone: 'Medium' as const, feedsInto: ['DMA-11', 'DMA-12'] },
  { id: 'DMA-10', elevation: 565, zone: 'High' as const, feedsInto: ['DMA-07', 'DMA-11'] },
  { id: 'DMA-11', elevation: 558, zone: 'High' as const, feedsInto: ['DMA-08', 'DMA-12'] },
  { id: 'DMA-12', elevation: 545, zone: 'Medium-High' as const, feedsInto: ['DMA-09'] },
]

function getZoneEmoji(zone: string): string {
  const emojis: Record<string, string> = {
    High: '⬆️',
    'Medium-High': '↗️',
    Medium: '➡️',
    Low: '↘️',
  }
  return emojis[zone] ?? ''
}

function getFlowDirection(zone: string): string {
  const directions: Record<string, string> = {
    High: 'Upward',
    'Medium-High': 'Up-Right',
    Medium: 'Right',
    Low: 'Down-Right',
  }
  return directions[zone] ?? '--'
}

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
    <div className="mt-2 rounded border border-border bg-bg">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg/50"
      >
        <span className="text-[11px] uppercase tracking-wider text-text-faint">{title}</span>
        <span
          className={`text-text-faint transition-transform duration-200 ${
            isOpen ? 'rotate-90' : 'rotate-0'
          }`}
        >
          ‣
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  )
}

export default function ZoneInspector() {
  const connection = useDashboardStore((s) => s.connection)
  const mapMode = useDashboardStore((s) => s.mapMode)
  const setMapMode = useDashboardStore((s) => s.setMapMode)
  const inspectorSection = useDashboardStore((s) => s.inspectorSection)
  const setInspectorSection = useDashboardStore((s) => s.setInspectorSection)
  const selectedHardwareDmaId = useDashboardStore((s) => s.selectedHardwareDmaId)
  const setSelectedHardwareDmaId = useDashboardStore((s) => s.setSelectedHardwareDmaId)
  const selectDma = useDashboardStore((s) => s.selectDma)
  const selectedDmaId = useDashboardStore((s) => s.selectedDmaId)
  const hardwareModeEnabled = useDashboardStore((s) => s.hardwareModeEnabled)
  const activeHardwareDmaId = useDashboardStore((s) => s.activeHardwareDmaId)
  const selectedValveId = useDashboardStore((s) => s.selectedValveId)
  const selectedPipelineId = useDashboardStore((s) => s.selectedPipelineId)
  const valves = useDashboardStore((s) => s.valves)
  const pipelines = useDashboardStore((s) => s.pipelines)
  const zones = useDashboardStore((s) => s.zones)
  const zonesGeo = useDashboardStore((s) => s.zonesGeo)

  const activeDma = useMemo(
    () => DMA_ZONES.find((d) => d.id === selectedHardwareDmaId) ?? DMA_ZONES[0],
    [selectedHardwareDmaId],
  )

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

  const handleMapsToggle = () => {
    setInspectorSection(inspectorSection === 'maps' ? null : 'maps')
  }

  const handlePropertiesToggle = () => {
    setInspectorSection(inspectorSection === 'properties' ? null : 'properties')
  }

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

      <div className="flex-1 overflow-auto px-3 py-1">
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
              <div className="mt-1 text-xs text-text-muted">
                {selectedDmaMeta?.name ?? 'Selected DMA'}
              </div>
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

            <div className="mt-3 rounded border border-border bg-bg px-2 py-2">
              <div className="text-[11px] uppercase tracking-wider text-text-faint">
                Hardware Mode
              </div>
              <div className="mt-1 text-xs text-text-muted">
                Mode: {hardwareModeEnabled ? 'ON' : 'OFF'}
              </div>
              <div className="mt-1 text-xs text-text-muted">
                Active DMA: {activeHardwareDmaId ?? '--'}
              </div>
              <div className="mt-1 text-xs text-text-muted">
                Socket: {connection.status.toUpperCase()}
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
          </>
        )}

        <CollapsibleSection
          title="Maps"
          isOpen={inspectorSection === 'maps'}
          onToggle={handleMapsToggle}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-faint">Map View</span>
            </div>

            <div className="border-t border-border pt-2">
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Layers</div>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg/50">
                <span className="text-xs text-text-muted">Base Map</span>
                <input
                  type="radio"
                  checked={mapMode === 'map'}
                  onChange={() => setMapMode('map')}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg/50">
                <span className="text-xs text-text-muted">Map + DMA Labels</span>
                <input
                  type="radio"
                  checked={mapMode === 'dma'}
                  onChange={() => setMapMode('dma')}
                />
              </label>
            </div>

            <div className="text-[10px] text-text-faint border-t border-border pt-2">
              Auto DMA zones are generated from network density.
            </div>

            {mapMode === 'dma' && (
              <div className="mt-3 rounded border border-border bg-bg p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">
                  Hardware Link
                </div>
                <select
                  className="mt-2 w-full rounded border border-border bg-panel px-2 py-1.5 text-sm text-text"
                  value={selectedHardwareDmaId}
                  onChange={(e) => {
                    setSelectedHardwareDmaId(e.target.value)
                    selectDma(e.target.value)
                  }}
                >
                  {DMA_ZONES.map((dma) => (
                    <option key={dma.id} value={dma.id}>
                      {dma.id}
                    </option>
                  ))}
                </select>

                <div className="mt-2 space-y-1 rounded bg-bg p-2">
                  <div className="flex justify-between">
                    <span className="text-[11px] text-text-faint">Selected:</span>
                    <span className="font-mono text-xs text-text">
                      {selectedHardwareDmaId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-text-faint">Elevation:</span>
                    <span className="font-mono text-xs text-text">
                      {activeDma?.elevation ?? '--'}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-text-faint">Zone:</span>
                    <span className="font-mono text-xs text-text">
                      {activeDma?.zone} {getZoneEmoji(activeDma?.zone ?? 'Medium')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-text-faint">Flow:</span>
                    <span className="font-mono text-xs text-text">
                      {getFlowDirection(activeDma?.zone ?? 'Medium')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-text-faint">Feeds into:</span>
                    <span className="font-mono text-xs text-text">
                      {activeDma?.feedsInto.join(', ') ?? '--'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {data && (
          <CollapsibleSection
            title="Properties"
            isOpen={inspectorSection === 'properties'}
            onToggle={handlePropertiesToggle}
          >
            {properties.length === 0 ? (
              <div className="mt-1 text-xs text-text-muted">
                No properties available.
              </div>
            ) : (
              <div className="mt-2 max-h-[240px] space-y-1 overflow-auto pr-1">
                {properties.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <div className="max-w-[160px] truncate text-[11px] text-text-faint">
                      {k}
                    </div>
                    <div className="max-w-[160px] truncate font-mono text-[11px] text-text">
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        )}

        {data && (
          <div className="mt-3 rounded border border-border bg-bg px-3 py-2">
            <div className="text-[11px] uppercase tracking-wider text-text-faint">
              Notes
            </div>
            <div className="mt-1 text-xs text-text-muted">
              Values update in real time from WebSocket telemetry.
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}