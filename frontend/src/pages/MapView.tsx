import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import PipelineMap from '../components/map/PipelineMap'
import ZoneInspector from '../components/panels/ZoneInspector'
import { useMapData } from '../hooks/useMapData'
import { connectPressureSocket } from '../services/socket'
import { useDashboardStore } from '../store/dashboardStore'

export default function MapView() {
  const q = useMapData()
  const upsertTelemetry = useDashboardStore((s) => s.upsertTelemetry)
  const setConnection = useDashboardStore((s) => s.setConnection)
  const selectValve = useDashboardStore((s) => s.selectValve)
  const selectPipeline = useDashboardStore((s) => s.selectPipeline)
  const zonesGeo = useDashboardStore((s) => s.zonesGeo)
  const mapDataStatus = useDashboardStore((s) => s.mapDataStatus)

  useEffect(() => {
    const env = (import.meta as any).env as Record<string, string | undefined>
    const socket = connectPressureSocket({
      url: env.VITE_PRESSURE_WS_URL,
      mockZoneIds: zonesGeo.map((z) => z.id),
      onEvent: upsertTelemetry,
      onStatus: setConnection,
    })

    return () => socket.close()
  }, [setConnection, upsertTelemetry, zonesGeo])

  return (
    <div className="flex h-full w-full overflow-hidden bg-paper">
      <div className="relative flex-1">
        {mapDataStatus === 'error' ? (
          <div className="p-4 text-sm text-text-muted">
            Failed to load map data from the data folder.
          </div>
        ) : (
          <PipelineMap onValveSelect={selectValve} onPipelineSelect={selectPipeline} />
        )}

        <div className="pointer-events-none absolute left-3 top-3 z-[600] rounded border border-border bg-panel/90 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider text-text-faint">Map data</div>
          <div className="font-mono text-xs text-text">
            {q.isLoading ? 'LOADING' : q.isError ? 'ERROR' : 'READY'}
          </div>
        </div>
      </div>

      <ZoneInspector />
    </div>
  )
}
