import { nodeRepository } from '../../repositories/node.repository.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { alertRepository } from '../../repositories/alert.repository.js';
import { decisionRepository } from '../../repositories/decision.repository.js';
import { commandRepository } from '../../repositories/command.repository.js';
import { eventBus } from '../../core/event-bus.js';
import { ZoneSummary, KpiData, AlertData, PressureHistory, PressureReading, ZoneDetail, AnomalyData } from './types.js';

function toZoneId(nodeId: string): string {
  return nodeId.replace('DMA_', 'DMA-');
}

function fromZoneId(zoneId: string): string {
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

export class DashboardService {
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
    const alerts = alertRepository.findAll(10, 0)
      .filter(a => !a.sent);

    return alerts.map(alert => {
      const node = nodeRepository.findByNodeId(alert.nodeId);
      return {
        id: alert.id,
        zone_id: toZoneId(alert.nodeId),
        zone_name: node?.name ?? alert.nodeId,
        severity: alert.riskLevel.toLowerCase() as 'crit' | 'warn' | 'low',
        message: alert.message,
        time: formatTime(alert.createdAt),
      };
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

    nodeRepository.update(node.id, { valvePosition: position, valveMode: 'override' });

    const command = commandRepository.create({
      nodeId,
      command: `SET_VALVE:${position}`,
    });

    eventBus.emitActionDispatched({
      nodeId,
      command: `SET_VALVE:${position}`,
      commandId: command.id,
      source: 'operator',
    });

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

    nodeRepository.update(node.id, { valveMode: 'auto' });

    return {
      success: true,
      node_id: zoneId,
      mode: 'auto',
    };
  }
}

export const dashboardService = new DashboardService();