import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { Alert } from '../types/index.js';

export class AlertRepository {
  private mapRow(columns: string[], values: any[]): Alert {
    const row: any = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return {
      id: row.id,
      nodeId: row.node_id,
      message: row.message,
      riskLevel: row.risk_level,
      sent: row.sent === 1,
      sentAt: row.sent_at,
      createdAt: row.created_at,
    };
  }

  create(data: { nodeId: string; message: string; riskLevel: string }): Alert {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO alerts (id, node_id, message, risk_level, sent, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      [id, data.nodeId, data.message, data.riskLevel, now]
    );
    return this.findById(id)!;
  }

  findById(id: string): Alert | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM alerts WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findAll(limit = 100, offset = 0): Alert[] {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM alerts ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  findByNodeId(nodeId: string, limit = 50): Alert[] {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM alerts WHERE node_id = ? ORDER BY created_at DESC LIMIT ?',
      [nodeId, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  markSent(id: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE alerts SET sent = 1, sent_at = ? WHERE id = ?', [now, id]);
  }

  count(): number {
    const db = getDatabase();
    const result = db.exec('SELECT COUNT(*) as count FROM alerts');
    if (result.length === 0) return 0;
    return result[0].values[0][0] as number;
  }
}

export const alertRepository = new AlertRepository();
