export interface TelemetryInput {
  node_id: string;
  pressure: number;
  valve_position: number;
  timestamp: string;
}

export interface DecisionOutput {
  node_id: string;
  risk_level: 'LOW' | 'NORMAL' | 'WARNING' | 'CRITICAL';
  action: 'NONE' | 'REDUCE_FLOW' | 'INCREASE_FLOW' | 'EMERGENCY_CLOSE';
  recommended_valve_position: number;
  confidence: number;
  reason: string;
  requires_alert: boolean;
  alert_severity: 'ok' | 'low' | 'warn' | 'crit';
}

export interface AnomalyLogEntry {
  node_id: string;
  confidence: number;
  severity: 'crit' | 'warn';
  message: string;
  model: string;
  timestamp: string;
}

export interface IDecisionEngine {
  evaluate(
    telemetry: TelemetryInput,
    history: TelemetryInput[]
  ): DecisionOutput;
}