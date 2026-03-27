/**
 * Test app — minimal Express app for integration testing.
 * Uses the same routing as main.ts but with mocked DB.
 */
import express from 'express';
import cors from 'cors';
import { globalErrorHandler, notFoundHandler } from '../middleware/error-handler.js';

// Import routers (lazy to allow mock setup)
import authRouter from '../modules/auth/auth.controller.js';
import nodeRouter from '../modules/node/node.controller.js';
import telemetryRouter from '../modules/telemetry/telemetry.controller.js';
import alertRouter from '../modules/alert/alert.controller.js';
import commandRouter from '../modules/command/command.controller.js';
import healthRouter from '../modules/health/health.controller.js';
import dashboardRouter from '../modules/dashboard/dashboard.controller.js';
import espRouter from '../modules/esp/esp.controller.js';

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes (same as main.ts)
app.use('/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/nodes', nodeRouter);
app.use('/api/v1/telemetry', telemetryRouter);
app.use('/api/v1/alerts', alertRouter);
app.use('/api/v1/commands', commandRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/esp', espRouter);
app.use('/telemetry', telemetryRouter);

// Error handlers
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
