import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { Telemetry } from '../types/index.js';

export class TelemetryRepository {
  private mapRow(columns: string[], values: any[]): Telemetry {
    const row: any = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return {
      id: row.id,
      nodeId: row.node_id,
      pressure: row.pressure,
      flowRate: row.flow_rate,
      temperature: row.temperature,
      batteryLevel: row.battery_level,
      timestamp: row.timestamp,
    };
  }

  create(data: {
    nodeId: string;
    pressure: number;
    flowRate?: number;
    temperature?: number;
    batteryLevel?: number;
  }): Telemetry {
    const db = getDatabase();
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    db.run(
      'INSERT INTO telemetry (id, node_id, pressure, flow_rate, temperature, battery_level, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.nodeId, data.pressure, data.flowRate ?? null, data.temperature ?? null, data.batteryLevel ?? null, timestamp]
    );
    return this.findById(id)!;
  }

  findById(id: string): Telemetry | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM telemetry WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findLatestByNodeId(nodeId: string, limit = 10): Telemetry[] {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM telemetry WHERE node_id = ? ORDER BY timestamp DESC LIMIT ?',
      [nodeId, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  findLatest(): Telemetry[] {
    const db = getDatabase();
    const result = db.exec(`
      SELECT t.* FROM telemetry t
      INNER JOIN (
        SELECT node_id, MAX(timestamp) as max_ts
        FROM telemetry
        GROUP BY node_id
      ) latest ON t.node_id = latest.node_id AND t.timestamp = latest.max_ts
    `);
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }

  findByNodeId(nodeId: string, limit = 100): Telemetry[] {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM telemetry WHERE node_id = ? ORDER BY timestamp DESC LIMIT ?',
      [nodeId, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }
}

export const telemetryRepository = new TelemetryRepository();
