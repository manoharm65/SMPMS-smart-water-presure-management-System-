// Valve state per node (derived from nodes table)
export interface ValveState {
  nodeId: string;
  currentPosition: number;   // last known actual position %
  targetPosition: number;     // what backend wants it to be
  mode: ValveMode;
  lastCommandId?: string;
  lastUpdated?: string;
}

// Valve operating modes
export type ValveMode = 'auto' | 'override';

// Command priority levels
export type CommandPriority = 'critical' | 'warning' | 'normal' | 'manual';

// Extended command status lifecycle
export type CommandStatus = 'PENDING' | 'DISPATCHED' | 'EXECUTED' | 'FAILED' | 'TIMEOUT';

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

export interface Node {
  id: string;
  nodeId: string;
  name?: string;
  location?: string;
  isActive: boolean;
  valvePosition?: number;
  valveMode?: ValveMode;
  currentPosition?: number;      // last known actual position %
  targetPosition?: number;       // what backend wants it to be
  lastCommandId?: string;
  lastValveUpdate?: string;
  status?: 'online' | 'offline' | 'degraded';
  lastSeen?: string;
  apiKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Telemetry {
  id: string;
  nodeId: string;
  pressure: number;
  flowRate?: number;
  temperature?: number;
  batteryLevel?: number;
  valvePosition?: number;
  timestamp: string;
}

export interface Decision {
  id: string;
  nodeId: string;
  telemetryId?: string;
  riskLevel: string;
  action: string;
  requiresAlert: boolean;
  confidence: number;
  reason: string;
  recommendedValvePosition: number;
  alertSeverity: string;
  engine: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  nodeId: string;
  message: string;
  riskLevel: string;
  sent: boolean;
  sentAt?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt: string;
}

export interface Command {
  id: string;
  nodeId: string;
  command: string;
  status: string;
  priority?: CommandPriority;
  targetPosition?: number;
  sentAt?: string;
  acknowledgedAt?: string;
  executedPosition?: number;
  createdAt: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
}

export interface AuthToken {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}
