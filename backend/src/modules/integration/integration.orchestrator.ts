import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { config } from '../../core/config.js';
import {
  eventBus,
  ActionPayload,
  DecisionPayload,
  MpcAdvisoryGeneratedPayload,
  RiskCorrelatedPayload,
  TelemetryPayload,
  ZoneRiskUpdatedPayload,
} from '../../core/event-bus.js';
import {
  deriveCorrelationId,
  mapIwedsToIntegrationRisk,
  mapLeakMlToIntegrationRisk,
  mapMpcDecisionToIntegrationRisk,
  normalizeZoneId,
} from './integration.mapper.js';
import { integrationRepository } from './integration.repository.js';
import {
  CanonicalIntegrationEvent,
  IntegrationRiskState,
  IntegrationZoneSnapshot,
  SourceModule,
} from './integration.types.js';

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  values.push(current);
  return values;
}

function safeNumber(value: unknown, fallback = 0.5): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return n;
}

class IntegrationOrchestrator {
  private started = false;

  start(): void {
    if (!config.integrationOrchestrationEnabled || this.started) {
      return;
    }
    this.started = true;

    integrationRepository.runBackfill(200);

    eventBus.onTelemetryReceived((payload) => this.captureTelemetrySignal(payload));
    eventBus.onDecisionMade((payload) => this.captureDecisionSignal(payload));
    eventBus.onActionDispatched((payload) => this.captureActionSignal(payload));
  }

  captureIwedsDetection(input: {
    dmaId: string;
    householdId: string;
    detectionState: 'NORMAL' | 'SUSPECT' | 'ILLEGAL';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    severityScore: number;
    timestamp: string;
    qExcessLps: number;
  }): IntegrationZoneSnapshot | null {
    const dmaId = normalizeZoneId(input.dmaId);
    if (!dmaId) return null;

    const event: CanonicalIntegrationEvent = {
      event_id: randomUUID(),
      source_module: 'IWEDS',
      event_type: 'IWEDS_DETECTION',
      dma_id: dmaId,
      household_id: input.householdId,
      timestamp: input.timestamp,
      risk_level: input.detectionState,
      confidence: Math.max(0.2, Math.min(1, safeNumber(input.severityScore, 0.6))),
      integration_risk_state: mapIwedsToIntegrationRisk(input.detectionState, input.severity),
      correlation_id: deriveCorrelationId(dmaId, input.timestamp),
      payload: {
        severity: input.severity,
        q_excess_lps: input.qExcessLps,
      },
    };

    return this.persistAndRefresh(event);
  }

  captureMpcCycle(input: {
    timestamp: string;
    commands: Array<{ id: string; reason: string; valve_target_pct: number; estimated_pressure: number }>;
    riskHint?: string;
  }): void {
    for (const command of input.commands || []) {
      const dmaId = normalizeZoneId(command.id);
      if (!dmaId) continue;
      const risk = mapMpcDecisionToIntegrationRisk(input.riskHint || command.reason || 'NORMAL');
      const event: CanonicalIntegrationEvent = {
        event_id: randomUUID(),
        source_module: 'MPC',
        event_type: 'MPC_CYCLE_COMMAND',
        node_id: command.id,
        dma_id: dmaId,
        timestamp: input.timestamp,
        risk_level: input.riskHint || command.reason || 'NORMAL',
        confidence: 0.65,
        integration_risk_state: risk,
        correlation_id: deriveCorrelationId(dmaId, input.timestamp),
        payload: {
          valve_target_pct: command.valve_target_pct,
          estimated_pressure: command.estimated_pressure,
          reason: command.reason,
        },
      };
      this.persistAndRefresh(event);
    }
  }

  captureMlPredictionsFromCsv(csvPath: string): number {
    if (!existsSync(csvPath)) return 0;
    const content = readFileSync(csvPath, 'utf-8').trim();
    if (!content) return 0;

    const lines = content.split(/\r?\n/);
    if (lines.length <= 1) return 0;
    const headers = parseCsvLine(lines[0]);
    const get = (row: string[], key: string): string => {
      const idx = headers.indexOf(key);
      if (idx < 0 || idx >= row.length) return '';
      return row[idx];
    };

    let inserted = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const row = parseCsvLine(line);
      const anomalyFlag = parseInt(get(row, 'anomaly_flag') || '0', 10);
      if (anomalyFlag !== 1) continue;

      const nodeId = get(row, 'node_id');
      const dmaId = normalizeZoneId(nodeId);
      if (!dmaId) continue;

      const score = parseFloat(get(row, 'anomaly_score') || '0');
      const predicted = get(row, 'predicted_event') || 'normal';
      const timestamp = get(row, 'timestamp') || new Date().toISOString();
      const riskState = mapLeakMlToIntegrationRisk(anomalyFlag, predicted, score);

      const event: CanonicalIntegrationEvent = {
        event_id: randomUUID(),
        source_module: 'LEAK_ML',
        event_type: 'LEAK_ML_ANOMALY',
        node_id: nodeId,
        dma_id: dmaId,
        timestamp,
        risk_level: predicted,
        confidence: Math.max(0.2, Math.min(1, score)),
        integration_risk_state: riskState,
        correlation_id: deriveCorrelationId(dmaId, timestamp),
        payload: {
          anomaly_score: score,
          predicted_event: predicted,
          explanation: get(row, 'event_explanation') || '',
        },
      };

      this.persistAndRefresh(event);
      inserted++;
    }

