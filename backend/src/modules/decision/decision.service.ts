import { eventBus, TelemetryPayload, AlertPayload, ActionPayload } from '../../core/event-bus.js';
import { EVENTS } from '../../core/constants.js';
import { decisionRepository } from '../../repositories/decision.repository.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { ruleEngine } from './rule.engine.js';
import { TelemetryInput, DecisionOutput } from './decision.interface.js';

const DEFAULT_VALVE_POSITION = 50;
const HISTORY_RECORD_COUNT = 10;

export class DecisionService {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.onTelemetryReceived(async (payload: TelemetryPayload) => {
      await this.handleTelemetryReceived(payload);
    });
  }

  private async handleTelemetryReceived(payload: TelemetryPayload): Promise<void> {
    console.log(`[Decision] Processing telemetry for node ${payload.nodeId}`);

    // Fetch last 10 readings for history (engine doesn't touch DB directly)
    const historyRecords = telemetryRepository.findLatestByNodeId(payload.nodeId, HISTORY_RECORD_COUNT);
    const history: TelemetryInput[] = historyRecords.map(r => ({
      node_id: r.nodeId,
      pressure: r.pressure,
      valve_position: DEFAULT_VALVE_POSITION, // default - history doesn't have valve_position
      timestamp: r.timestamp,
    }));

    // Prepare input for rule engine
    const input: TelemetryInput = {
      node_id: payload.nodeId,
      pressure: payload.pressure,
      valve_position: DEFAULT_VALVE_POSITION, // TODO: fetch from command table for actual valve position
      timestamp: payload.timestamp instanceof Date ? payload.timestamp.toISOString() : String(payload.timestamp),
    };

    // Evaluate decision
    const decision = ruleEngine.evaluate(input, history);

    // Store decision in database
    const decisionRecord = decisionRepository.create({
      nodeId: payload.nodeId,
      telemetryId: payload.telemetryId,
      riskLevel: decision.risk_level,
      action: decision.action,
      requiresAlert: decision.requires_alert,
      confidence: decision.confidence,
      reason: decision.reason,
      recommendedValvePosition: decision.recommended_valve_position,
      alertSeverity: decision.alert_severity,
      engine: 'rule',
    });

    console.log(`[Decision] Risk: ${decision.risk_level}, Action: ${decision.action}, Confidence: ${decision.confidence}`);

    // Emit DECISION_MADE event
    eventBus.emitDecisionMade({
      nodeId: payload.nodeId,
      riskLevel: decision.risk_level,
      action: decision.action,
      requiresAlert: decision.requires_alert,
      confidence: decision.confidence,
      reason: decision.reason,
      recommendedValvePosition: decision.recommended_valve_position,
      alertSeverity: decision.alert_severity,
      telemetryId: payload.telemetryId,
      engine: 'rule',
    });

    // CRITICAL or WARNING: emit both ALERT_TRIGGERED and ACTION_DISPATCHED
    if (decision.risk_level === 'CRITICAL' || decision.risk_level === 'WARNING') {
      eventBus.emitAlertTriggered({
        nodeId: payload.nodeId,
        message: decision.reason,
        riskLevel: decision.risk_level,
      });
      eventBus.emitActionDispatched({
        nodeId: payload.nodeId,
        command: decision.action,
        commandId: decisionRecord.id,
      });
    }
    // LOW: emit ALERT_TRIGGERED only
    else if (decision.risk_level === 'LOW' && decision.requires_alert) {
      eventBus.emitAlertTriggered({
        nodeId: payload.nodeId,
        message: decision.reason,
        riskLevel: decision.risk_level,
      });
    }
    // NORMAL: no events emitted
  }
}

export const decisionService = new DecisionService();