import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadEnv(): void {
  dotenv.config({ path: join(__dirname, '../../.env') });
}

export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  telegramToken: string;
  telegramChatId: string;
  pressureMin: number;
  pressureMax: number;
  sqliteDbPath: string;
}

export function getConfig(): AppConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-me';
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const telegramToken = process.env.TELEGRAM_TOKEN || '';
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
  const pressureMin = parseFloat(process.env.PRESSURE_MIN_THRESHOLD || '2.0');
  const pressureMax = parseFloat(process.env.PRESSURE_MAX_THRESHOLD || '6.0');
  const sqliteDbPath = process.env.SQLITE_DB_PATH || './data/smpms.db';

  return {
    port,
    jwtSecret,
    jwtExpiresIn,
    telegramToken,
    telegramChatId,
    pressureMin,
    pressureMax,
    sqliteDbPath,
  };
}

export const config = getConfig();
