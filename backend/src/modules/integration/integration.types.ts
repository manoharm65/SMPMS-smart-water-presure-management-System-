export type SourceModule =
  | 'TELEMETRY'
  | 'MPC'
  | 'DECISION'
  | 'IWEDS'
  | 'LEAK_ML'
  | 'INTEGRATION';

export type IntegrationRiskState = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface CanonicalIntegrationEvent {
  event_id: string;
  source_module: SourceModule;
  event_type: string;
  node_id?: string;
  dma_id?: string;
  household_id?: string;
  timestamp: string;
  risk_level: string;
  confidence: number;
  integration_risk_state: IntegrationRiskState;
  correlation_id: string;
  payload: Record<string, unknown>;
}

export interface IntegrationAdvisory {
  operator_attention_required: boolean;
  recommended_bound_tightening: number;
  reason: string;
}

export interface IntegrationContributor {
  source_module: SourceModule;
  event_type: string;
  integration_risk_state: IntegrationRiskState;
  risk_level: string;
  confidence: number;
  timestamp: string;
  correlation_id: string;
}

export interface IntegrationZoneSnapshot {
  dma_id: string;
  last_updated: string;
  integration_risk_state: IntegrationRiskState;
  risk_score: number;
  contributors: IntegrationContributor[];
  advisory: IntegrationAdvisory | null;
  correlation_id: string;
}
