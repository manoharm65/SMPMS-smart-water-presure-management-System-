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
  async sendAlert(alert: { nodeId: string; message: string; riskLevel: string }): Promise<boolean> {
    const telegramBot = getBot();

    if (!telegramBot) {
      console.log('[Telegram] Bot not configured (TELEGRAM_TOKEN or TELEGRAM_CHAT_ID missing). Skipping notification.');
      return false;
    }

    const riskEmoji = alert.riskLevel === 'HIGH' ? '🚨' : alert.riskLevel === 'MEDIUM' ? '⚠️' : 'ℹ️';
    const message = `${riskEmoji} *${alert.riskLevel} RISK ALERT*\n\nNode: ${alert.nodeId}\n${alert.message}\n\nTime: ${new Date().toISOString()}`;

    try {
      await telegramBot.sendMessage(config.telegramChatId, message, { parse_mode: 'Markdown' });
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
}

export const telegramService = new TelegramService();
