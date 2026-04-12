import TelegramBot from 'node-telegram-bot-api';
import { config } from '../core/config.js';
import { Alert } from '../types/index.js';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot | null {
  if (!config.telegramToken || !config.telegramChatId) {
    return null;
  }

  if (!bot) {
    bot = new TelegramBot(config.telegramToken, { polling: false });
  }

  return bot;
}

export class TelegramService {
  private sendChain: Promise<void> = Promise.resolve();

  private nextSendAt = 0;

  private readonly minSendIntervalMs = 1200;

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractRetryAfterSeconds(err: unknown): number | null {
    const candidate = err as {
      response?: {
        body?: { parameters?: { retry_after?: number } };
        headers?: Record<string, string | string[]>;
      };
    };

    const bodyRetry = candidate?.response?.body?.parameters?.retry_after;
    if (typeof bodyRetry === 'number' && Number.isFinite(bodyRetry) && bodyRetry > 0) {
      return bodyRetry;
    }

    const headerValue = candidate?.response?.headers?.['retry-after'];
    if (typeof headerValue === 'string') {
      const parsed = Number(headerValue);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    if (Array.isArray(headerValue) && headerValue.length > 0) {
      const parsed = Number(headerValue[0]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return null;
  }

  private async executeWithThrottle<T>(task: () => Promise<T>): Promise<T> {
    const waitMs = Math.max(0, this.nextSendAt - Date.now());
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }

    this.nextSendAt = Date.now() + this.minSendIntervalMs;
    return task();
  }

  private enqueueTelegramTask<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      let attempt = 0;

      while (attempt < 3) {
        attempt += 1;
        try {
          return await this.executeWithThrottle(task);
        } catch (err) {
          const retryAfterSec = this.extractRetryAfterSeconds(err);
          const message = err instanceof Error ? err.message : String(err);

          if (retryAfterSec && attempt < 3) {
            const delayMs = (retryAfterSec + 1) * 1000;
            console.warn(`[Telegram] Rate limited (429). Retrying in ${retryAfterSec}s (attempt ${attempt}/3)`);
            this.nextSendAt = Math.max(this.nextSendAt, Date.now() + delayMs);
            await this.sleep(delayMs);
            continue;
          }

          console.error(`[Telegram] Send failed: ${message}`);
          throw err;
        }
      }

      throw new Error('Telegram send retries exhausted');
    };

    const queued = this.sendChain.then(run, run);
    this.sendChain = queued.then(() => undefined, () => undefined);
    return queued;
  }

