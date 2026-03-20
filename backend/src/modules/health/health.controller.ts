import { Router, Request, Response } from 'express';
import { config } from '../../core/config.js';

const router = Router();

// GET /health
router.get('/', (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// GET /health/ready
router.get('/ready', (_req: Request, res: Response): void => {
  // Could add DB connectivity check here
  res.json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
