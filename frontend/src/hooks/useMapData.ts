import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadMapData } from '../services/mapData'
import { useDashboardStore } from '../store/dashboardStore'

type MapUrls = {
  zonesUrl: string
  pipelinesUrl: string
  valvesUrl: string
}

function resolveMapUrls(): MapUrls {
  const env = (import.meta as any).env as Record<string, string | undefined>
  const base = env.VITE_MAP_DATA_BASE_URL?.trim()

  const zonesUrl = env.VITE_ZONES_GEOJSON_URL?.trim()
  const pipelinesUrl = env.VITE_PIPELINES_GEOJSON_URL?.trim()
  const valvesUrl = env.VITE_VALVES_GEOJSON_URL?.trim()

  if (zonesUrl && pipelinesUrl && valvesUrl) {
    return { zonesUrl, pipelinesUrl, valvesUrl }
  }

  const prefix = base && base.length > 0 ? base.replace(/\/$/, '') : ''
  return {
    zonesUrl: `${prefix}/data/kengeri/zones.geojson`,
    pipelinesUrl: `${prefix}/data/kengeri/pipelines.geojson`,
    valvesUrl: `${prefix}/data/kengeri/valves.geojson`,
  }
}

export function useMapData() {
  const setMapLayers = useDashboardStore((s) => s.setMapLayers)
  const markMapDataStatus = useDashboardStore((s) => s.setMapDataStatus)

  const urls = useMemo(() => resolveMapUrls(), [])

  const q = useQuery({
    queryKey: ['map-data', urls.zonesUrl, urls.pipelinesUrl, urls.valvesUrl],
    queryFn: () => loadMapData(urls),
    staleTime: 60 * 60 * 1000,
    retry: 0,
  })

  useEffect(() => {
    if (q.isLoading) markMapDataStatus('loading')
    if (q.isError) markMapDataStatus('error')
    if (q.isSuccess) {
      setMapLayers(q.data)
      markMapDataStatus('ready')
    }
  }, [q.isError, q.isLoading, q.isSuccess, q.data, setMapLayers, markMapDataStatus])

  return q
}
