import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { Node, ValveState, ValveMode } from '../types/index.js';

export class NodeRepository {
  private mapRow(columns: string[], values: any[]): Node {
    const row: any = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return {
      id: row.id,
      nodeId: row.node_id,
      name: row.name,
      location: row.location,
      isActive: row.is_active === 1,
      valvePosition: row.valve_position ?? 50,
      valveMode: (row.valve_mode as ValveMode) ?? 'auto',
      currentPosition: row.current_position ?? row.valve_position ?? 50,
      targetPosition: row.target_position ?? 0,
      lastCommandId: row.last_command_id ?? undefined,
      lastValveUpdate: row.last_valve_update ?? undefined,
      status: row.status as 'online' | 'offline' | 'degraded' | undefined,
      lastSeen: row.last_seen ?? undefined,
      apiKey: row.api_key ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findAll(): Node[] {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM nodes ORDER BY node_id');
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  findByNodeId(nodeId: string): Node | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM nodes WHERE node_id = ?', [nodeId]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findById(id: string): Node | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM nodes WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  create(nodeId: string, name?: string, location?: string): Node {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO nodes (id, node_id, name, location, is_active, valve_position, valve_mode, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 50, ?, ?, ?)',
      [id, nodeId, name || null, location || null, 'auto', now, now]
    );
    return this.findById(id)!;
  }

  update(id: string, updates: { name?: string; location?: string; isActive?: boolean; valvePosition?: number; valveMode?: 'auto' | 'override' }): Node | null {
    const node = this.findById(id);
    if (!node) return null;

    const now = new Date().toISOString();
    const db = getDatabase();
    db.run(
      'UPDATE nodes SET name = ?, location = ?, is_active = ?, valve_position = ?, valve_mode = ?, updated_at = ? WHERE id = ?',
      [
        updates.name ?? node.name ?? null,
        updates.location ?? node.location ?? null,
        updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : (node.isActive ? 1 : 0),
        updates.valvePosition ?? node.valvePosition ?? 50,
        updates.valveMode ?? node.valveMode ?? 'auto',
        now,
        id,
      ]
    );
    return this.findById(id);
  }

  exists(nodeId: string): boolean {
    const db = getDatabase();
    const result = db.exec('SELECT 1 FROM nodes WHERE node_id = ?', [nodeId]);
    return result.length > 0 && result[0].values.length > 0;
  }

  findByApiKey(apiKey: string): Node | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM nodes WHERE api_key = ?', [apiKey]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  updateStatusAndLastSeen(nodeId: string, status: 'online' | 'offline' | 'degraded', lastSeen?: string): void {
    const db = getDatabase();
    const now = lastSeen ?? new Date().toISOString();
    db.run('UPDATE nodes SET status = ?, last_seen = ?, updated_at = ? WHERE node_id = ?', [status, now, now, nodeId]);
  }

  updateApiKey(nodeId: string, apiKey: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.run('UPDATE nodes SET api_key = ?, updated_at = ? WHERE node_id = ?', [apiKey, now, nodeId]);
  }

  checkNodeStatus(nodeId: string, telemetryIntervalMs: number): 'online' | 'offline' {
    const db = getDatabase();
    const result = db.exec('SELECT last_seen FROM nodes WHERE node_id = ?', [nodeId]);
    if (result.length === 0 || result[0].values.length === 0) return 'offline';

    const lastSeen = result[0].values[0][0] as string | null;
    if (!lastSeen) return 'offline';

    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    const threshold = telemetryIntervalMs * 2;

    if (now - lastSeenTime > threshold) {
      // Mark as offline
      const nowStr = new Date().toISOString();
      db.run('UPDATE nodes SET status = ?, updated_at = ? WHERE node_id = ?', ['offline', nowStr, nodeId]);
      return 'offline';
    }
    return 'online';
  }

  getValveState(nodeId: string): ValveState | null {
    const node = this.findByNodeId(nodeId);
    if (!node) return null;
    return {
      nodeId: node.nodeId,
      currentPosition: node.currentPosition ?? node.valvePosition ?? 50,
      targetPosition: node.targetPosition ?? 0,
      mode: node.valveMode ?? 'auto',
      lastCommandId: node.lastCommandId,
      lastUpdated: node.lastValveUpdate,
    };
  }

  updateValveState(nodeId: string, updates: {
    currentPosition?: number;
    targetPosition?: number;
    mode?: ValveMode;
    lastCommandId?: string;
  }): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const sets: string[] = ['last_valve_update = ?'];
    const values: any[] = [now];

    if (updates.currentPosition !== undefined) {
      sets.push('current_position = ?');
      values.push(updates.currentPosition);
    }
    if (updates.targetPosition !== undefined) {
      sets.push('target_position = ?');
      values.push(updates.targetPosition);
    }
    if (updates.mode !== undefined) {
      sets.push('valve_mode = ?');
      values.push(updates.mode);
    }
    if (updates.lastCommandId !== undefined) {
      sets.push('last_command_id = ?');
      values.push(updates.lastCommandId);
    }

    values.push(nodeId);
    db.run(`UPDATE nodes SET ${sets.join(', ')} WHERE node_id = ?`, values);
  }

  updateValveMode(nodeId: string, mode: ValveMode): void {
    this.updateValveState(nodeId, { mode });
  }
}

export const nodeRepository = new NodeRepository();
