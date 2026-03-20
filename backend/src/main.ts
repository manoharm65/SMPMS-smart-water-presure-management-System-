import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, config } from './core/config.js';
import { initDatabase, closeDatabase } from './database/db.js';
import { decisionService } from './modules/decision/decision.service.js';
import { alertService } from './modules/alert/alert.service.js';
import { commandService } from './modules/command/command.service.js';

// Import routers
import authRouter from './modules/auth/auth.controller.js';
import nodeRouter from './modules/node/node.controller.js';
import telemetryRouter from './modules/telemetry/telemetry.controller.js';
import alertRouter from './modules/alert/alert.controller.js';
import commandRouter from './modules/command/command.controller.js';
import healthRouter from './modules/health/health.controller.js';
import dashboardRouter from './modules/dashboard/dashboard.controller.js';
import espRouter from './modules/esp/esp.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function bootstrap() {
  // Load environment
  loadEnv();

  // Initialize database
  console.log('🚀 Initializing database...');
  await initDatabase();
  console.log('✅ Database initialized\n');

  // Initialize services (which sets up event listeners)
  console.log('🚀 Initializing services...');
  decisionService; // Initialize decision service
  alertService;    // Initialize alert service
  commandService;  // Initialize command service
  console.log('✅ Services initialized\n');

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  // Mount routes
  app.use('/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/nodes', nodeRouter);
  app.use('/api/v1/telemetry', telemetryRouter);
  app.use('/api/v1/alerts', alertRouter);
  app.use('/api/v1/commands', commandRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/esp', espRouter);

  // Legacy /telemetry route (for ESP32 compatibility)
  app.use('/telemetry', telemetryRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Error]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start server
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   SMPMS Backend Server                       ║
║   Smart Water Pressure Management System      ║
╠══════════════════════════════════════════════╣
║   Port: ${PORT}                                ║
║   Env:  ${process.env.NODE_ENV || 'development'}
║   DB:   ${config.sqliteDbPath}
╚══════════════════════════════════════════════╝

📡 Endpoints:
   GET  /health              - Health check
   POST /api/v1/auth/register - Register
   POST /api/v1/auth/login    - Login
   POST /api/v1/telemetry     - ESP32 push
   GET  /api/v1/telemetry/latest - Latest readings
   GET  /api/v1/alerts        - All alerts
   POST /api/v1/commands      - Manual command
   GET  /api/v1/nodes         - All nodes
   GET  /api/v1/dashboard/zones         - Zone list with pressure/trend
   GET  /api/v1/dashboard/kpi           - KPI metrics
   GET  /api/v1/dashboard/alerts        - Active alerts
   GET  /api/v1/dashboard/pressure-history/:zoneId - Pressure history
   GET  /api/v1/dashboard/zones/:zoneId - Zone detail
   GET  /api/v1/dashboard/zones/:zoneId/anomalies - AI anomalies
   POST /api/v1/dashboard/zones/:zoneId/valve - Valve override
   POST /api/v1/dashboard/zones/:zoneId/valve/revert - Revert to auto
`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    closeDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    closeDatabase();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
