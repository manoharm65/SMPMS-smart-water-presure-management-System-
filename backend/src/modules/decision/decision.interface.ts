export interface TelemetryInput {
  nodeId: string;
  pressure: number;
  flowRate?: number;
  timestamp: Date;
}

export interface DecisionOutput {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'NONE' | 'REDUCE_FLOW' | 'INCREASE_FLOW';
  requiresAlert: boolean;
}

export interface DecisionEngine {
  evaluate(input: TelemetryInput): DecisionOutput;
}
