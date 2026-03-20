import { config } from '../../core/config.js';
import { DecisionEngine, TelemetryInput, DecisionOutput } from './decision.interface.js';

export class RuleEngine implements DecisionEngine {
  evaluate(input: TelemetryInput): DecisionOutput {
    const { pressure } = input;
    const { pressureMin, pressureMax } = config;

    // Pressure too low
    if (pressure < pressureMin) {
      return {
        riskLevel: 'HIGH',
        action: 'REDUCE_FLOW',
        requiresAlert: true,
      };
    }

    // Pressure too high
    if (pressure > pressureMax) {
      return {
        riskLevel: 'HIGH',
        action: 'INCREASE_FLOW',
        requiresAlert: true,
      };
    }

    // Pressure in safe range
    return {
      riskLevel: 'LOW',
      action: 'NONE',
      requiresAlert: false,
    };
  }
}

export const ruleEngine = new RuleEngine();
