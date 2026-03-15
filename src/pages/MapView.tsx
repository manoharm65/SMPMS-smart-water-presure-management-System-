import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PipelineMap from '../components/map/PipelineMap'
import type { MapLayers } from '../components/map/MapControls'
import ZoneInspector from '../components/panels/ZoneInspector'
import { useMapData } from '../hooks/useMapData'
import { connectPressureSocket } from '../services/socket'
import { useDashboardStore } from '../store/dashboardStore'

export default function MapView() {
  useMapData()

  const navigate = useNavigate()

  const upsertTelemetry = useDashboardStore((s) => s.upsertTelemetry)
  const setConnection = useDashboardStore((s) => s.setConnection)
  const selectValve = useDashboardStore((s) => s.selectValve)
  const [layers, setLayers] = useState<MapLayers>({
    pipelines: true,
    valves: true,
    zones: true,
  })

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
          layers={layers}
          onLayersChange={setLayers}
          onValveSelect={(valveId) => selectValve(valveId)}
          onZoneSelect={(zoneId) => navigate(`/zones/${zoneId}`)}
        />
      </section>
      <ZoneInspector />
    </div>
  )
}
