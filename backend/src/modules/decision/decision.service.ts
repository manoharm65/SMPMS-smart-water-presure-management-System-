import { eventBus, TelemetryPayload, AlertPayload, ActionPayload, ValveModePayload } from '../../core/event-bus.js';
import { EVENTS } from '../../core/constants.js';
import { decisionRepository } from '../../repositories/decision.repository.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { nodeRepository } from '../../repositories/node.repository.js';
import { telegramService } from '../../integrations/telegram.service.js';
import { ruleEngine } from './rule.engine.js';
import { TelemetryInput, DecisionOutput } from './decision.interface.js';

const DEFAULT_VALVE_POSITION = 50;
const HISTORY_RECORD_COUNT = 10;

// Override safety thresholds
const OVERRIDE_WARNING_THRESHOLD = 15;  // Send warning after 15 critical readings
const OVERRIDE_REVERT_THRESHOLD = 20;   // Auto-revert after 20 critical readings (15 + 5)

// Track critical readings per node while in override mode
interface OverrideSafetyState {
  criticalCount: number;
  warningSent: boolean;
}

export class DecisionService {
  // Map to track critical readings count per node while in override mode
  private overrideSafetyTracking: Map<string, OverrideSafetyState> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.onTelemetryReceived(async (payload: TelemetryPayload) => {
      await this.handleTelemetryReceived(payload);
    });

    // Reset counter when valve mode changes to override
    eventBus.onValveModeChanged(async (payload: ValveModePayload) => {
      if (payload.newMode === 'override') {
        // Reset tracking when entering override mode
        this.overrideSafetyTracking.set(payload.nodeId, { criticalCount: 0, warningSent: false });
        console.log(`[Decision] Override safety tracking reset for node ${payload.nodeId}`);
      } else if (payload.newMode === 'auto') {
        // Clear tracking when reverting to auto
        this.overrideSafetyTracking.delete(payload.nodeId);
        console.log(`[Decision] Override safety tracking cleared for node ${payload.nodeId}`);
      }
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

    // CRITICAL or WARNING: emit ALERT_TRIGGERED and possibly ACTION_DISPATCHED
    if (decision.risk_level === 'CRITICAL' || decision.risk_level === 'WARNING') {
      eventBus.emitAlertTriggered({
        nodeId: payload.nodeId,
        message: decision.reason,
        riskLevel: decision.risk_level,
      });

      // Check if node is in override mode - if so, skip automatic command dispatch
      // Manual operator commands ALWAYS take precedence over automatic decisions
      const valveState = nodeRepository.getValveState(payload.nodeId);
      if (valveState?.mode === 'override') {
        console.log(`[Decision] Node ${payload.nodeId} in override mode — skipping automatic command dispatch (alert still sent)`);
        // Don't emit ACTION_DISPATCHED - manual operator command takes precedence
        // Alert was already emitted above for logging/notification purposes
        
        // Override safety mechanism: track critical readings in override mode
        if (decision.risk_level === 'CRITICAL') {
          await this.handleOverrideSafetyCheck(payload.nodeId, payload.pressure);
        } else {
          // Non-critical reading resets the counter (pressure stabilized)
          const state = this.overrideSafetyTracking.get(payload.nodeId);
          if (state && state.criticalCount > 0) {
            console.log(`[Decision] Non-critical reading in override mode - resetting safety counter for ${payload.nodeId}`);
            this.overrideSafetyTracking.set(payload.nodeId, { criticalCount: 0, warningSent: false });
          }
        }
      } else {
        // Node is in auto mode - emit action dispatched with risk level and target position
        const actionPayload: ActionPayload = {
          nodeId: payload.nodeId,
          command: decision.action,
          commandId: decisionRecord.id,
          riskLevel: decision.risk_level,
          targetPosition: decision.recommended_valve_position,
          pressure: payload.pressure,
          source: 'decision',
        };
        eventBus.emitActionDispatched(actionPayload);
      }
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

  /**
   * Override Safety Mechanism:
   * - After 15 consecutive CRITICAL readings in override mode: send Telegram warning
   * - After 20 consecutive CRITICAL readings: auto-revert to AUTO mode
   */
  private async handleOverrideSafetyCheck(nodeId: string, pressure: number): Promise<void> {
    // Get or initialize tracking state
    let state = this.overrideSafetyTracking.get(nodeId);
    if (!state) {
      state = { criticalCount: 0, warningSent: false };
      this.overrideSafetyTracking.set(nodeId, state);
    }

    // Increment critical count
    state.criticalCount++;
    console.log(`[Decision] Override safety: node ${nodeId} has ${state.criticalCount}/${OVERRIDE_REVERT_THRESHOLD} critical readings`);

    // Check if we've hit the revert threshold (20 readings)
    if (state.criticalCount >= OVERRIDE_REVERT_THRESHOLD) {
      console.log(`[Decision] Override safety: AUTO-REVERTING node ${nodeId} after ${state.criticalCount} critical readings`);
      
      // Send notification before reverting
      await telegramService.sendOverrideAutoRevertNotification({
        nodeId,
        criticalCount: state.criticalCount,
        pressure,
      });

      // Revert to auto mode
      nodeRepository.updateValveMode(nodeId, 'auto');
      
      // Emit valve mode changed event (this will also clear the tracking map)
      eventBus.emitValveModeChanged({
        nodeId,
        newMode: 'auto',
        previousMode: 'override',
        reason: 'safety_auto_revert',
        pressure,
      });

      return;
    }

    // Check if we've hit the warning threshold (15 readings) and haven't sent warning yet
    if (state.criticalCount >= OVERRIDE_WARNING_THRESHOLD && !state.warningSent) {
      console.log(`[Decision] Override safety: Sending warning for node ${nodeId} at ${state.criticalCount} critical readings`);
      
      const remainingReadings = OVERRIDE_REVERT_THRESHOLD - state.criticalCount;
      
      await telegramService.sendOverrideSafetyWarning({
        nodeId,
        criticalCount: state.criticalCount,
        pressure,
        remainingReadings,
      });

      // Mark warning as sent
      state.warningSent = true;
    }
  }
}

export const decisionService = new DecisionService();