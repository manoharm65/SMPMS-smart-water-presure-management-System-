import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { Decision } from '../types/index.js';

export class DecisionRepository {
  private mapRow(columns: string[], values: any[]): Decision {
    const row: any = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return {
      id: row.id,
      nodeId: row.node_id,
      telemetryId: row.telemetry_id,
      riskLevel: row.risk_level,
      action: row.action,
      requiresAlert: row.requires_alert === 1,
      confidence: row.confidence ?? 0.5,
      reason: row.reason ?? '',
      recommendedValvePosition: row.recommended_valve_position ?? 0,
      alertSeverity: row.alert_severity ?? 'ok',
      engine: row.engine,
      createdAt: row.created_at,
    };
  }

  create(data: {
    nodeId: string;
    telemetryId?: string;
    riskLevel: string;
    action: string;
    requiresAlert: boolean;
    confidence: number;
    reason: string;
    recommendedValvePosition: number;
    alertSeverity: string;
    engine?: string;
  }): Decision {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO decisions (id, node_id, telemetry_id, risk_level, action, requires_alert, confidence, reason, recommended_valve_position, alert_severity, engine, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.nodeId, data.telemetryId ?? null, data.riskLevel, data.action, data.requiresAlert ? 1 : 0, data.confidence, data.reason, data.recommendedValvePosition, data.alertSeverity, data.engine ?? 'rule', now]
    );
    return this.findById(id)!;
  }

  findById(id: string): Decision | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM decisions WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findByNodeId(nodeId: string, limit = 50): Decision[] {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM decisions WHERE node_id = ? ORDER BY created_at DESC LIMIT ?',
      [nodeId, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  findLatestByNodeId(nodeId: string): Decision | null {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM decisions WHERE node_id = ? ORDER BY created_at DESC LIMIT 1',
      [nodeId]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }
}

export const decisionRepository = new DecisionRepository();
