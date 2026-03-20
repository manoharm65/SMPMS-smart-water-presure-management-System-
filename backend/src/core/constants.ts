export const EVENTS = {
  TELEMETRY_RECEIVED: 'telemetry:received',
  DECISION_MADE: 'decision:made',
  ALERT_TRIGGERED: 'alert:triggered',
  ACTION_DISPATCHED: 'action:dispatched',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

export const RISK_LEVELS = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

export const ACTIONS = {
  NONE: 'NONE',
  REDUCE_FLOW: 'REDUCE_FLOW',
  INCREASE_FLOW: 'INCREASE_FLOW',
  EMERGENCY_CLOSE: 'EMERGENCY_CLOSE',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export const ALERT_SEVERITIES = {
  ok: 'ok',
  low: 'low',
  warn: 'warn',
  crit: 'crit',
} as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[keyof typeof ALERT_SEVERITIES];

export const COMMAND_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  ACKNOWLEDGED: 'acknowledged',
  FAILED: 'failed',
} as const;

export type CommandStatus = (typeof COMMAND_STATUS)[keyof typeof COMMAND_STATUS];
