import { randomUUID } from 'crypto';
import { getDatabase } from '../../database/db.js';
import {
  CanonicalIntegrationEvent,
  IntegrationContributor,
  IntegrationRiskState,
  IntegrationZoneSnapshot,
} from './integration.types.js';
import { scoreToState, stateToScore } from './integration.mapper.js';

function mapRow(columns: string[], values: any[]): Record<string, any> {
  const row: Record<string, any> = {};
  columns.forEach((column, idx) => {
    row[column] = values[idx];
  });
  return row;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class IntegrationRepository {
  recordEvent(event: CanonicalIntegrationEvent): void {
    const db = getDatabase();
    db.run(
      `INSERT OR IGNORE INTO integration_events
       (event_id, correlation_id, source_module, event_type, integration_risk_state, risk_level, confidence, node_id, dma_id, household_id, timestamp, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.event_id,
        event.correlation_id,
        event.source_module,
        event.event_type,
        event.integration_risk_state,
        event.risk_level,
        event.confidence,
        event.node_id ?? null,
        event.dma_id ?? null,
        event.household_id ?? null,
        event.timestamp,
        JSON.stringify(event.payload || {}),
      ]
    );
  }

  listEvents(filters: {
    dmaId?: string;
    from?: string;
    to?: string;
    severity?: IntegrationRiskState;
    limit: number;
  }): CanonicalIntegrationEvent[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.dmaId) {
      conditions.push('dma_id = ?');
      params.push(filters.dmaId);
    }
    if (filters.from) {
      conditions.push('timestamp >= ?');
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push('timestamp <= ?');
      params.push(filters.to);
    }
    if (filters.severity) {
      conditions.push('integration_risk_state = ?');
      params.push(filters.severity);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(filters.limit);
    const result = db.exec(
      `SELECT * FROM integration_events
       ${where}
       ORDER BY timestamp DESC
       LIMIT ?`,
      params
    );
    if (result.length === 0) return [];

    return result[0].values.map((values) => {
      const row = mapRow(result[0].columns, values);
      return {
        event_id: row.event_id,
        source_module: row.source_module,
        event_type: row.event_type,
        node_id: row.node_id ?? undefined,
        dma_id: row.dma_id ?? undefined,
        household_id: row.household_id ?? undefined,
        timestamp: row.timestamp,
        risk_level: row.risk_level ?? 'NORMAL',
        confidence: Number(row.confidence ?? 0.5),
        integration_risk_state: row.integration_risk_state,
        correlation_id: row.correlation_id,
        payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
      } as CanonicalIntegrationEvent;
    });
  }

  recomputeZoneSnapshot(dmaId: string, correlationWindowSec: number): IntegrationZoneSnapshot | null {
    const db = getDatabase();
    const fromIso = new Date(Date.now() - correlationWindowSec * 1000).toISOString();
    const result = db.exec(
      `SELECT * FROM integration_events
       WHERE dma_id = ? AND timestamp >= ?
       ORDER BY timestamp DESC
       LIMIT 200`,
      [dmaId, fromIso]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const events = result[0].values.map((values) => {
      const row = mapRow(result[0].columns, values);
      return {
        source_module: row.source_module,
        event_type: row.event_type,
        integration_risk_state: row.integration_risk_state as IntegrationRiskState,
        risk_level: row.risk_level ?? 'NORMAL',
        confidence: Number(row.confidence ?? 0.5),
        timestamp: row.timestamp,
        correlation_id: row.correlation_id,
      } as IntegrationContributor;
    });

    const topScore = Math.max(...events.map((event) => stateToScore(event.integration_risk_state)));
    const averageConfidence = events.reduce((sum, event) => sum + event.confidence, 0) / Math.max(events.length, 1);
    const riskScore = Number((Math.min(1, topScore * 0.75 + averageConfidence * 0.25)).toFixed(4));
    const integrationRiskState = scoreToState(riskScore);
    const newest = events[0];

    const advisory = this.buildAdvisory(events, integrationRiskState);

    db.run(
      `INSERT OR REPLACE INTO integration_zone_snapshots
       (dma_id, last_updated, integration_risk_state, risk_score, contributors_json, advisory_json, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dmaId,
        newest.timestamp,
        integrationRiskState,
        riskScore,
        JSON.stringify(events.slice(0, 25)),
        advisory ? JSON.stringify(advisory) : null,
        newest.correlation_id,
      ]
    );

    return {
      dma_id: dmaId,
      last_updated: newest.timestamp,
      integration_risk_state: integrationRiskState,
      risk_score: riskScore,
      contributors: events.slice(0, 25),
      advisory,
      correlation_id: newest.correlation_id,
    };
  }

  getZoneSnapshot(dmaId: string): IntegrationZoneSnapshot | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM integration_zone_snapshots WHERE dma_id = ?', [dmaId]);
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const row = mapRow(result[0].columns, result[0].values[0]);
    return {
      dma_id: row.dma_id,
      last_updated: row.last_updated,
      integration_risk_state: row.integration_risk_state,
      risk_score: Number(row.risk_score),
      contributors: parseJson<IntegrationContributor[]>(row.contributors_json, []),
      advisory: parseJson(row.advisory_json, null),
      correlation_id: row.correlation_id,
    };
  }

  listSnapshots(limit = 200): IntegrationZoneSnapshot[] {
    const db = getDatabase();
    const result = db.exec(
      `SELECT * FROM integration_zone_snapshots
       ORDER BY last_updated DESC
       LIMIT ?`,
      [limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map((values) => {
      const row = mapRow(result[0].columns, values);
      return {
        dma_id: row.dma_id,
        last_updated: row.last_updated,
        integration_risk_state: row.integration_risk_state,
        risk_score: Number(row.risk_score),
        contributors: parseJson<IntegrationContributor[]>(row.contributors_json, []),
        advisory: parseJson(row.advisory_json, null),
        correlation_id: row.correlation_id,
      };
    });
  }

  runBackfill(limitPerSource = 200): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    let inserted = 0;

    const iweds = db.exec(
      `SELECT id, dma_id, household_id, severity, severity_score, onset_time, q_excess_lps
       FROM illegal_extraction_events
       ORDER BY onset_time DESC
       LIMIT ?`,
      [limitPerSource]
    );
    if (iweds.length > 0) {
      for (const values of iweds[0].values) {
        const row = mapRow(iweds[0].columns, values);
        const eventId = `backfill-iweds-${row.id}`;
        db.run(
          `INSERT OR IGNORE INTO integration_events
           (event_id, correlation_id, source_module, event_type, integration_risk_state, risk_level, confidence, dma_id, household_id, timestamp, payload_json, created_at)
           VALUES (?, ?, 'IWEDS', 'IWEDS_ILLEGAL_EVENT', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            `backfill-${String(row.dma_id || 'UNKNOWN').replace(/_/g, '-').toUpperCase()}`,
            row.severity === 'HIGH' ? 'CRITICAL' : 'HIGH',
            row.severity || 'ILLEGAL',
            Number(row.severity_score || 0.9),
            String(row.dma_id || '').replace(/_/g, '-').toUpperCase(),
            row.household_id,
            row.onset_time,
            JSON.stringify({ q_excess_lps: row.q_excess_lps }),
            now,
          ]
        );
        inserted++;
      }
    }

    const decisions = db.exec(
      `SELECT id, node_id, risk_level, confidence, created_at, action
       FROM decisions
       ORDER BY created_at DESC
       LIMIT ?`,
      [limitPerSource]
    );
    if (decisions.length > 0) {
      for (const values of decisions[0].values) {
        const row = mapRow(decisions[0].columns, values);
        const eventId = `backfill-decision-${row.id}`;
        const mappedRisk = row.risk_level === 'CRITICAL'
          ? 'CRITICAL'
          : row.risk_level === 'LOW'
            ? 'HIGH'
            : row.risk_level === 'WARNING'
              ? 'ELEVATED'
              : 'NORMAL';
        db.run(
          `INSERT OR IGNORE INTO integration_events
           (event_id, correlation_id, source_module, event_type, integration_risk_state, risk_level, confidence, node_id, dma_id, timestamp, payload_json, created_at)
           VALUES (?, ?, 'DECISION', 'DECISION_BACKFILL', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            `backfill-${String(row.node_id || 'UNKNOWN').replace(/_/g, '-').toUpperCase()}`,
            mappedRisk,
            row.risk_level || 'NORMAL',
            Number(row.confidence || 0.5),
            row.node_id,
            String(row.node_id || '').replace(/_/g, '-').toUpperCase(),
            row.created_at,
            JSON.stringify({ action: row.action }),
            now,
          ]
        );
        inserted++;
      }
    }

    return inserted;
  }

  private buildAdvisory(events: IntegrationContributor[], state: IntegrationRiskState): {
    operator_attention_required: boolean;
    recommended_bound_tightening: number;
    reason: string;
  } | null {
    const hasIweds = events.some((event) => event.source_module === 'IWEDS' && (event.integration_risk_state === 'HIGH' || event.integration_risk_state === 'CRITICAL'));
    const hasMl = events.some((event) => event.source_module === 'LEAK_ML' && (event.integration_risk_state === 'HIGH' || event.integration_risk_state === 'CRITICAL'));
    const hasMpc = events.some((event) => event.source_module === 'MPC' || event.source_module === 'DECISION');
    if (!hasMpc) return null;

    const attention = state === 'HIGH' || state === 'CRITICAL';
    let tightening = 0;
    let reason = 'No additional advisory';

    if (hasIweds && hasMl) {
      tightening = state === 'CRITICAL' ? 0.25 : 0.15;
      reason = 'IWEDS and Leak ML both indicate elevated extraction/leakage risk';
    } else if (hasIweds || hasMl) {
      tightening = state === 'CRITICAL' ? 0.2 : 0.1;
      reason = hasIweds
        ? 'IWEDS indicates illegal extraction risk'
        : 'Leak ML indicates anomaly risk';
    }

    return {
      operator_attention_required: attention,
      recommended_bound_tightening: Number(tightening.toFixed(2)),
      reason,
    };
  }
}

export const integrationRepository = new IntegrationRepository();
