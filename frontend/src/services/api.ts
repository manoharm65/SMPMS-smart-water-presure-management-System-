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
  flow_rate?: number
  flowRate?: number
  valvePosition?: number
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

export interface LegacyValveCommandResponse {
  success: boolean
  command_id?: string
  node_id?: string
  position?: number
  dispatched_at?: string
  mode?: 'auto'
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

export interface MlSimulationResult {
  scenario: string
  pressure: number
  flow_rate: number
  supply_on: number
  control_action: number
  prev_valve_position: number
  pressure_lag_2: number
  hydraulic_grade_angle_deg: number
  unexplained_pressure_drop: number
  anomaly_flag: number
  anomaly_score: number
  anomaly_threshold: number
  predicted_possible_problem: string
  possible_problem_if_condition_persists: string
  ml_model_message: string
  top3_probable_problems: string
}

export interface MlSimulationInput {
  pressure: number
  flowRate: number
  valvePosition: number
  supplyOn: boolean
  constructionActivity: boolean
  pipeAgeYears: number
  previousValvePosition: number
  pressureLag2: number
  hydraulicGradeAngleDeg: number
}

export interface MlSimulationMilestone {
  totalPredictions: number
  triggered: boolean
  webAlertMessage?: string
}

export interface MpcStatus {
  lastRun: string | null;
  isRunning: boolean;
  status: string;
  logs?: string[];
  last_cycle?: any;
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

// =============================================================================
// Model Hub API Types
// =============================================================================

export interface ModelMetric {
  timestamp: string
  mse: number
  mae: number
  r2_score: number
  convergence: number
}

export interface MpcMetrics {
  horizon: number
  optimization_time_ms: number
  constraints_satisfied: boolean
  iterations: number
  objective_value: number
  history: ModelMetric[]
}

export interface LeakMetric {
  timestamp: string
  zone_id: string
  probability: number
  flow_anomaly: number
  pressure_drop: number
  confidence: number
  status: 'none' | 'minor' | 'moderate' | 'severe'
}

export interface LeakAnalysis {
  total_leaks: number
  active_alerts: number
  false_positive_rate: number
  detection_rate: number
  history: LeakMetric[]
  zones: string[]
}

export interface IwedsState {
  status: 'active' | 'idle' | 'error'
  last_cycle: string
  anomalies_detected: number
  anomaly_confidence: number
  recommended_actions: string[]
}

export interface IwedsData {
  current_state: IwedsState
  anomaly_history: Array<{
    timestamp: string
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    node: string
  }>
}

export interface ModelStatus {
  mpc: {
    enabled: boolean
    running: boolean
    last_run: string | null
    next_run: string | null
  }
  iweds: {
    enabled: boolean
    running: boolean
    last_run: string | null
    next_run: string | null
  }
  leak_detection: {
    enabled: boolean
    running: boolean
    last_run: string | null
    next_run: string | null
  }
}

export interface ModelRunResponse {
  scenario_id: string
  started_at: string
  estimated_duration_seconds: number
  status: 'started' | 'completed' | 'failed'
  results?: unknown
}

export interface ControlState {
  mode: 'auto' | 'manual'
  active_setpoints: Record<string, number>
  valve_positions: Record<string, number>
  last_update: string
}

export interface SetpointResponse {
  node_id: string
  setpoint: number
  applied: boolean
  timestamp: string
}

export interface ValveCommand {
  node_id: string
  action: 'open' | 'close' | 'set_position'
  value?: number
  priority: 'low' | 'normal' | 'high' | 'emergency'
}

export interface ValveCommandResponse {
  success?: boolean
  command_id: string
  node_id: string
  status: 'queued' | 'dispatched' | 'completed' | 'failed'
  timestamp: string
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

// =============================================================================
// Model Hub API Functions
// =============================================================================

const MODEL_HUB_BASE = '/api/v1/model-hub'

export async function getModelStatus(cfg?: ApiConfig): Promise<ModelStatus> {
  return apiGet<ModelStatus>(`${MODEL_HUB_BASE}/status`, cfg)
}

export async function getMpcMetrics(cfg?: ApiConfig): Promise<MpcMetrics> {
  return apiGet<MpcMetrics>(`${MODEL_HUB_BASE}/mpc/metrics`, cfg)
}

export async function getLeakAnalysis(cfg?: ApiConfig): Promise<LeakAnalysis> {
  return apiGet<LeakAnalysis>(`${MODEL_HUB_BASE}/leak/analysis`, cfg)
}

export async function getIwedsData(cfg?: ApiConfig): Promise<IwedsData> {
  return apiGet<IwedsData>(`${MODEL_HUB_BASE}/iweds/state`, cfg)
}

export async function runModelScenario(
  scenarioId: string,
  cfg?: ApiConfig
): Promise<ModelRunResponse> {
  return apiPost<ModelRunResponse>(`${MODEL_HUB_BASE}/run`, { scenario_id: scenarioId }, cfg)
}

// =============================================================================
// Control Center API Functions
// =============================================================================

const CONTROL_BASE = '/api/v1/control'

export async function getControlState(cfg?: ApiConfig): Promise<ControlState> {
  return apiGet<ControlState>(`${CONTROL_BASE}/state`, cfg)
}

export async function setPressureSetpoint(
  nodeId: string,
  setpoint: number,
  cfg?: ApiConfig
): Promise<SetpointResponse> {
  return apiPost<SetpointResponse>(`${CONTROL_BASE}/setpoint`, { node_id: nodeId, setpoint }, cfg)
}

export async function sendValveCommand(
  command: ValveCommand,
  cfg?: ApiConfig
): Promise<ValveCommandResponse> {
  return apiPost<ValveCommandResponse>(`${CONTROL_BASE}/valve`, command, cfg)
}

export async function sendDirectValveOverride(
  nodeId: string,
  position: number,
  cfg?: ApiConfig
): Promise<{ success: boolean; node_id: string; position: number; timestamp: string }> {
  return apiPost<{ success: boolean; node_id: string; position: number; timestamp: string }>(
    `/api/v1/simulation/valve-override`,
    { node_id: nodeId, position },
    cfg
  )
}

export async function setControlMode(
  mode: 'auto' | 'manual',
  cfg?: ApiConfig
): Promise<{ mode: string; timestamp: string }> {
  return apiPost<{ mode: string; timestamp: string }>(`${CONTROL_BASE}/mode`, { mode }, cfg)
}

export async function applyEmergencyOverrides(
  nodes: string[],
  cfg?: ApiConfig
): Promise<{ applied: string[]; timestamp: string }> {
  return apiPost<{ applied: string[]; timestamp: string }>(`${CONTROL_BASE}/emergency`, { nodes }, cfg)
}

export interface MlSimulationResponse {
  scenario: MlSimulationScenario
  count: number
  results: MlSimulationResult[]
  milestone?: MlSimulationMilestone
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

export interface NodeTelemetry {
  node_id: string
  pressure: number
  flow_rate?: number
  flow_sensor?: number
  valve_position: number
  status: 'live' | 'offline' | 'error'
  last_update: string
}

export interface SmartMeterData {
  meter_id: string
  actual_flow: number
  cumulative_volume: number
  last_update: string
  battery_status: 'ok' | 'low' | 'critical'
  signal_strength: number
}

export interface MotorizedFlowResult {
  enabled: boolean
  base_flow: number
  motorized_flow: number
  total_flow: number
  pump_power_watts: number
  estimated_increase_percent: number
  timestamp: string
}

export async function getZones(cfg?: ApiConfig): Promise<Zone[]> {
  return apiGet<Zone[]>(`${BASE_URL}/zones`, cfg)
}

export async function getNodeTelemetry(
  nodeIds: string[],
  cfg?: ApiConfig
): Promise<NodeTelemetry[]> {
  const ids = nodeIds.join(',')
  return apiGet<NodeTelemetry[]>(`${BASE_URL}/nodes/telemetry?ids=${ids}`, cfg)
}

export async function getSmartMeterData(
  meterIds: string[],
  cfg?: ApiConfig
): Promise<SmartMeterData[]> {
  const ids = meterIds.join(',')
  return apiGet<SmartMeterData[]>(`${BASE_URL}/smart-meters?ids=${ids}`, cfg)
}

export async function toggleMotorizedFlow(
  enabled: boolean,
  cfg?: ApiConfig
): Promise<MotorizedFlowResult> {
  return apiPost<MotorizedFlowResult>(`${BASE_URL}/motorized-flow`, { enabled }, cfg)
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
  input?: MlSimulationInput,
  cfg?: ApiConfig
): Promise<MlSimulationResponse> {
  return apiPost<MlSimulationResponse>(`${BASE_URL}/ml/simulate`, { scenario, ...(input ?? {}) }, cfg)
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

export async function triggerManualAlert(
  payload: { nodeId: string; message: string; riskLevel: string },
  cfg?: ApiConfig
): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(
    '/api/v1/alerts/trigger',
    payload,
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
