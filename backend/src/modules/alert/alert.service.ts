import { eventBus, AlertPayload } from '../../core/event-bus.js';
import { alertRepository } from '../../repositories/alert.repository.js';
import { nodeRepository } from '../../repositories/node.repository.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { decisionRepository } from '../../repositories/decision.repository.js';
import { telegramService } from '../../integrations/telegram.service.js';
import { Alert } from '../../types/index.js';

export class AlertService {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.onAlertTriggered(async (payload: AlertPayload) => {
      await this.handleAlertTriggered(payload);
    });
  }

  private async handleAlertTriggered(payload: AlertPayload): Promise<void> {
    console.log(`[Alert] Triggered for node ${payload.nodeId}: ${payload.message}`);

    // Store alert in database
    const alert = alertRepository.create({
      nodeId: payload.nodeId,
      message: payload.message,
      riskLevel: payload.riskLevel,
    });

    console.log(`[Alert] Stored alert ${alert.id}`);

    const node = nodeRepository.findByNodeId(payload.nodeId);
    const latestTelemetry = telemetryRepository.findLatestByNodeId(payload.nodeId, 1)[0];
    const latestDecision = decisionRepository.findLatestByNodeId(payload.nodeId);

    const recommendedAction = this.resolveRecommendedAction(payload.message, latestDecision?.action);
    const recommendations = this.buildRecommendedPoints(payload.riskLevel, recommendedAction);

    const sent = await telegramService.sendAlert({
      nodeId: payload.nodeId,
      message: payload.message,
      riskLevel: payload.riskLevel,
      location: node?.location,
      pressureBar: latestTelemetry?.pressure,
      recommendedAction,
      recommendedValvePosition: latestDecision?.recommendedValvePosition,
      recommendations,
    });

    if (sent) {
      alertRepository.markSent(alert.id);
      console.log(`[Alert] Telegram notification sent for alert ${alert.id}`);
    }
  }

  private resolveRecommendedAction(message: string, decisionAction?: string): string {
    if (decisionAction && decisionAction !== 'NONE') {
      return decisionAction.replaceAll('_', ' ');
    }

    const lower = message.toLowerCase();
    if (lower.includes('timeout')) {
      return 'Check ESP connectivity and retry valve command';
    }
    if (lower.includes('critical')) {
      return 'Apply emergency valve correction and dispatch field team';
    }
    if (lower.includes('high')) {
      return 'Reduce valve opening to bring pressure back to safe band';
    }
    if (lower.includes('low')) {
      return 'Increase valve opening and check upstream supply';
    }

    return 'Inspect node and apply manual override if required';
  }

  private buildRecommendedPoints(riskLevel: string, recommendedAction: string): string[] {
    const points: string[] = [
      `Perform action: ${recommendedAction}`,
      'Verify pressure trend for the next 10-15 minutes after action',
      'Confirm valve movement ACK is received from ESP node',
    ];

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      points.push('Escalate to field operator if pressure remains outside safe limits');
    }

    if (riskLevel === 'WARNING' || riskLevel === 'MEDIUM') {
      points.push('Keep zone in close monitoring mode until stable');
    }

    return points;
  }

  findAll(limit = 100, offset = 0, unacknowledgedOnly = false): Alert[] {
    return alertRepository.findAll(limit, offset, unacknowledgedOnly);
  }

  findByNodeId(nodeId: string, limit = 50): Alert[] {
    return alertRepository.findByNodeId(nodeId, limit);
  }

  count(): number {
    return alertRepository.count();
  }

  acknowledge(id: string, acknowledgedBy?: string) {
    return alertRepository.acknowledge(id, acknowledgedBy);
  }
}

export const alertService = new AlertService();
