import { nodeRepository } from '../../repositories/node.repository.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { alertRepository } from '../../repositories/alert.repository.js';
import { decisionRepository } from '../../repositories/decision.repository.js';
import { commandRepository } from '../../repositories/command.repository.js';
import { commandService } from '../command/command.service.js';
import { config } from '../../core/config.js';
import { existsSync, readFileSync } from 'fs';
import { ZoneSummary, KpiData, AlertData, PressureHistory, PressureReading, ZoneDetail, AnomalyData } from './types.js';

function toZoneId(nodeId: string): string {
  if (nodeId.startsWith('valve_')) {
    return 'VALVE-' + nodeId.replace('valve_', '');
  }
  return nodeId.replace('DMA_', 'DMA-');
}

function fromZoneId(zoneId: string): string {
  if (zoneId.startsWith('VALVE-')) {
    return 'valve_' + zoneId.replace('VALVE-', '').toLowerCase();
  }
  return zoneId.replace('DMA-', 'DMA_');
}

function getStatus(pressure: number): 'ok' | 'warn' | 'low' | 'crit' {
  if (pressure < 1.5) return 'crit';
  if (pressure < 2.0) return 'low';
  if (pressure > 5.5) return 'crit';
  if (pressure > 5.0) return 'warn';
  return 'ok';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTimeWithSeconds(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function mapSeverity(riskLevel: string): 'crit' | 'warn' | 'low' {
  const upper = riskLevel.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'HIGH') return 'crit';
  if (upper === 'WARNING' || upper === 'MEDIUM') return 'warn';
  return 'low';
}

type MlPredictionRecord = {
  timestamp: string;
  node_id: string;
  anomaly_flag: number;
  anomaly_score: number;
  predicted_event: string;
  event_explanation: string;
  unexplained_pressure_drop: number;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (c === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += c;
  }

  values.push(current);
  return values;
}

function normalizeNodeId(nodeId: string): string {
  return nodeId.replace(/_/g, '-').toUpperCase();
}

function toMlConfidence(score: number, unexplainedDrop: number): number {
  const bounded = Math.max(0, Math.min(1, score));
  const base = Math.round(bounded * 100);
  if (unexplainedDrop === 1) return Math.min(99, Math.max(base, 85));
  return Math.max(30, base);
}

function readMlPredictionsForNode(nodeId: string): MlPredictionRecord[] {
  const csvPath = config.mlPredictionsCsvPath;
  if (!existsSync(csvPath)) return [];

  const content = readFileSync(csvPath, 'utf-8').trim();
  if (!content) return [];

  const lines = content.split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);
  const headerIndex = new Map<string, number>();
  headers.forEach((h, idx) => headerIndex.set(h, idx));

  const get = (row: string[], key: string): string => {
    const idx = headerIndex.get(key);
    if (idx === undefined || idx >= row.length) return '';
    return row[idx];
  };

  const normalizedTarget = normalizeNodeId(nodeId);
  const records: MlPredictionRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCsvLine(line);
    const rowNode = normalizeNodeId(get(row, 'node_id'));
    if (rowNode !== normalizedTarget) continue;

    records.push({
      timestamp: get(row, 'timestamp'),
      node_id: get(row, 'node_id'),
      anomaly_flag: parseInt(get(row, 'anomaly_flag') || '0', 10),
      anomaly_score: parseFloat(get(row, 'anomaly_score') || '0'),
      predicted_event: get(row, 'predicted_event') || 'normal',
      event_explanation: get(row, 'event_explanation') || 'No explanation available',
      unexplained_pressure_drop: parseInt(get(row, 'unexplained_pressure_drop') || '0', 10),
    });
  }

  return records
    .filter(r => r.anomaly_flag === 1)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

export class DashboardService {
  private motorizedFlowEnabled = false;

