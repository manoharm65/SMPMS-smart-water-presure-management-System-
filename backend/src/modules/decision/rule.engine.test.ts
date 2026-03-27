import { describe, it, expect } from 'vitest';
import { ruleEngine } from './rule.engine.js';
import { TelemetryInput } from './decision.interface.js';

// Mocked config thresholds (from test-setup.ts):
// pressureCriticalHigh: 5.5
// pressureWarningHigh: 4.5
// pressureNormalLow: 2.5
// pressureCriticalLow: 1.5

const makeTelemetry = (overrides: Partial<TelemetryInput> = {}): TelemetryInput => ({
  node_id: 'test-node-1',
  pressure: 3.5,
  valve_position: 50,
  timestamp: '2026-03-20T10:00:00Z',
  ...overrides,
});

describe('ruleEngine', () => {
  // ============================================================
  // Band 1: CRITICAL_HIGH — pressure > 5.5
  // ============================================================
  describe('CRITICAL_HIGH band (pressure > 5.5)', () => {
    it('should return CRITICAL risk and REDUCE_FLOW action', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 6.0 }), []);
      expect(result.risk_level).toBe('CRITICAL');
      expect(result.action).toBe('REDUCE_FLOW');
    });

    it('should recommend valve_position - 20', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 6.0, valve_position: 60 }), []);
      expect(result.recommended_valve_position).toBe(40);
    });

    it('should require alert with crit severity', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 6.0 }), []);
      expect(result.requires_alert).toBe(true);
      expect(result.alert_severity).toBe('crit');
    });
  });

  // ============================================================
  // Band 2: CRITICAL_LOW — pressure < 1.5
  // ============================================================
  describe('CRITICAL_LOW band (pressure < 1.5)', () => {
    it('should return CRITICAL risk and INCREASE_FLOW action', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 1.0 }), []);
      expect(result.risk_level).toBe('CRITICAL');
      expect(result.action).toBe('INCREASE_FLOW');
    });

    it('should recommend valve_position + 20', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 1.0, valve_position: 50 }), []);
      expect(result.recommended_valve_position).toBe(70);
    });

    it('should require alert with crit severity', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 1.0 }), []);
      expect(result.requires_alert).toBe(true);
      expect(result.alert_severity).toBe('crit');
    });
  });

  // ============================================================
  // Band 3: WARNING_HIGH — 4.5 < pressure <= 5.5
  // ============================================================
  describe('WARNING_HIGH band (4.5 < pressure <= 5.5)', () => {
    it('should return WARNING risk and REDUCE_FLOW action at upper boundary', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 5.5 }), []);
      expect(result.risk_level).toBe('WARNING');
      expect(result.action).toBe('REDUCE_FLOW');
    });

    it('should return WARNING risk and REDUCE_FLOW action just above warning high', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 4.6 }), []);
      expect(result.risk_level).toBe('WARNING');
      expect(result.action).toBe('REDUCE_FLOW');
    });

    it('should recommend valve_position - 10', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 5.0, valve_position: 60 }), []);
      expect(result.recommended_valve_position).toBe(50);
    });

    it('should require alert with warn severity', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 5.0 }), []);
      expect(result.requires_alert).toBe(true);
      expect(result.alert_severity).toBe('warn');
    });
  });

  // ============================================================
  // Band 4: LOW — 1.5 <= pressure < 2.5
  // ============================================================
  describe('LOW band (1.5 <= pressure < 2.5)', () => {
    it('should return LOW risk and INCREASE_FLOW action at lower boundary', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 1.5 }), []);
      expect(result.risk_level).toBe('LOW');
      expect(result.action).toBe('INCREASE_FLOW');
    });

    it('should return LOW risk and INCREASE_FLOW action just below normal low', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 2.4 }), []);
      expect(result.risk_level).toBe('LOW');
      expect(result.action).toBe('INCREASE_FLOW');
    });

    it('should recommend valve_position + 10', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 2.0, valve_position: 50 }), []);
      expect(result.recommended_valve_position).toBe(60);
    });

    it('should require alert with low severity', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 2.0 }), []);
      expect(result.requires_alert).toBe(true);
      expect(result.alert_severity).toBe('low');
    });
  });

  // ============================================================
  // Band 5: NORMAL — 2.5 <= pressure <= 4.5
  // ============================================================
  describe('NORMAL band (2.5 <= pressure <= 4.5)', () => {
    it('should return NORMAL risk and NONE action at center', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 3.5 }), []);
      expect(result.risk_level).toBe('NORMAL');
      expect(result.action).toBe('NONE');
    });

    it('should return NORMAL at lower boundary (2.5)', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 2.5 }), []);
      expect(result.risk_level).toBe('NORMAL');
    });

    it('should return NORMAL at upper boundary (4.5)', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 4.5 }), []);
      expect(result.risk_level).toBe('NORMAL');
    });

    it('should keep valve_position unchanged', () => {
      const original = makeTelemetry({ pressure: 3.5, valve_position: 55 });
      const result = ruleEngine.evaluate(original, []);
      expect(result.recommended_valve_position).toBe(55);
    });

    it('should not require alert', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 3.5 }), []);
      expect(result.requires_alert).toBe(false);
      expect(result.alert_severity).toBe('ok');
    });
  });

  // ============================================================
  // Confidence formula — deterministic, same pressure = same confidence
  // ============================================================
  describe('confidence calculation', () => {
    it('should be deterministic — same pressure yields same confidence', () => {
      const t1 = makeTelemetry({ pressure: 3.5 });
      const t2 = makeTelemetry({ pressure: 3.5 });
      const r1 = ruleEngine.evaluate(t1, []);
      const r2 = ruleEngine.evaluate(t2, []);
      expect(r1.confidence).toBe(r2.confidence);
    });

    it('should give higher confidence when further from nearest threshold', () => {
      // 5.6 is further from 5.5 (critical high) than 5.55 is
      const rFar = ruleEngine.evaluate(makeTelemetry({ pressure: 5.6 }), []);
      const rNear = ruleEngine.evaluate(makeTelemetry({ pressure: 5.55 }), []);
      expect(rFar.confidence).toBeGreaterThan(rNear.confidence);
    });

    it('should be ~0.50 at exactly the threshold boundary', () => {
      // Exactly at critical high threshold (5.5) — nearest threshold distance = 0
      // confidence = min(0.50 + (0 * 2.5), 0.99) = 0.50
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 5.5 }), []);
      expect(result.confidence).toBe(0.50);
    });
  });

  // ============================================================
  // Valve position bounds — never go below 0 or above 100
  // ============================================================
  describe('valve position bounds', () => {
    it('CRITICAL_HIGH should clamp to 0 when valve_position=10 (10-20=negative)', () => {
      const result = ruleEngine.evaluate(
        makeTelemetry({ pressure: 6.0, valve_position: 10 }),
        []
      );
      expect(result.recommended_valve_position).toBe(0);
    });

    it('CRITICAL_LOW should clamp to 100 when valve_position=95 (95+20=over 100)', () => {
      const result = ruleEngine.evaluate(
        makeTelemetry({ pressure: 1.0, valve_position: 95 }),
        []
      );
      expect(result.recommended_valve_position).toBe(100);
    });

    it('WARNING_HIGH should clamp to 0 when valve_position=5 (5-10=negative)', () => {
      const result = ruleEngine.evaluate(
        makeTelemetry({ pressure: 5.0, valve_position: 5 }),
        []
      );
      expect(result.recommended_valve_position).toBe(0);
    });

    it('LOW should clamp to 100 when valve_position=97 (97+10=over 100)', () => {
      const result = ruleEngine.evaluate(
        makeTelemetry({ pressure: 2.0, valve_position: 97 }),
        []
      );
      expect(result.recommended_valve_position).toBe(100);
    });
  });

  // ============================================================
  // History array — passed but not used by rule engine
  // ============================================================
  describe('history array', () => {
    it('should accept history as second argument without error', () => {
      const history: TelemetryInput[] = [
        makeTelemetry({ pressure: 3.0, timestamp: '2026-03-20T09:00:00Z' }),
        makeTelemetry({ pressure: 3.2, timestamp: '2026-03-20T09:01:00Z' }),
      ];
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 3.5 }), history);
      // Should still produce a valid decision — history is simply not consumed
      expect(result.risk_level).toBe('NORMAL');
      expect(result.action).toBe('NONE');
    });

    it('should accept empty history array', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 3.5 }), []);
      expect(result.risk_level).toBe('NORMAL');
    });
  });

  // ============================================================
  // Output shape — node_id propagation and reason field
  // ============================================================
  describe('output shape', () => {
    it('should propagate node_id from input', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ node_id: 'node-42' }), []);
      expect(result.node_id).toBe('node-42');
    });

    it('should include a non-empty reason string', () => {
      const result = ruleEngine.evaluate(makeTelemetry({ pressure: 6.0 }), []);
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('should include all required DecisionOutput fields', () => {
      const result = ruleEngine.evaluate(makeTelemetry(), []);
      expect(result).toHaveProperty('node_id');
      expect(result).toHaveProperty('risk_level');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('recommended_valve_position');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('requires_alert');
      expect(result).toHaveProperty('alert_severity');
    });
  });
});
