import { useQuery } from '@tanstack/react-query'
import { getPressureHistory } from '../services/api'

export type PressureHistoryPoint = {
  ts: string
  pressure: number
}

export function usePressureData(zoneId: string) {
  return useQuery({
    queryKey: ['pressure-history', zoneId],
    queryFn: () => getPressureHistory(zoneId, '24h'),
    enabled: Boolean(zoneId),
  })
}
