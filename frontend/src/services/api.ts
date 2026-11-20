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

export interface MlRuntimeStatus {
  schedulerEnabled: boolean
  schedulerIntervalMs: number
  status: 'idle' | 'running' | 'ok' | 'error'
  isRunning: boolean
  lastRunAt?: string
  lastSuccessAt?: string
  lastDurationMs?: number
  lastError?: string
  inputRows?: number
  outputRows?: number
  predictionsCsvPath: string
  modelPath: string
}

export type MlSimulationScenario =
  | 'normal'
  | 'sudden_drop_no_action_supply_off'
  | 'high_flow_low_pressure'
  | 'erratic_pressure_sensor_issue'
  | 'valve_fault_signature'
  | 'construction_damage_signature'
  | 'old_pipe_degradation_signature'
  | 'all'

export interface MlSimulationInput {
  pressure?: number
  flowRate?: number
  valvePosition?: number
  supplyOn?: boolean
  constructionActivity?: boolean
  pipeAgeYears?: number
  previousValvePosition?: number
  pressureLag2?: number
  hydraulicGradeAngleDeg?: number
}

export interface MlSimulationResult {
  scenario: string
  pressure: number
  flow_rate: number
  supply_on: number
  control_action: number
  unexplained_pressure_drop: number
  prev_valve_position: number
  pressure_lag_2: number
  hydraulic_grade_angle_deg: number
  anomaly_flag: number
  anomaly_score: number
  anomaly_threshold: number
  predicted_possible_problem: string
  possible_problem_if_condition_persists: string
  ml_model_message: string
  top3_probable_problems: string
}

export interface MlSimulationMilestoneInfo {
  totalPredictions: number
  milestoneHit: boolean
  milestoneEvery: number
  milestoneValue?: number
  webAlertMessage?: string
}

export interface MlSimulationResponse {
  scenario: MlSimulationScenario
  count: number
  results: MlSimulationResult[]
  milestone?: MlSimulationMilestoneInfo
}

export interface MpcStatus {
  lastRun: string | null
  isRunning: boolean
  status: string
  logs?: string[]
  last_cycle?: any
}

// =============================================================================
// MPC Status & Actions
// =============================================================================

export async function getMpcStatus(cfg?: ApiConfig): Promise<MpcStatus> {
  return apiGet<MpcStatus>('/api/v1/mpc/status', cfg)
}

export async function runMpcNow(cfg?: ApiConfig): Promise<any> {
  return apiPost<any>('/api/v1/mpc/run', {}, cfg)
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
  return apiGet<Alert[]>(`${BASE_URL}/alerts?unacknowledged=true`, cfg)
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

export async function getMlStatus(cfg?: ApiConfig): Promise<MlRuntimeStatus> {
  return apiGet<MlRuntimeStatus>(`${BASE_URL}/ml/status`, cfg)
}

export async function runMlNow(cfg?: ApiConfig): Promise<MlRuntimeStatus> {
  return apiPost<MlRuntimeStatus>(`${BASE_URL}/ml/run`, {}, cfg)
}

export async function getMlSimulationScenarios(
  cfg?: ApiConfig
): Promise<MlSimulationScenario[]> {
  const res = await apiGet<{ scenarios: MlSimulationScenario[] }>(
    `${BASE_URL}/ml/simulate/scenarios`,
    cfg
  )
  return res.scenarios
}

export async function simulateMlCondition(
  scenario: MlSimulationScenario,
  input: MlSimulationInput,
  cfg?: ApiConfig
): Promise<MlSimulationResponse> {
  return apiPost<MlSimulationResponse>(
    `${BASE_URL}/ml/simulate`,
    { scenario, input },
    cfg
  )
}

export interface ManualAlertInput {
  nodeId: string
  riskLevel: string
  message: string
}

export interface ManualAlertResponse {
  success: boolean
}

export async function triggerManualAlert(
  input: ManualAlertInput,
  cfg?: ApiConfig
): Promise<ManualAlertResponse> {
  return apiPost<ManualAlertResponse>('/api/v1/alerts/trigger', input, cfg)
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
