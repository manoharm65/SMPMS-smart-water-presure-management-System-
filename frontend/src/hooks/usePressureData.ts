import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../services/api'

export type PressureHistoryPoint = {
  ts: string
  pressure: number
}

export function usePressureData(zoneId: string) {
  return useQuery({
    queryKey: ['pressure-history', zoneId],
    queryFn: () => apiGet<PressureHistoryPoint[]>(`/zones/${zoneId}/pressure`),
    enabled: Boolean(zoneId),
  })
}