  getNodesTelemetry(nodeIds: string[]) {
    const ids = nodeIds
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const mapStatus = (status?: string): 'live' | 'offline' | 'error' => {
      if (status === 'online') return 'live';
      if (status === 'degraded') return 'error';
      return 'offline';
    };

    return ids.map((nodeId) => {
      const node = nodeRepository.findByNodeId(nodeId);
      const latestTelemetry = telemetryRepository.findLatestByNodeId(nodeId, 1)[0];

      const pressure = latestTelemetry?.pressure ?? 0;
      const flowRate = latestTelemetry?.flowRate;
      const valvePosition =
        latestTelemetry?.valvePosition ?? node?.currentPosition ?? node?.valvePosition ?? 0;

      return {
        node_id: nodeId,
        pressure,
        flow_rate: flowRate,
        flow_sensor: flowRate,
        valve_position: valvePosition,
        status: mapStatus(node?.status),
        last_update: latestTelemetry?.timestamp ?? node?.lastSeen ?? new Date(0).toISOString(),
      };
    });
  }

  getSmartMeters(meterIds: string[]) {
    const ids = meterIds
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const houseTelemetry = telemetryRepository.findLatestByNodeId('house_1', 1)[0];
    const baseFlow = houseTelemetry?.flowRate ?? 0;
    const actualFlow = this.motorizedFlowEnabled ? baseFlow * 1.35 : baseFlow;

    return ids.map((meterId) => ({
      meter_id: meterId,
      actual_flow: Math.round(actualFlow * 100) / 100,
      cumulative_volume: Math.round(actualFlow * 100),
      last_update: houseTelemetry?.timestamp ?? new Date().toISOString(),
      battery_status: 'ok' as const,
      signal_strength: 85,
    }));
  }

  toggleMotorizedFlow(enabled: boolean) {
    this.motorizedFlowEnabled = enabled;

    const houseTelemetry = telemetryRepository.findLatestByNodeId('house_1', 1)[0];
    const baseFlow = Math.round((houseTelemetry?.flowRate ?? 0) * 100) / 100;
    const boosted = Math.round(baseFlow * 1.35 * 100) / 100;

    return {
      enabled,
      base_flow: baseFlow,
      motorized_flow: enabled ? boosted : 0,
      total_flow: enabled ? boosted : baseFlow,
      pump_power_watts: enabled ? 750 : 0,
      estimated_increase_percent: enabled ? 35 : 0,
      timestamp: new Date().toISOString(),
    };
  }

  getZones(): ZoneSummary[] {
    const nodes = nodeRepository.findAll();
    const zones: ZoneSummary[] = [];

    for (const node of nodes) {
      const latestTelemetry = telemetryRepository.findLatestByNodeId(node.nodeId, 1);
      const pressure = latestTelemetry.length > 0 ? latestTelemetry[0].pressure : 0;

      // Trend: compare latest to reading from ~15 min ago
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const olderTelemetry = telemetryRepository.findByNodeId(node.nodeId, 100)
        .find(t => new Date(t.timestamp) < new Date(fifteenMinAgo));
      const olderPressure = olderTelemetry?.pressure ?? pressure;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      const diff = pressure - olderPressure;
      if (diff > 0.2) trend = 'up';
      else if (diff < -0.2) trend = 'down';

      const latestDecision = decisionRepository.findLatestByNodeId(node.nodeId);
      const aiConfidence = latestDecision ? Math.round((latestDecision.riskLevel === 'LOW' ? 0.9 : latestDecision.riskLevel === 'MEDIUM' ? 0.6 : 0.3) * 100) : 50;

      zones.push({
        id: toZoneId(node.nodeId),
        name: node.name ?? node.nodeId,
        lat: 0,
        lng: 0,
        pressure: Math.round(pressure * 100) / 100,
        valve_position: node.valvePosition ?? 50,
        ai_confidence: aiConfidence,
        status: getStatus(pressure),
        trend,
        last_reading: latestTelemetry.length > 0 ? formatTime(latestTelemetry[0].timestamp) : '--:--',
      });
    }

    return zones;
  }

