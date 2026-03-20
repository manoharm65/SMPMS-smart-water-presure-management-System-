import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { Command } from '../types/index.js';

export class CommandRepository {
  private mapRow(columns: string[], values: any[]): Command {
    const row: any = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return {
      id: row.id,
      nodeId: row.node_id,
      command: row.command,
      status: row.status,
      sentAt: row.sent_at,
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at,
    };
  }

  create(data: { nodeId: string; command: string }): Command {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO commands (id, node_id, command, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, data.nodeId, data.command, 'pending', now]
    );
    return this.findById(id)!;
  }

  findById(id: string): Command | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM commands WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findByNodeId(nodeId: string, limit = 50): Command[] {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM commands WHERE node_id = ? ORDER BY created_at DESC LIMIT ?',
      [nodeId, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  findAll(limit = 100, offset = 0): Command[] {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM commands ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  updateStatus(id: string, status: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    if (status === 'sent') {
      db.run('UPDATE commands SET status = ?, sent_at = ? WHERE id = ?', [status, now, id]);
    } else if (status === 'acknowledged') {
      db.run('UPDATE commands SET status = ?, acknowledged_at = ? WHERE id = ?', [status, now, id]);
    } else {
      db.run('UPDATE commands SET status = ? WHERE id = ?', [status, id]);
    }
  }
}

export const commandRepository = new CommandRepository();
