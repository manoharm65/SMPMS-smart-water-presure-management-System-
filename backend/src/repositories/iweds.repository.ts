import { createHash, randomBytes, randomUUID } from 'crypto';
import { getDatabase } from '../database/db.js';

export type IwedsState = 'NORMAL' | 'SUSPECT' | 'ILLEGAL';
export type IwedsSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | null;

export interface HouseholdConnection {
  householdId: string;
  dmaId: string;
  consumerId: string;
  address: string;
  pipeDiameterMm: number;
  pipeAreaM2: number;
  warnThresholdLps: number;
  alertThresholdLps: number;
  confirmWindowSec: number;
  cooldownSec: number;
  apiKeyHash: string;
  registeredAt: string;
  isActive: boolean;
}

export interface PressureReading {
  dmaId: string;
  pressureBar: number;
  sourceNodeId: string | null;
  timestamp: string;
}

export interface HouseholdFlowReadingInput {
  householdId: string;
  dmaId: string;
  timestamp: string;
  flowRateLps: number;
  qTheoreticalLps: number;
  qExcessLps: number;
  detectionState: IwedsState;
  severityScore: number;
  signalQuality: 'GOOD' | 'POOR' | 'LOST';
  pressureSourceBar: number;
  rssiDbm?: number;
  firmwareVersion?: string;
}

export interface HouseholdFlowReading {
  id: string;
  time: string;
  householdId: string;
  dmaId: string;
  flowRateLps: number;
  qTheoreticalLps: number;
  qExcessLps: number;
  detectionState: IwedsState;
  severityScore: number;
  signalQuality: 'GOOD' | 'POOR' | 'LOST';
  pressureSourceBar: number;
  rssiDbm?: number;
  firmwareVersion?: string;
}

export interface IllegalExtractionEventInput {
  householdId: string;
  dmaId: string;
  onsetTime: string;
  qExcessLps: number;
  severity: NonNullable<IwedsSeverity>;
  severityScore: number;
  webhookFired: boolean;
  webhookAttempts: number;
  webhookStatus: string;
}

export interface IllegalExtractionEvent {
  id: string;
  householdId: string;
  dmaId: string;
  onsetTime: string;
  resolvedTime: string | null;
  qExcessLps: number;
  severity: NonNullable<IwedsSeverity>;
  severityScore: number;
  webhookFired: boolean;
  webhookAttempts: number;
  webhookStatus: string | null;
  resolved: boolean;
  notes: string | null;
  createdAt: string;
}

function mapRow(columns: string[], values: any[]): Record<string, any> {
  const row: Record<string, any> = {};
  columns.forEach((column, idx) => {
    row[column] = values[idx];
  });
  return row;
}