  getKpi(): KpiData {
    const nodes = nodeRepository.findAll();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let zonesOnline = 0;
    let totalPressure = 0;
    let pressureCount = 0;

    for (const node of nodes) {
      const latest = telemetryRepository.findLatestByNodeId(node.nodeId, 1);
      if (latest.length > 0 && new Date(latest[0].timestamp) > new Date(fiveMinAgo)) {
        zonesOnline++;
        totalPressure += latest[0].pressure;
        pressureCount++;
      }
    }

    const alerts = alertRepository.findAll(100, 0);
    const activeAlerts = alerts.filter(a => !a.sent).length;

    const today = new Date().toISOString().split('T')[0];
    const todayCommands = commandRepository.findAll(100, 0)
      .filter(c => c.createdAt.startsWith(today));

    // Count leaks: CRITICAL decisions with REDUCE action
    let leaksFlagged = 0;
    for (const node of nodes) {
      const decisions = decisionRepository.findByNodeId(node.nodeId, 1000);
      leaksFlagged += decisions.filter(d => d.riskLevel === 'LOW' && d.action.includes('REDUCE')).length;
    }

    return {
      zones_online: zonesOnline,
      zones_total: nodes.length || 8,
      avg_pressure: pressureCount > 0 ? Math.round((totalPressure / pressureCount) * 100) / 100 : 0,
      active_alerts: activeAlerts,
      leaks_flagged: leaksFlagged,
      valve_ops: todayCommands.length,
    };
  }

  getAlerts(): AlertData[] {
    const alerts = alertRepository.findAll(100, 0)
      .filter(a => !a.acknowledged);

    return alerts.map(alert => {
      const node = nodeRepository.findByNodeId(alert.nodeId);
      const alertData = {
        id: alert.id,
        zone_id: toZoneId(alert.nodeId),
        zone_name: node?.name ?? alert.nodeId,
        severity: mapSeverity(alert.riskLevel),
        message: alert.message,
        time: formatTime(alert.createdAt),
      };
      console.log(`[Dashboard] Alert: ${alert.id} | Severity: ${alertData.severity} (from ${alert.riskLevel}) | Zone: ${alertData.zone_id}`);
      return alertData;
    });
  }

