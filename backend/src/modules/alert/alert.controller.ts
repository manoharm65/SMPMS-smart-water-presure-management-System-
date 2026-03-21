import { Router, Response } from 'express';
import { alertService } from './alert.service.js';
import { authMiddleware, AuthenticatedRequest } from '../auth/auth.middleware.js';

const router = Router();

// GET /alerts
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { limit, offset, unacknowledged } = req.query;
  const alerts = alertService.findAll(
    limit ? parseInt(limit as string, 10) : 100,
    offset ? parseInt(offset as string, 10) : 0,
    unacknowledged === 'true'
  );
  const total = alertService.count();
  res.json({ alerts, total });
});

// GET /alerts/:nodeId
router.get('/:nodeId', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { nodeId } = req.params;
  const { limit } = req.query;
  const alerts = alertService.findByNodeId(nodeId, limit ? parseInt(limit as string, 10) : 50);
  res.json(alerts);
});

// PATCH /alerts/:id/acknowledge
router.patch('/:id/acknowledge', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const acknowledgedBy = (req.user as any)?.username ?? 'operator';
  const updated = alertService.acknowledge(id, acknowledgedBy);
  if (!updated) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  res.json({ success: true, alert: updated });
});

export default router;
