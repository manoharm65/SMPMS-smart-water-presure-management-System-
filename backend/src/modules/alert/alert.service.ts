import { eventBus, AlertPayload } from '../../core/event-bus.js';
import { alertRepository } from '../../repositories/alert.repository.js';
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

    // Send Telegram notification
    // TODO: Re-enable once Telegram is fully configured
    // const sent = await telegramService.sendAlert({
    //   nodeId: payload.nodeId,
    //   message: payload.message,
    //   riskLevel: payload.riskLevel,
    // });

    // if (sent) {
    //   alertRepository.markSent(alert.id);
    //   console.log(`[Alert] Telegram notification sent for alert ${alert.id}`);
    // }
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
