import { Router } from 'express';
import { espAuthMiddleware } from './esp-auth.middleware.js';
import telemetryEspRouter from './telemetry-esp.controller.js';
import commandEspRouter from './command-esp.controller.js';

const router = Router();

// All ESP routes require Bearer API key auth
router.use(espAuthMiddleware);

router.use('/telemetry', telemetryEspRouter);
router.use('/commands', commandEspRouter);

export default router;
