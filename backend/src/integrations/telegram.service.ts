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
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' });
      console.log(`[Telegram] Alert sent for node ${alert.nodeId}`);
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send alert:', err);
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
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send command notification:', err);
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
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' });
      console.log(`[Telegram] Critical command notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send critical command notification:', err);
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
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' });
      console.log(`[Telegram] Timeout notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send timeout notification:', err);
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
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' });
      console.log(`[Telegram] Override auto-cancelled notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send override auto-cancelled notification:', err);
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
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' });
      console.log(`[Telegram] Manual override notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send manual override notification:', err);
      return false;
    }
  }
}

export const telegramService = new TelegramService();
