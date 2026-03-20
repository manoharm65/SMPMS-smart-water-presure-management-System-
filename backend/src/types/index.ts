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
  valveMode?: 'auto' | 'override';
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
  createdAt: string;
}

export interface Command {
  id: string;
  nodeId: string;
  command: string;
  status: string;
  sentAt?: string;
  acknowledgedAt?: string;
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
