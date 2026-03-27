import { config } from '../../core/config.js';
import { IDecisionEngine, TelemetryInput, DecisionOutput } from './decision.interface.js';

export class RuleEngine implements IDecisionEngine {
  evaluate(telemetry: TelemetryInput, history: TelemetryInput[]): DecisionOutput {
    const { node_id, pressure, valve_position, timestamp } = telemetry;

    const { pressureCriticalHigh, pressureWarningHigh, pressureNormalLow, pressureCriticalLow } = config;

    let riskLevel: DecisionOutput['risk_level'];
    let action: DecisionOutput['action'];
    let recommendedValvePosition: number;
    let reason: string;
    let requiresAlert: boolean;
    let alertSeverity: DecisionOutput['alert_severity'];

    // Rule 1: CRITICAL HIGH
    if (pressure > pressureCriticalHigh) {
      riskLevel = 'CRITICAL';
      action = 'REDUCE_FLOW';
      recommendedValvePosition = Math.max(0, valve_position - 20);
      reason = 'Overpressure detected';
      requiresAlert = true;
      alertSeverity = 'crit';
    }
    // Rule 2: CRITICAL LOW
    else if (pressure < pressureCriticalLow) {
      riskLevel = 'CRITICAL';
      action = 'INCREASE_FLOW';
      recommendedValvePosition = Math.min(100, valve_position + 20);
      reason = 'Critical low pressure — possible leakage';
      requiresAlert = true;
      alertSeverity = 'crit';
    }
    // Rule 3: WARNING HIGH
    else if (pressure > pressureWarningHigh) {
      riskLevel = 'WARNING';
      action = 'REDUCE_FLOW';
      recommendedValvePosition = Math.max(0, valve_position - 10);
      reason = 'Elevated pressure reading';
      requiresAlert = true;
      alertSeverity = 'warn';
    }
    // Rule 4: LOW
    else if (pressure < pressureNormalLow) {
      riskLevel = 'LOW';
      action = 'INCREASE_FLOW';
      recommendedValvePosition = Math.min(100, valve_position + 10);
      reason = 'Below normal pressure range';
      requiresAlert = true;
      alertSeverity = 'low';
    }
    // Rule 5: NORMAL
    else {
      riskLevel = 'NORMAL';
      action = 'NONE';
      recommendedValvePosition = valve_position;
      reason = 'Pressure within normal range';
      requiresAlert = false;
      alertSeverity = 'ok';
    }

    // Confidence score (deterministic)
    const confidence = this.calculateConfidence(pressure, pressureCriticalHigh, pressureWarningHigh, pressureNormalLow, pressureCriticalLow);

    return {
      node_id,
      risk_level: riskLevel,
      action,
      recommended_valve_position: recommendedValvePosition,
      confidence,
      reason,
      requires_alert: requiresAlert,
      alert_severity: alertSeverity,
    };
  }

  private calculateConfidence(
    pressure: number,
    criticalHigh: number,
    warningHigh: number,
    normalLow: number,
    criticalLow: number
  ): number {
    // Find nearest threshold
    const thresholds = [criticalHigh, warningHigh, normalLow, criticalLow];
    let nearestThreshold = thresholds[0];
    let minDist = Math.abs(pressure - thresholds[0]);

    for (const t of thresholds) {
      const dist = Math.abs(pressure - t);
      if (dist < minDist) {
        minDist = dist;
        nearestThreshold = t;
      }
    }

    const deviation = minDist / nearestThreshold;
    return Math.min(0.50 + (deviation * 2.5), 0.99);
  }
}

export const ruleEngine = new RuleEngine();