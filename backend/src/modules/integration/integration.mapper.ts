import { createHash } from 'crypto';
import { IntegrationRiskState } from './integration.types.js';

export function normalizeZoneId(input?: string): string | undefined {
  if (!input) return undefined;
  return input.trim().replace(/_/g, '-').toUpperCase();
}

export function stateToScore(state: IntegrationRiskState): number {
  switch (state) {
    case 'CRITICAL':
      return 1;
    case 'HIGH':
      return 0.75;
    case 'ELEVATED':
      return 0.5;
    default:
      return 0.2;
  }
}

export function scoreToState(score: number): IntegrationRiskState {
  if (score >= 0.9) return 'CRITICAL';
  if (score >= 0.7) return 'HIGH';
  if (score >= 0.45) return 'ELEVATED';
  return 'NORMAL';
}

export function deriveCorrelationId(dmaId: string, timestampIso: string): string {
  const ts = new Date(timestampIso);
  const bucketMinute = Number.isNaN(ts.getTime())
    ? 'unknown'
    : `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}-${String(ts.getUTCDate()).padStart(2, '0')}T${String(ts.getUTCHours()).padStart(2, '0')}:${String(ts.getUTCMinutes()).padStart(2, '0')}`;
  return createHash('sha1').update(`${dmaId}|${bucketMinute}`).digest('hex').slice(0, 16);
}

export function mapIwedsToIntegrationRisk(detectionState: string, severity: string | null): IntegrationRiskState {
  const detection = detectionState.toUpperCase();
  const sev = (severity || '').toUpperCase();
  if (detection === 'ILLEGAL') {
    if (sev === 'HIGH') return 'CRITICAL';
    return 'HIGH';
  }
  if (detection === 'SUSPECT') return 'ELEVATED';
  return 'NORMAL';
}

export function mapLeakMlToIntegrationRisk(anomalyFlag: number, predictedEvent: string, anomalyScore: number): IntegrationRiskState {
  if (!anomalyFlag) return 'NORMAL';
  const evt = predictedEvent.toLowerCase();
  if (evt === 'burst' || anomalyScore >= 0.9) return 'CRITICAL';
  if (evt === 'leak' || evt === 'construction_damage') return 'HIGH';
  return 'ELEVATED';
}

export function mapMpcDecisionToIntegrationRisk(riskLevel: string): IntegrationRiskState {
  const risk = riskLevel.toUpperCase();
  if (risk === 'CRITICAL') return 'CRITICAL';
  if (risk === 'LOW') return 'HIGH';
  if (risk === 'WARNING' || risk === 'MEDIUM') return 'ELEVATED';
  return 'NORMAL';
}
