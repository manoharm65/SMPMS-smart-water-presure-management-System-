import { EventEmitter } from 'events';
import { EVENTS, EventType, ValveMode } from './constants.js';

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

  emitValveModeChanged(payload: ValveModePayload): void {
    this.emit(EVENTS.VALVE_MODE_CHANGED, payload);
  }

  onValveModeChanged(handler: (payload: ValveModePayload) => void): void {
    this.on(EVENTS.VALVE_MODE_CHANGED, handler);
  }

  emitCommandTimeout(payload: CommandTimeoutPayload): void {
    this.emit(EVENTS.COMMAND_TIMEOUT, payload);
  }

  onCommandTimeout(handler: (payload: CommandTimeoutPayload) => void): void {
    this.on(EVENTS.COMMAND_TIMEOUT, handler);
  }

  emitCommandAckReceived(payload: CommandAckPayload): void {
    this.emit(EVENTS.COMMAND_ACK_RECEIVED, payload);
  }

  onCommandAckReceived(handler: (payload: CommandAckPayload) => void): void {
    this.on(EVENTS.COMMAND_ACK_RECEIVED, handler);
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
  riskLevel?: string;
  targetPosition?: number;
  pressure?: number;
}

export interface ValveModePayload {
  nodeId: string;
  previousMode: ValveMode;
  newMode: ValveMode;
  reason: 'operator' | 'critical_auto_revert';
  pressure?: number;
}

export interface CommandAckPayload {
  nodeId: string;
  commandId: string;
  executed: boolean;
  actualPosition?: number;
  timestamp: Date;
}

export interface CommandTimeoutPayload {
  nodeId: string;
  commandId: string;
  commandAgeMs: number;
  thresholdMs: number;
}

export const eventBus = EventBus.getInstance();
