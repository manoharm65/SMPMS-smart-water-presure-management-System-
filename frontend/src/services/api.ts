import { useEffect, useRef } from 'react'

// =============================================================================
// Types
// =============================================================================

export type ApiConfig = {
  baseUrl?: string
  token?: string
}

export interface Zone {
  id: string
  name: string
  lat: number
  lng: number
  pressure: number
  valve_position: number
  ai_confidence: number
  status: 'ok' | 'warn' | 'low' | 'crit'
  trend: 'up' | 'down' | 'stable'
  last_reading: string
}

export interface KPI {
  zones_online: number
  zones_total: number
  avg_pressure: number
  active_alerts: number
  leaks_flagged: number
  valve_ops: number
}

export interface Alert {
  id: string
  zone_id: string
  zone_name: string
  severity: 'crit' | 'warn' | 'low'
  message: string
  time: string
}

export interface PressureReading {
  label: string
  pressure: number
}

export interface PressureHistory {
  zone_id: string
  range: '24h' | '7d'
  readings: PressureReading[]
}

export interface ZoneDetail {
  id: string
  name: string
  pressure: number
  min_today: number
  max_today: number
  avg_7d: number
  valve_position: number
  valve_mode: 'auto' | 'override'
  ai_confidence: number
  ai_recommendation: number
  ai_reason: string
  last_reading: string
}

export interface Anomaly {
  confidence: number
  severity: 'crit' | 'warn'
  message: string
  model: string
  time: string
}

export interface ValveCommandResponse {
  success: boolean
  command_id?: string
  node_id?: string
  position?: number
  dispatched_at?: string
  mode?: 'auto'
}

const defaultBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL as
  | string
  | undefined

function resolveBaseUrl(cfg?: ApiConfig) {
  const baseUrl = cfg?.baseUrl ?? defaultBaseUrl ?? ''
  return String(baseUrl).trim().replace(/\/$/, '')
}

function toUrl(path: string, cfg?: ApiConfig) {
  const baseUrl = resolveBaseUrl(cfg)
  const p = path.startsWith('/') ? path : `/${path}`
  return baseUrl ? `${baseUrl}${p}` : p
}

async function readJsonOrText(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

export async function apiGet<T>(path: string, cfg?: ApiConfig): Promise<T> {
  const res = await fetch(toUrl(path, cfg), {
    headers: {
      Accept: 'application/json',
      ...(cfg?.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    },
  })

  if (!res.ok) {
    const data: any = await readJsonOrText(res)
    throw new Error(data?.error || `API GET ${path} failed: ${res.status}`)
  }

  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown, cfg?: ApiConfig): Promise<T> {
  const res = await fetch(toUrl(path, cfg), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(cfg?.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data: any = await readJsonOrText(res)
    throw new Error(data?.error || `API POST ${path} failed: ${res.status}`)
  }

  return (await res.json()) as T
}

// =============================================================================
// Dashboard API Functions
// =============================================================================

const BASE_URL = '/api/v1/dashboard'

export async function getZones(cfg?: ApiConfig): Promise<Zone[]> {
  return apiGet<Zone[]>(`${BASE_URL}/zones`, cfg)
}

export async function getKPI(cfg?: ApiConfig): Promise<KPI> {
  return apiGet<KPI>(`${BASE_URL}/kpi`, cfg)
}

export async function getAlerts(cfg?: ApiConfig): Promise<Alert[]> {
  return apiGet<Alert[]>(`${BASE_URL}/alerts`, cfg)
}

export async function getZoneDetail(zoneId: string, cfg?: ApiConfig): Promise<ZoneDetail> {
  return apiGet<ZoneDetail>(`${BASE_URL}/zones/${zoneId}`, cfg)
}

export async function getPressureHistory(
  zoneId: string,
  range: '24h' | '7d' = '24h',
  cfg?: ApiConfig
): Promise<PressureHistory> {
  return apiGet<PressureHistory>(
    `${BASE_URL}/pressure-history/${zoneId}?range=${range}`,
    cfg
  )
}

export async function getZoneAnomalies(zoneId: string, cfg?: ApiConfig): Promise<Anomaly[]> {
  return apiGet<Anomaly[]>(`${BASE_URL}/zones/${zoneId}/anomalies`, cfg)
}

export async function setValvePosition(
  zoneId: string,
  position: number,
  cfg?: ApiConfig
): Promise<ValveCommandResponse> {
  return apiPost<ValveCommandResponse>(
    `${BASE_URL}/zones/${zoneId}/valve`,
    { position, mode: 'override' },
    cfg
  )
}

export async function revertValveToAuto(
  zoneId: string,
  cfg?: ApiConfig
): Promise<ValveCommandResponse> {
  return apiPost<ValveCommandResponse>(
    `${BASE_URL}/zones/${zoneId}/valve/revert`,
    {},
    cfg
  )
}

// =============================================================================
// Polling Hook
// =============================================================================

export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback)
  const savedInterval = useRef(intervalMs)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    savedInterval.current = intervalMs
  }, [intervalMs])

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      savedCallback.current()
    }

    const id = setInterval(tick, savedInterval.current)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
}
