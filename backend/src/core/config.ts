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
  telemetryIntervalMs: number;
  sqliteDbPath: string;
  pressureCriticalHigh: number;
  pressureWarningHigh: number;
  pressureNormalLow: number;
  pressureCriticalLow: number;
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
  const telemetryIntervalMs = parseInt(process.env.TELEMETRY_INTERVAL_MS || '10000', 10);
  const pressureCriticalHigh = parseFloat(process.env.PRESSURE_CRITICAL_HIGH || '5.5');
  const pressureWarningHigh = parseFloat(process.env.PRESSURE_WARNING_HIGH || '4.5');
  const pressureNormalLow = parseFloat(process.env.PRESSURE_NORMAL_LOW || '2.5');
  const pressureCriticalLow = parseFloat(process.env.PRESSURE_CRITICAL_LOW || '1.5');

  return {
    port,
    jwtSecret,
    jwtExpiresIn,
    telegramToken,
    telegramChatId,
    pressureMin,
    pressureMax,
    telemetryIntervalMs,
    sqliteDbPath,
    pressureCriticalHigh,
    pressureWarningHigh,
    pressureNormalLow,
    pressureCriticalLow,
  };
}

export const config = getConfig();
