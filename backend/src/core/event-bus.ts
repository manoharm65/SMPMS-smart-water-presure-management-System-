import { EventEmitter } from 'events';
import { EVENTS, EventType } from './constants.js';

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitTelemetryReceived(payload: TelemetryPayload): void {
    this.emit(EVENTS.TELEMETRY_RECEIVED, payload);
  }

  onTelemetryReceived(handler: (payload: TelemetryPayload) => void): void {
    this.on(EVENTS.TELEMETRY_RECEIVED, handler);
  }

  emitDecisionMade(payload: DecisionPayload): void {
    this.emit(EVENTS.DECISION_MADE, payload);
  }

  onDecisionMade(handler: (payload: DecisionPayload) => void): void {
    this.on(EVENTS.DECISION_MADE, handler);
  }

  emitAlertTriggered(payload: AlertPayload): void {
    this.emit(EVENTS.ALERT_TRIGGERED, payload);
  }

  onAlertTriggered(handler: (payload: AlertPayload) => void): void {
    this.on(EVENTS.ALERT_TRIGGERED, handler);
  }

  emitActionDispatched(payload: ActionPayload): void {
    this.emit(EVENTS.ACTION_DISPATCHED, payload);
  }

  onActionDispatched(handler: (payload: ActionPayload) => void): void {
    this.on(EVENTS.ACTION_DISPATCHED, handler);
  }
}

export interface TelemetryPayload {
  nodeId: string;
  pressure: number;
  flowRate?: number;
  temperature?: number;
  batteryLevel?: number;
  timestamp: Date;
  telemetryId?: string;
}

export interface DecisionPayload {
  nodeId: string;
  riskLevel: string;
  action: string;
  requiresAlert: boolean;
  confidence: number;
  reason: string;
  recommendedValvePosition: number;
  alertSeverity: string;
  telemetryId?: string;
  engine: string;
}

export interface AlertPayload {
  nodeId: string;
  message: string;
  riskLevel: string;
  alertId?: string;
}

export interface ActionPayload {
  nodeId: string;
  command: string;
  commandId?: string;
}

export const eventBus = EventBus.getInstance();
