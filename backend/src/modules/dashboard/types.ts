// Zone summary (GET /zones)
export interface ZoneSummary {
  id: string;           // "DMA-01"
  name: string;
  lat: number;
  lng: number;
  pressure: number;     // BAR, 2dp
  valve_position: number;  // % integer 0-100
  ai_confidence: number;    // 0-100 integer
  status: 'ok' | 'warn' | 'low' | 'crit';
  trend: 'up' | 'down' | 'stable';
  last_reading: string; // "HH:MM"
}

// KPI (GET /kpi)
export interface KpiData {
  zones_online: number;
  zones_total: number;
  avg_pressure: number;  // BAR, 2dp
  active_alerts: number;
  leaks_flagged: number;
  valve_ops: number;
}

// Alert (GET /alerts)
export interface AlertData {
  id: string;
  zone_id: string;
  zone_name: string;
  severity: 'crit' | 'warn' | 'low';
  message: string;
  time: string;  // "HH:MM"
}

// Pressure reading for history
export interface PressureReading {
  label: string;  // "HH:MM" or "Mon"
  pressure: number;
}

// Pressure history (GET /pressure-history/:zoneId)
export interface PressureHistory {
  zone_id: string;
  range: '24h' | '7d';
  readings: PressureReading[];
}

// Zone detail (GET /zones/:zoneId)
export interface ZoneDetail {
  id: string;
  name: string;
  pressure: number;
  min_today: number;
  max_today: number;
  avg_7d: number;
  valve_position: number;
  valve_mode: 'auto' | 'override';
  ai_confidence: number;
  ai_recommendation: number;
  ai_reason: string;
  last_reading: string;  // "HH:MM:SS"
}

// Anomaly (GET /zones/:zoneId/anomalies)
export interface AnomalyData {
  confidence: number;     // 0-100 integer
  severity: 'crit' | 'warn';
  message: string;
  model: string;
  time: string;  // "HH:MM"
}

// Valve override request
export interface ValveOverrideRequest {
  position: number;  // 0-100 integer
  mode: 'override';
}

// Valve override response
export interface ValveOverrideResponse {
  success: boolean;
  command_id: string;
  node_id: string;
  position: number;
  dispatched_at: string;
}

// Revert response
export interface RevertResponse {
  success: boolean;
  node_id: string;
  mode: 'auto';
}