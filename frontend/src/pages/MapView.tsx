import { useEffect, useMemo } from 'react'
import PipelineMap from '../components/map/PipelineMap'
import ZoneInspector from '../components/panels/ZoneInspector'
import { useMapData } from '../hooks/useMapData'
import { connectPressureSocket } from '../services/socket'
import { useDashboardStore } from '../store/dashboardStore'

export default function MapView() {
  useMapData()

  const upsertTelemetry = useDashboardStore((s) => s.upsertTelemetry)
  const setConnection = useDashboardStore((s) => s.setConnection)
  const selectValve = useDashboardStore((s) => s.selectValve)
  const selectPipeline = useDashboardStore((s) => s.selectPipeline)

  const wsUrl = useMemo(() => {
    const raw = (import.meta as any).env?.VITE_WS_URL as string | undefined
    return raw && raw.trim().length > 0 ? raw : undefined
  }, [])

  useEffect(() => {
    const client = connectPressureSocket({
      url: wsUrl,
      onStatus: (status) => setConnection(status),
      onEvent: (evt) => {
        upsertTelemetry(evt)
        setConnection({
          status: 'connected',
          lastMessageAt: Date.now(),
        })
      },
    })

    return () => client.close()
  }, [setConnection, upsertTelemetry, wsUrl])

  return (
    <div className="flex h-full">
      <section className="min-w-0 flex-1">
        <PipelineMap
          onValveSelect={(valveId) => selectValve(valveId)}
          onPipelineSelect={(pipelineId) => selectPipeline(pipelineId)}
        />
      </section>
      <ZoneInspector />
    </div>
  )
}
