import { useQuery } from '@tanstack/react-query'
import { getAlerts } from '../services/api'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type Alert = {
  id: string
  severity: AlertSeverity
  zoneId: string
  message: string
  timestamp: string
  aiConfidence: number
  resolved: boolean
}

export function useAlerts(filter: 'all' | 'critical' | 'warning' | 'resolved') {
  return useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => getAlerts(),
  })
}
