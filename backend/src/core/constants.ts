export const EVENTS = {
  TELEMETRY_RECEIVED: 'telemetry:received',
  DECISION_MADE: 'decision:made',
  ALERT_TRIGGERED: 'alert:triggered',
  ACTION_DISPATCHED: 'action:dispatched',
  VALVE_MODE_CHANGED: 'valve:mode-changed',
  COMMAND_TIMEOUT: 'command:timeout',
  COMMAND_ACK_RECEIVED: 'command:ack-received',
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

// Command lifecycle: PENDING -> DISPATCHED -> EXECUTED | FAILED | TIMEOUT
export const COMMAND_STATUS = {
  PENDING: 'PENDING',
  DISPATCHED: 'DISPATCHED',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT',
} as const;

export type CommandStatus = (typeof COMMAND_STATUS)[keyof typeof COMMAND_STATUS];

// Command priority: critical > warning > normal > manual
export const COMMAND_PRIORITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  NORMAL: 'normal',
  MANUAL: 'manual',
} as const;

export type CommandPriority = (typeof COMMAND_PRIORITY)[keyof typeof COMMAND_PRIORITY];

// Valve operating modes
export const VALVE_MODE = {
  AUTO: 'auto',
  OVERRIDE: 'override',
} as const;

export type ValveMode = (typeof VALVE_MODE)[keyof typeof VALVE_MODE];