function toIsoOrNow(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function generateIwedsApiKey(): string {
  return randomBytes(24).toString('hex');
}

export class IwedsRepository {
  registerHousehold(input: {
    householdId: string;
    dmaId: string;
    consumerId: string;
    address: string;
    pipeDiameterMm: number;
    pipeAreaM2: number;
    warnThresholdLps: number;
    alertThresholdLps: number;
    confirmWindowSec: number;
    cooldownSec: number;
    apiKey: string;
  }): HouseholdConnection {
    const db = getDatabase();
    const now = new Date().toISOString();
    const apiKeyHash = hashApiKey(input.apiKey);
    db.run(
      `INSERT OR REPLACE INTO household_connections
       (household_id, dma_id, consumer_id, address, pipe_diameter_mm, pipe_area_m2,
        warn_threshold_lps, alert_threshold_lps, confirm_window_sec, cooldown_sec, api_key_hash, registered_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        input.householdId,
        input.dmaId,
        input.consumerId,
        input.address,
        input.pipeDiameterMm,
        input.pipeAreaM2,
        input.warnThresholdLps,
        input.alertThresholdLps,
        input.confirmWindowSec,
        input.cooldownSec,
        apiKeyHash,
        now,
      ]
    );

    return this.getHouseholdById(input.householdId)!;
  }

  getHouseholdById(householdId: string): HouseholdConnection | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM household_connections WHERE household_id = ?', [householdId]);
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const row = mapRow(result[0].columns, result[0].values[0]);
    return {
      householdId: row.household_id,
      dmaId: row.dma_id,
      consumerId: row.consumer_id,
      address: row.address,
      pipeDiameterMm: row.pipe_diameter_mm,
      pipeAreaM2: row.pipe_area_m2,
      warnThresholdLps: row.warn_threshold_lps,
      alertThresholdLps: row.alert_threshold_lps,
      confirmWindowSec: row.confirm_window_sec,
      cooldownSec: row.cooldown_sec,
      apiKeyHash: row.api_key_hash,
      registeredAt: row.registered_at,
      isActive: row.is_active === 1,
    };
  }

  getHouseholdByApiKey(apiKey: string): HouseholdConnection | null {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM household_connections WHERE api_key_hash = ? AND is_active = 1',
      [hashApiKey(apiKey)]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const row = mapRow(result[0].columns, result[0].values[0]);
    return {
      householdId: row.household_id,
      dmaId: row.dma_id,
      consumerId: row.consumer_id,
      address: row.address,
      pipeDiameterMm: row.pipe_diameter_mm,
      pipeAreaM2: row.pipe_area_m2,
      warnThresholdLps: row.warn_threshold_lps,
      alertThresholdLps: row.alert_threshold_lps,
      confirmWindowSec: row.confirm_window_sec,
      cooldownSec: row.cooldown_sec,
      apiKeyHash: row.api_key_hash,
      registeredAt: row.registered_at,
      isActive: row.is_active === 1,
    };
  }

  findLatestPressureByDma(dmaId: string): PressureReading | null {
    const db = getDatabase();
    const result = db.exec(
      'SELECT dma_id, pressure_bar, source_node_id, timestamp FROM pressure_readings WHERE dma_id = ? ORDER BY timestamp DESC LIMIT 1',
      [dmaId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const row = mapRow(result[0].columns, result[0].values[0]);
    return {
      dmaId: row.dma_id,
      pressureBar: row.pressure_bar,
      sourceNodeId: row.source_node_id,
      timestamp: row.timestamp,
    };
  }

  createFlowReading(input: HouseholdFlowReadingInput): HouseholdFlowReading {
    const db = getDatabase();
    const id = randomUUID();
    const time = toIsoOrNow(input.timestamp);
    db.run(
      `INSERT INTO household_flow_readings
       (id, time, household_id, dma_id, flow_rate_lps, q_theoretical_lps, q_excess_lps,
        detection_state, severity_score, signal_quality, pressure_source_bar, rssi_dbm, firmware_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        time,
        input.householdId,
        input.dmaId,
        input.flowRateLps,
        input.qTheoreticalLps,
        input.qExcessLps,
        input.detectionState,
        input.severityScore,
        input.signalQuality,
        input.pressureSourceBar,
        input.rssiDbm ?? null,
        input.firmwareVersion ?? null,
      ]
    );
    return {
      id,
      time,
      householdId: input.householdId,
      dmaId: input.dmaId,
      flowRateLps: input.flowRateLps,
      qTheoreticalLps: input.qTheoreticalLps,
      qExcessLps: input.qExcessLps,
      detectionState: input.detectionState,
      severityScore: input.severityScore,
      signalQuality: input.signalQuality,
      pressureSourceBar: input.pressureSourceBar,
      rssiDbm: input.rssiDbm,
      firmwareVersion: input.firmwareVersion,
    };
  }

  getRecentFlowReadings(householdId: string, sinceIso: string): HouseholdFlowReading[] {
    const db = getDatabase();
    const result = db.exec(
      `SELECT * FROM household_flow_readings
       WHERE household_id = ? AND time >= ?
       ORDER BY time ASC`,
      [householdId, sinceIso]
    );
    if (result.length === 0) {
      return [];
    }
    return result[0].values.map((values) => {
      const row = mapRow(result[0].columns, values);
      return {
        id: row.id,
        time: row.time,
        householdId: row.household_id,
        dmaId: row.dma_id,
        flowRateLps: row.flow_rate_lps,
        qTheoreticalLps: row.q_theoretical_lps,
        qExcessLps: row.q_excess_lps,
        detectionState: row.detection_state,
        severityScore: row.severity_score,
        signalQuality: row.signal_quality,
        pressureSourceBar: row.pressure_source_bar,
        rssiDbm: row.rssi_dbm ?? undefined,
        firmwareVersion: row.firmware_version ?? undefined,
      };
    });
  }

  getLatestFlowReading(householdId: string): HouseholdFlowReading | null {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM household_flow_readings WHERE household_id = ? ORDER BY time DESC LIMIT 1',
      [householdId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const row = mapRow(result[0].columns, result[0].values[0]);
    return {
      id: row.id,
      time: row.time,
      householdId: row.household_id,
      dmaId: row.dma_id,
      flowRateLps: row.flow_rate_lps,
      qTheoreticalLps: row.q_theoretical_lps,
      qExcessLps: row.q_excess_lps,
      detectionState: row.detection_state,
      severityScore: row.severity_score,
      signalQuality: row.signal_quality,
      pressureSourceBar: row.pressure_source_bar,
      rssiDbm: row.rssi_dbm ?? undefined,
      firmwareVersion: row.firmware_version ?? undefined,
    };
  }

  getLastIllegalEvent(householdId: string): IllegalExtractionEvent | null {
    const db = getDatabase();
    const result = db.exec(
      'SELECT * FROM illegal_extraction_events WHERE household_id = ? ORDER BY onset_time DESC LIMIT 1',
      [householdId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const row = mapRow(result[0].columns, result[0].values[0]);
    return {
      id: row.id,
      householdId: row.household_id,
      dmaId: row.dma_id,
      onsetTime: row.onset_time,
      resolvedTime: row.resolved_time,
      qExcessLps: row.q_excess_lps,
      severity: row.severity,
      severityScore: row.severity_score,
      webhookFired: row.webhook_fired === 1,
      webhookAttempts: row.webhook_attempts,
      webhookStatus: row.webhook_status,
      resolved: row.resolved === 1,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  createIllegalEvent(input: IllegalExtractionEventInput): IllegalExtractionEvent {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO illegal_extraction_events
       (id, household_id, dma_id, onset_time, q_excess_lps, severity, severity_score,
        webhook_fired, webhook_attempts, webhook_status, resolved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        input.householdId,
        input.dmaId,
        input.onsetTime,
        input.qExcessLps,
        input.severity,
        input.severityScore,
        input.webhookFired ? 1 : 0,
        input.webhookAttempts,
        input.webhookStatus,
        now,
      ]
    );
    return this.getLastIllegalEvent(input.householdId)!;
  }

  listAlerts(filters: {
    dmaId?: string;
    from?: string;
    to?: string;
    severity?: string;
    limit: number;
  }): IllegalExtractionEvent[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.dmaId) {
      conditions.push('dma_id = ?');
      params.push(filters.dmaId);
    }
    if (filters.from) {
      conditions.push('onset_time >= ?');
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push('onset_time <= ?');
      params.push(filters.to);
    }
    if (filters.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(filters.limit);

    const result = db.exec(
      `SELECT * FROM illegal_extraction_events
       ${whereClause}
       ORDER BY onset_time DESC
       LIMIT ?`,
      params
    );
    if (result.length === 0) {
      return [];
    }
    return result[0].values.map((values) => {
      const row = mapRow(result[0].columns, values);
      return {
        id: row.id,
        householdId: row.household_id,
        dmaId: row.dma_id,
        onsetTime: row.onset_time,
        resolvedTime: row.resolved_time,
        qExcessLps: row.q_excess_lps,
        severity: row.severity,
        severityScore: row.severity_score,
        webhookFired: row.webhook_fired === 1,
        webhookAttempts: row.webhook_attempts,
        webhookStatus: row.webhook_status,
        resolved: row.resolved === 1,
        notes: row.notes,
        createdAt: row.created_at,
      };
    });
  }

  countAlertsForLastDays(householdId: string, days: number): number {
    const db = getDatabase();
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = db.exec(
      'SELECT COUNT(*) AS total FROM illegal_extraction_events WHERE household_id = ? AND onset_time >= ?',
      [householdId, fromDate]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return 0;
    }
    return Number(result[0].values[0][0]) || 0;
  }
}

export const iwedsRepository = new IwedsRepository();