    return inserted;
  }

  getZoneRisk(zoneId: string, from?: string, to?: string): {
    snapshot: IntegrationZoneSnapshot | null;
    contributors: CanonicalIntegrationEvent[];
  } {
    const dmaId = normalizeZoneId(zoneId) || zoneId;
    const snapshot = integrationRepository.getZoneSnapshot(dmaId);
    const contributors = integrationRepository.listEvents({
      dmaId,
      from,
      to,
      limit: 50,
    });
    return { snapshot, contributors };
  }

  getTimeline(input: {
    zoneId: string;
    from?: string;
    to?: string;
    severity?: IntegrationRiskState;
    limit?: number;
  }): CanonicalIntegrationEvent[] {
    const dmaId = normalizeZoneId(input.zoneId) || input.zoneId;
    return integrationRepository.listEvents({
      dmaId,
      from: input.from,
      to: input.to,
      severity: input.severity,
      limit: Math.min(Math.max(input.limit ?? 100, 1), 500),
    });
  }

  getMlPredictionsPath(): string {
    return config.mlPredictionsCsvPath;
  }

  getSummary(input: { from?: string; to?: string; severity?: IntegrationRiskState; limit?: number }): {
    total_correlated_incidents: number;
    active_high_risk_zones: number;
    iweds_ml_agreement_rate: number;
    zone_count: number;
    generated_at: string;
  } {
    const snapshots = integrationRepository.listSnapshots(Math.min(Math.max(input.limit ?? 500, 1), 1000));
    const activeHighRiskZones = snapshots.filter((snapshot) => snapshot.integration_risk_state === 'HIGH' || snapshot.integration_risk_state === 'CRITICAL').length;

    const events = integrationRepository.listEvents({
      from: input.from,
      to: input.to,
      severity: input.severity,
      limit: 2000,
    });

    const byCorrelation = new Map<string, CanonicalIntegrationEvent[]>();
    for (const event of events) {
      const key = `${event.dma_id || 'GLOBAL'}:${event.correlation_id}`;
      const group = byCorrelation.get(key) || [];
      group.push(event);
      byCorrelation.set(key, group);
    }

    let correlatedIncidents = 0;
    let compared = 0;
    let agreement = 0;

    byCorrelation.forEach((group) => {
      const sources = new Set(group.map((event) => event.source_module));
      if (sources.has('IWEDS') && sources.has('LEAK_ML')) {
        correlatedIncidents++;
      }
      const iweds = group.find((event) => event.source_module === 'IWEDS');
      const leak = group.find((event) => event.source_module === 'LEAK_ML');
      if (iweds && leak) {
        compared++;
        const iwedsElevated = iweds.integration_risk_state === 'HIGH' || iweds.integration_risk_state === 'CRITICAL';
        const leakElevated = leak.integration_risk_state === 'HIGH' || leak.integration_risk_state === 'CRITICAL';
        if (iwedsElevated === leakElevated) {
          agreement++;
        }
      }
    });

    return {
      total_correlated_incidents: correlatedIncidents,
      active_high_risk_zones: activeHighRiskZones,
      iweds_ml_agreement_rate: compared > 0 ? Number((agreement / compared).toFixed(4)) : 0,
      zone_count: snapshots.length,
      generated_at: new Date().toISOString(),
    };
  }

  private captureTelemetrySignal(payload: TelemetryPayload): void {
    const timestamp = payload.timestamp instanceof Date ? payload.timestamp.toISOString() : new Date().toISOString();
    const dmaId = normalizeZoneId(payload.nodeId);
    if (!dmaId) return;
    const event: CanonicalIntegrationEvent = {
      event_id: randomUUID(),
      source_module: 'TELEMETRY',
      event_type: 'TELEMETRY_SIGNAL',
      node_id: payload.nodeId,
      dma_id: dmaId,
      timestamp,
      risk_level: 'NORMAL',
      confidence: 0.5,
      integration_risk_state: 'NORMAL',
      correlation_id: deriveCorrelationId(dmaId, timestamp),
      payload: {
        pressure: payload.pressure,
        flow_rate: payload.flowRate ?? null,
      },
    };
    this.persistAndRefresh(event);
  }

  private captureDecisionSignal(payload: DecisionPayload): void {
    const timestamp = new Date().toISOString();
    const dmaId = normalizeZoneId(payload.nodeId);
    if (!dmaId) return;
    const event: CanonicalIntegrationEvent = {
      event_id: randomUUID(),
      source_module: 'DECISION',
      event_type: 'DECISION_MADE',
      node_id: payload.nodeId,
      dma_id: dmaId,
      timestamp,
      risk_level: payload.riskLevel,
      confidence: safeNumber(payload.confidence, 0.6),
      integration_risk_state: mapMpcDecisionToIntegrationRisk(payload.riskLevel),
      correlation_id: deriveCorrelationId(dmaId, timestamp),
      payload: {
        action: payload.action,
        reason: payload.reason,
      },
    };
    this.persistAndRefresh(event);
  }

  private captureActionSignal(payload: ActionPayload): void {
    const timestamp = new Date().toISOString();
    const dmaId = normalizeZoneId(payload.nodeId);
    if (!dmaId) return;
    const riskLevel = payload.riskLevel || 'NORMAL';
    const event: CanonicalIntegrationEvent = {
      event_id: randomUUID(),
      source_module: 'MPC',
      event_type: 'ACTION_DISPATCHED',
      node_id: payload.nodeId,
      dma_id: dmaId,
      timestamp,
      risk_level: riskLevel,
      confidence: 0.6,
      integration_risk_state: mapMpcDecisionToIntegrationRisk(riskLevel),
      correlation_id: deriveCorrelationId(dmaId, timestamp),
      payload: {
        command: payload.command,
        target_position: payload.targetPosition ?? null,
        source: payload.source ?? 'decision',
      },
    };
    this.persistAndRefresh(event);
  }

  private persistAndRefresh(event: CanonicalIntegrationEvent): IntegrationZoneSnapshot | null {
    integrationRepository.recordEvent(event);
    if (!event.dma_id) return null;
    const snapshot = integrationRepository.recomputeZoneSnapshot(event.dma_id, config.integrationCorrelationWindowSec);
    if (!snapshot) return null;

    const correlatedPayload: RiskCorrelatedPayload = {
      dmaId: snapshot.dma_id,
      correlationId: snapshot.correlation_id,
      integrationRiskState: snapshot.integration_risk_state,
      contributors: snapshot.contributors.map((c) => c.source_module),
      timestamp: new Date(snapshot.last_updated),
    };
    eventBus.emitRiskCorrelated(correlatedPayload);
    this.logStructured('RISK_CORRELATED', correlatedPayload as unknown as Record<string, unknown>);

    const zonePayload: ZoneRiskUpdatedPayload = {
      dmaId: snapshot.dma_id,
      correlationId: snapshot.correlation_id,
      integrationRiskState: snapshot.integration_risk_state,
      riskScore: snapshot.risk_score,
      timestamp: new Date(snapshot.last_updated),
    };
    eventBus.emitZoneRiskUpdated(zonePayload);
    this.logStructured('ZONE_RISK_UPDATED', zonePayload as unknown as Record<string, unknown>);

    if (config.integrationAdvisoryEnabled && snapshot.advisory) {
      const advisoryPayload: MpcAdvisoryGeneratedPayload = {
        dmaId: snapshot.dma_id,
        correlationId: snapshot.correlation_id,
        operatorAttentionRequired: snapshot.advisory.operator_attention_required,
        recommendedBoundTightening: snapshot.advisory.recommended_bound_tightening,
        reason: snapshot.advisory.reason,
        timestamp: new Date(snapshot.last_updated),
      };
      eventBus.emitMpcAdvisoryGenerated(advisoryPayload);
      this.logStructured('MPC_ADVISORY_GENERATED', advisoryPayload as unknown as Record<string, unknown>);
    }

    return snapshot;
  }

  private logStructured(event: string, payload: Record<string, unknown>): void {
    console.log(JSON.stringify({
      module: 'integration',
      event,
      ...payload,
    }));
  }
}

export const integrationOrchestrator = new IntegrationOrchestrator();
