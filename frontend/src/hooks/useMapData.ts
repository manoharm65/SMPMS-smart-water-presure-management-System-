import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadMapData } from '../services/mapData'
import { useDashboardStore } from '../store/dashboardStore'

type MapUrls = {
  zonesUrl: string
  pipelinesUrl: string
  valvesUrl: string
  maxPipelines?: number
  maxValves?: number
}

type DatasetName = 'solapur' | 'kengeri' | 'bwssb'

function parsePositiveInt(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.floor(n)
}

function resolveMapUrls(): MapUrls {
  const env = (import.meta as any).env as Record<string, string | undefined>
  const base = env.VITE_MAP_DATA_BASE_URL?.trim()
  const datasetRaw = env.VITE_MAP_DATASET?.trim().toLowerCase() as DatasetName | undefined
  const dataset: DatasetName =
    datasetRaw === 'kengeri' || datasetRaw === 'bwssb' || datasetRaw === 'solapur'
      ? datasetRaw
      : 'solapur'

  const zonesUrl = env.VITE_ZONES_GEOJSON_URL?.trim()
  const pipelinesUrl = env.VITE_PIPELINES_GEOJSON_URL?.trim()
  const valvesUrl = env.VITE_VALVES_GEOJSON_URL?.trim()
  const maxPipelines = parsePositiveInt(env.VITE_MAP_MAX_PIPELINES)
  const maxValves = parsePositiveInt(env.VITE_MAP_MAX_VALVES)

  if (zonesUrl && pipelinesUrl && valvesUrl) {
    return { zonesUrl, pipelinesUrl, valvesUrl, maxPipelines, maxValves }
  }

  const prefix = base && base.length > 0 ? base.replace(/\/$/, '') : ''

  const defaultLimits =
    dataset === 'solapur'
      ? {
          maxPipelines: maxPipelines ?? 12000,
          maxValves: maxValves ?? 12000,
        }
      : {
          maxPipelines,
          maxValves,
        }

  return {
    zonesUrl: `${prefix}/data/${dataset}/zones.geojson`,
    pipelinesUrl: `${prefix}/data/${dataset}/pipelines.geojson`,
    valvesUrl: `${prefix}/data/${dataset}/valves.geojson`,
    ...defaultLimits,
  }
}

export function useMapData() {
  const setMapLayers = useDashboardStore((s) => s.setMapLayers)
  const markMapDataStatus = useDashboardStore((s) => s.setMapDataStatus)

  const urls = useMemo(() => resolveMapUrls(), [])

  const q = useQuery({
    queryKey: [
      'map-data',
      urls.zonesUrl,
      urls.pipelinesUrl,
      urls.valvesUrl,
      urls.maxPipelines ?? 'all',
      urls.maxValves ?? 'all',
    ],
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
