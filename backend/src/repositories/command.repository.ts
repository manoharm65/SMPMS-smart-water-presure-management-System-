import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { Command, CommandPriority } from '../types/index.js';

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
      priority: row.priority as CommandPriority | undefined,
      targetPosition: row.target_position,
      executedPosition: row.executed_position,
      sentAt: row.sent_at,
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at,
    };
  }

  create(data: { nodeId: string; command: string; priority?: CommandPriority; targetPosition?: number }): Command {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO commands (id, node_id, command, status, priority, target_position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.nodeId, data.command, 'PENDING', data.priority || 'normal', data.targetPosition ?? null, now]
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

  updateStatus(id: string, status: string, executedPosition?: number): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    if (status === 'DISPATCHED') {
      db.run('UPDATE commands SET status = ?, sent_at = ? WHERE id = ?', [status, now, id]);
    } else if (status === 'EXECUTED') {
      db.run(
        'UPDATE commands SET status = ?, acknowledged_at = ?, executed_position = ? WHERE id = ?',
        [status, now, executedPosition ?? null, id]
      );
    } else if (status === 'FAILED') {
      db.run('UPDATE commands SET status = ?, acknowledged_at = ? WHERE id = ?', [status, now, id]);
    } else {
      db.run('UPDATE commands SET status = ? WHERE id = ?', [status, id]);
    }
  }

  findPendingByNodeId(nodeId: string): Command | null {
    const db = getDatabase();
    const result = db.exec(
      "SELECT * FROM commands WHERE node_id = ? AND status = 'PENDING' ORDER BY created_at ASC LIMIT 1",
      [nodeId]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findDispatchedByNodeId(nodeId: string): Command | null {
    const db = getDatabase();
    const result = db.exec(
      "SELECT * FROM commands WHERE node_id = ? AND status = 'DISPATCHED' ORDER BY created_at ASC LIMIT 1",
      [nodeId]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findActiveByNodeId(nodeId: string): Command | null {
    const db = getDatabase();
    const result = db.exec(
      "SELECT * FROM commands WHERE node_id = ? AND status IN ('PENDING', 'DISPATCHED') ORDER BY created_at ASC LIMIT 1",
      [nodeId]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  cancelByNodeId(nodeId: string): number {
    const db = getDatabase();
    db.run(
      "UPDATE commands SET status = 'FAILED' WHERE node_id = ? AND status IN ('PENDING', 'DISPATCHED')",
      [nodeId]
    );
    return 1;
  }

  findTimedOutCommands(thresholdMs: number): Command[] {
    const db = getDatabase();
    const cutoff = new Date(Date.now() - thresholdMs).toISOString();
    const result = db.exec(
      "SELECT * FROM commands WHERE status = 'DISPATCHED' AND sent_at < ?",
      [cutoff]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  findOldestPendingByNodeId(nodeId: string): Command | null {
    const db = getDatabase();
    const result = db.exec(
      "SELECT * FROM commands WHERE node_id = ? AND status = 'PENDING' ORDER BY created_at ASC LIMIT 1",
      [nodeId]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findByIdAndNodeId(id: string, nodeId: string): Command | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM commands WHERE id = ? AND node_id = ?', [id, nodeId]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }
}

export const commandRepository = new CommandRepository();