  getPressureHistory(zoneId: string, range: '24h' | '7d'): PressureHistory {
    const nodeId = fromZoneId(zoneId);

    if (range === '24h') {
      const now = new Date();
      const readings: PressureReading[] = [];

      for (let h = 23; h >= 0; h--) {
        const hourStart = new Date(now.getTime() - h * 60 * 60 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        const inRange = telemetryRepository.findByNodeId(nodeId, 1000)
          .filter(t => {
            const ts = new Date(t.timestamp);
            return ts >= hourStart && ts < hourEnd;
          });

        const avgPressure = inRange.length > 0
          ? inRange.reduce((sum, t) => sum + t.pressure, 0) / inRange.length
          : readings.length > 0 ? readings[readings.length - 1].pressure : 3.5;

        readings.push({
          label: `${hourStart.getHours().toString().padStart(2, '0')}:00`,
          pressure: Math.round(avgPressure * 100) / 100,
        });
      }

      return { zone_id: zoneId, range: '24h', readings };
    } else {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const now = new Date();
      const readings: PressureReading[] = [];

      for (let d = 6; d >= 0; d--) {
        const dayStart = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const inRange = telemetryRepository.findByNodeId(nodeId, 10000)
          .filter(t => {
            const ts = new Date(t.timestamp);
            return ts >= dayStart && ts < dayEnd;
          });

        const avgPressure = inRange.length > 0
          ? inRange.reduce((sum, t) => sum + t.pressure, 0) / inRange.length
          : readings.length > 0 ? readings[readings.length - 1].pressure : 3.5;

        readings.push({
          label: days[dayStart.getDay()],
          pressure: Math.round(avgPressure * 100) / 100,
        });
      }

      return { zone_id: zoneId, range: '7d', readings };
    }
  }

  getZoneDetail(zoneId: string): ZoneDetail | null {
    const nodeId = fromZoneId(zoneId);
    const node = nodeRepository.findByNodeId(nodeId);
    if (!node) return null;

    const latestTelemetry = telemetryRepository.findLatestByNodeId(nodeId, 1);
    const pressure = latestTelemetry.length > 0 ? latestTelemetry[0].pressure : 0;

    const today = new Date().toISOString().split('T')[0];
    const todayTelemetry = telemetryRepository.findByNodeId(nodeId, 1000)
      .filter(t => t.timestamp.startsWith(today));

    const pressures = todayTelemetry.map(t => t.pressure);
    const minToday = pressures.length > 0 ? Math.min(...pressures) : 0;
    const maxToday = pressures.length > 0 ? Math.max(...pressures) : 0;
    const avgToday = pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekTelemetry = telemetryRepository.findByNodeId(nodeId, 10000)
      .filter(t => new Date(t.timestamp) >= new Date(sevenDaysAgo));
    const avg7d = weekTelemetry.length > 0
      ? weekTelemetry.reduce((sum, t) => sum + t.pressure, 0) / weekTelemetry.length
      : avgToday;

    const latestDecision = decisionRepository.findLatestByNodeId(nodeId);

    return {
      id: zoneId,
      name: node.name ?? node.nodeId,
      pressure: Math.round(pressure * 100) / 100,
      min_today: Math.round(minToday * 100) / 100,
      max_today: Math.round(maxToday * 100) / 100,
      avg_7d: Math.round(avg7d * 100) / 100,
      valve_position: node.valvePosition ?? 50,
      valve_mode: node.valveMode ?? 'auto',
      ai_confidence: latestDecision ? Math.round((latestDecision.riskLevel === 'LOW' ? 0.9 : 0.6) * 100) : 50,
      ai_recommendation: node.valvePosition ?? 50,
      ai_reason: latestDecision?.action ?? 'NONE',
      last_reading: latestTelemetry.length > 0 ? formatTimeWithSeconds(latestTelemetry[0].timestamp) : '--:--:--',
    };
  }

  getAnomalies(zoneId: string): AnomalyData[] {
    const nodeId = fromZoneId(zoneId);

    const mlRows = readMlPredictionsForNode(nodeId);
    if (mlRows.length > 0) {
      return mlRows.map((row) => {
        const confidence = toMlConfidence(row.anomaly_score, row.unexplained_pressure_drop);
        const severity: 'crit' | 'warn' = confidence >= 80 ? 'crit' : 'warn';
        const eventName = row.predicted_event.replace(/_/g, ' ').toUpperCase();
        const message = `${eventName}: ${row.event_explanation}`;

        return {
          confidence,
          severity,
          message,
          model: 'Leakage ML v1',
          time: formatTime(row.timestamp),
        };
      });
    }

    const decisions = decisionRepository.findByNodeId(nodeId, 100);

    return decisions
      .filter(d => d.riskLevel === 'HIGH' || d.riskLevel === 'MEDIUM')
      .slice(0, 10)
      .map(d => ({
        confidence: d.riskLevel === 'HIGH' ? 80 : 60,
        severity: d.riskLevel === 'HIGH' ? 'crit' as const : 'warn' as const,
        message: d.action !== 'NONE' ? `Recommended ${d.action.replace('_', ' ')}` : 'Pressure anomaly detected',
        model: 'Rule Engine v1',
        time: formatTime(d.createdAt),
      }));
  }

  setValveOverride(zoneId: string, position: number): { success: boolean; command_id: string; node_id: string; position: number; dispatched_at: string } {
    if (position < 0 || position > 100) {
      throw new Error('Position must be 0-100');
    }

    const nodeId = fromZoneId(zoneId);
    const node = nodeRepository.findByNodeId(nodeId);
    if (!node) throw new Error('Zone not found');

    // Use commandService.setManualOverride() which properly:
    // 1. Cancels existing pending commands
    // 2. Sets valve mode to 'override'
    // 3. Creates command with correct targetPosition and priority
    // 4. Updates node state
    // 5. Sends Telegram notification
    // 6. Emits valve mode changed event
    const command = commandService.setManualOverride(nodeId, position);

    return {
      success: true,
      command_id: command.id,
      node_id: zoneId,
      position,
      dispatched_at: command.sentAt ?? new Date().toISOString(),
    };
  }

  revertToAuto(zoneId: string): { success: boolean; node_id: string; mode: 'auto' } {
    const nodeId = fromZoneId(zoneId);
    const node = nodeRepository.findByNodeId(nodeId);
    if (!node) throw new Error('Zone not found');

    commandService.revertToAuto(nodeId);

    return {
      success: true,
      node_id: zoneId,
      mode: 'auto',
    };
  }
}

export const dashboardService = new DashboardService();
