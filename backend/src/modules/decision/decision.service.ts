import { eventBus, TelemetryPayload, AlertPayload, ActionPayload } from '../../core/event-bus.js';
import { EVENTS } from '../../core/constants.js';
import { decisionRepository } from '../../repositories/decision.repository.js';
import { ruleEngine } from './rule.engine.js';
import { TelemetryInput } from './decision.interface.js';

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

    // Prepare input for rule engine
    const input: TelemetryInput = {
      nodeId: payload.nodeId,
      pressure: payload.pressure,
      flowRate: payload.flowRate,
      timestamp: payload.timestamp,
    };

    // Evaluate decision
    const decision = ruleEngine.evaluate(input);

    // Store decision in database
    const decisionRecord = decisionRepository.create({
      nodeId: payload.nodeId,
      telemetryId: payload.telemetryId,
      riskLevel: decision.riskLevel,
      action: decision.action,
      requiresAlert: decision.requiresAlert,
      engine: 'rule',
    });

    console.log(`[Decision] Risk: ${decision.riskLevel}, Action: ${decision.action}, Alert: ${decision.requiresAlert}`);

    // Emit decision made event
    eventBus.emitDecisionMade({
      nodeId: payload.nodeId,
      riskLevel: decision.riskLevel,
      action: decision.action,
      requiresAlert: decision.requiresAlert,
      telemetryId: payload.telemetryId,
      engine: 'rule',
    });

    // Trigger alert if needed
    if (decision.requiresAlert) {
      const alertMessage = this.buildAlertMessage(payload, decision);
      eventBus.emitAlertTriggered({
        nodeId: payload.nodeId,
        message: alertMessage,
        riskLevel: decision.riskLevel,
      });
    }

    // Dispatch action if needed
    if (decision.action !== 'NONE') {
      eventBus.emitActionDispatched({
        nodeId: payload.nodeId,
        command: decision.action,
        commandId: decisionRecord.id,
      });
    }
  }

  private buildAlertMessage(payload: TelemetryPayload, decision: { riskLevel: string; action: string }): string {
    const actionText = decision.action === 'REDUCE_FLOW' ? 'Reduce Flow' : 'Increase Flow';
    return `ALERT [${decision.riskLevel} RISK] at Node ${payload.nodeId}: Pressure ${payload.pressure} bar. Action: ${actionText}`;
  }
}

export const decisionService = new DecisionService();
