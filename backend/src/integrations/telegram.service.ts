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

    const details: string[] = [
      `${riskEmoji} SMPMS ALERT`,
      '',
      `Risk Level: ${alert.riskLevel}`,
      `Node: ${alert.nodeId}`,
      `Location: ${alert.location ?? 'Unknown location'}`,
      `Pressure: ${alert.pressureBar !== undefined ? `${alert.pressureBar.toFixed(2)} BAR` : 'N/A'}`,
      '',
      `Alert: ${alert.message}`,
      `Recommended Action: ${alert.recommendedAction ?? 'Inspect node and stabilize pressure'}`,
    ];

    if (alert.recommendedValvePosition !== undefined) {
      details.push(`Recommended Valve Position: ${Math.round(alert.recommendedValvePosition)}%`);
    }

    if (alert.recommendations && alert.recommendations.length > 0) {
      details.push('');
      details.push('Recommended Points:');
      for (const rec of alert.recommendations) {
        details.push(`- ${rec}`);
      }
    }

    details.push('');
    details.push(`Time: ${new Date().toISOString()}`);

    const message = details.join('\n');

    try {
      await telegramBot.sendMessage(config.telegramChatId, message);
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

    const message = `📡 *Command Dispatched*\n\nNode: ${command.nodeId}\nCommand: ${command.command}\nTime: ${new Date().toISOString()}`;

    try {
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'Markdown' });
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

    const message = `🔴 *CRITICAL: Valve command sent to ${payload.nodeId}*\n\nAction: ${payload.command} → target ${payload.targetPosition}%\nPressure: ${payload.pressure} BAR\n\nTime: ${new Date().toISOString()}`;

    try {
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'Markdown' });
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

    const message = `⚠️ *WARNING: Valve command timeout — ${payload.nodeId} not responding*\n\nCommand ID: ${payload.commandId}\nTime: ${new Date().toISOString()}`;

    try {
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'Markdown' });
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

    const message = `⚠️ *Override cancelled on ${payload.nodeId} — Critical pressure detected (${payload.pressure} BAR). Auto control resumed.*\n\nTime: ${new Date().toISOString()}`;

    try {
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'Markdown' });
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
    const message = `🔧 *Manual override on ${payload.nodeId} — valve set to ${payload.targetPosition}%${operatorText}*\n\nTime: ${new Date().toISOString()}`;

    try {
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'Markdown' });
      console.log(`[Telegram] Manual override notification sent for node ${payload.nodeId}`);
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send manual override notification:', err);
      return false;
    }
  }
}

export const telegramService = new TelegramService();