  async sendAlert(alert: {
    nodeId: string;
    message: string;
    riskLevel: string;
    location?: string;
    pressureBar?: number;
    recommendedAction?: string;
    recommendedValvePosition?: number;
    recommendations?: string[];
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured (TELEGRAM_TOKEN or TELEGRAM_CHAT_ID missing). Skipping notification.');
      return false;
    }

    const riskEmoji = alert.riskLevel === 'CRITICAL' || alert.riskLevel === 'HIGH'
      ? '🚨'
      : alert.riskLevel === 'WARNING' || alert.riskLevel === 'MEDIUM'
        ? '⚠️'
        : 'ℹ️';

    let message = `${riskEmoji} <b>SMPMS ALERT</b>

<b>Risk Level:</b> ${alert.riskLevel}
<b>Node:</b> ${alert.nodeId}
<b>Location:</b> ${alert.location ?? 'Unknown location'}
<b>Pressure:</b> ${alert.pressureBar !== undefined ? `${alert.pressureBar.toFixed(2)} BAR` : 'N/A'}

<b>Alert:</b> ${alert.message}
<b>Recommended Action:</b> ${alert.recommendedAction ?? 'Inspect node and stabilize pressure'}`;

    if (alert.recommendedValvePosition !== undefined) {
      message += `\n<b>Recommended Valve Position:</b> ${Math.round(alert.recommendedValvePosition)}%`;
    }

    if (alert.recommendations && alert.recommendations.length > 0) {
      message += '\n\n<b>Recommended Points:</b>';
      for (const rec of alert.recommendations) {
        message += `\n- ${rec}`;
      }
    }

    message += `\n\n<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      console.log(`[Telegram] Alert sent for node ${alert.nodeId}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Failed to send alert for node ${alert.nodeId}`);
      return false;
    }
  }

  async sendCommandNotification(command: { nodeId: string; command: string }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      return false;
    }

    const message = `📡 <b>Command Dispatched</b>

<b>Node:</b> ${command.nodeId}
<b>Command:</b> ${command.command}
<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send command notification');
      return false;
    }
  }

  async sendCriticalCommandNotification(payload: {
    nodeId: string;
    command: string;
    targetPosition: number;
    pressure: number;
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured. Skipping critical command notification.');
      return false;
    }

    const message = `🔴 <b>CRITICAL: Valve command sent to ${payload.nodeId}</b>

<b>Action:</b> ${payload.command}
<b>Target:</b> ${payload.targetPosition}%
<b>Pressure:</b> ${payload.pressure} BAR

<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      console.log(`[Telegram] Critical command notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Failed to send critical command notification for node ${payload.nodeId}`);
      return false;
    }
  }

  async sendTimeoutNotification(payload: {
    nodeId: string;
    commandId: string;
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured. Skipping timeout notification.');
      return false;
    }

    const message = `⚠️ <b>WARNING: Valve command timeout</b>

<b>Node:</b> ${payload.nodeId} not responding
<b>Command ID:</b> ${payload.commandId}
<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      console.log(`[Telegram] Timeout notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Failed to send timeout notification for node ${payload.nodeId}`);
      return false;
    }
  }

  async sendOverrideAutoCancelledNotification(payload: {
    nodeId: string;
    pressure: number;
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured. Skipping override auto-cancelled notification.');
      return false;
    }

    const message = `⚠️ <b>Override cancelled on ${payload.nodeId}</b>

<b>Reason:</b> Critical pressure detected (${payload.pressure} BAR)
<b>Status:</b> Auto control resumed
<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      console.log(`[Telegram] Override auto-cancelled notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Failed to send override auto-cancelled notification for node ${payload.nodeId}`);
      return false;
    }
  }

  async sendManualOverrideNotification(payload: {
    nodeId: string;
    targetPosition: number;
    operator?: string;
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured. Skipping manual override notification.');
      return false;
    }

    const operatorText = payload.operator ? ` by ${payload.operator}` : '';
    const message = `🔧 <b>Manual override on ${payload.nodeId}</b>

<b>Valve set to:</b> ${payload.targetPosition}%${operatorText}
<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      console.log(`[Telegram] Manual override notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Failed to send manual override notification for node ${payload.nodeId}`);
      return false;
    }
  }

  async sendOverrideSafetyWarning(payload: {
    nodeId: string;
    criticalCount: number;
    pressure: number;
    remainingReadings: number;
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured. Skipping override safety warning.');
      return false;
    }

    const message = `⚠️ <b>OVERRIDE SAFETY WARNING</b>

<b>Node:</b> ${payload.nodeId}
<b>Status:</b> ${payload.criticalCount} consecutive CRITICAL readings while in override mode
<b>Current Pressure:</b> ${payload.pressure.toFixed(2)} BAR

<b>Action Required:</b> The system detected prolonged critical conditions under manual override.

If no changes are made in the next <b>${payload.remainingReadings} telemetry readings</b>, the system will automatically revert to AUTO mode for safety.

<b>Options:</b>
- Adjust override valve position if needed
- Switch to AUTO mode to let the system handle it
- No action: system will auto-revert after ${payload.remainingReadings} more readings

<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      console.log(`[Telegram] Override safety warning sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Failed to send override safety warning for node ${payload.nodeId}`);
      return false;
    }
  }

  async sendOverrideAutoRevertNotification(payload: {
    nodeId: string;
    criticalCount: number;
    pressure: number;
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured. Skipping override auto-revert notification.');
      return false;
    }

    const message = `🔴 <b>OVERRIDE AUTO-REVERTED</b>

<b>Node:</b> ${payload.nodeId}
<b>Reason:</b> ${payload.criticalCount} consecutive CRITICAL readings detected while in override mode
<b>Current Pressure:</b> ${payload.pressure.toFixed(2)} BAR

<b>Action Taken:</b> System has automatically reverted to AUTO mode for safety.

The automatic control system will now manage the valve position based on current conditions.

<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      console.log(`[Telegram] Override auto-revert notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Failed to send override auto-revert notification for node ${payload.nodeId}`);
      return false;
    }
  }

  async sendMlSimulationMilestone(payload: {
    totalPredictions: number;
    milestone: number;
    datasetPath: string;
    latestScenario: string;
  }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured. Skipping ML simulation milestone notification.');
      return false;
    }

    const message = `📊 <b>ML Simulation Dataset Milestone</b>

<b>Total Predictions Stored:</b> ${payload.totalPredictions}
<b>Milestone:</b> ${payload.milestone}
<b>Latest Scenario:</b> ${payload.latestScenario}
<b>Dataset:</b> Attached CSV snapshot
<b>Time:</b> ${new Date().toISOString()}`;

    try {
      await this.enqueueTelegramTask(() => telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }));
      const telegramBotAny = telegramBot as unknown as {
        sendDocument: (chatId: string, doc: string, opts?: { caption?: string }) => Promise<unknown>;
      };
      await this.enqueueTelegramTask(() => telegramBotAny.sendDocument(config.telegramChatId, payload.datasetPath, {
        caption: `ML simulation dataset snapshot at ${payload.totalPredictions} predictions`,
      }));
      console.log(`[Telegram] ML simulation milestone sent (${payload.totalPredictions})`);
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send ML simulation milestone');
      return false;
    }
  }
}

export const telegramService = new TelegramService();
