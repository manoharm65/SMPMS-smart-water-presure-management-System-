export const EVENTS = {
  TELEMETRY_RECEIVED: 'telemetry:received',
  DECISION_MADE: 'decision:made',
  ALERT_TRIGGERED: 'alert:triggered',
  ACTION_DISPATCHED: 'action:dispatched',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

export const ACTIONS = {
  NONE: 'NONE',
  REDUCE_FLOW: 'REDUCE_FLOW',
  INCREASE_FLOW: 'INCREASE_FLOW',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export const COMMAND_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  ACKNOWLEDGED: 'acknowledged',
  FAILED: 'failed',
} as const;

export type CommandStatus = (typeof COMMAND_STATUS)[keyof typeof COMMAND_STATUS];
