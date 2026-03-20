import { Router, Request, Response } from 'express';
import { nodeService } from './node.service.js';
import { authMiddleware, AuthenticatedRequest } from '../auth/auth.middleware.js';

const router = Router();

// GET /nodes
router.get('/', authMiddleware, (_req: AuthenticatedRequest, res: Response): void => {
  const nodes = nodeService.findAll();
  res.json(nodes);
});

// GET /nodes/:nodeId
router.get('/:nodeId', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const node = nodeService.findByNodeId(req.params.nodeId);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  res.json(node);
});

// POST /nodes
router.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { nodeId, name, location } = req.body;

  if (!nodeId) {
    res.status(400).json({ error: 'nodeId is required' });
    return;
  }

  try {
    const node = nodeService.create(nodeId, name, location);
    res.status(201).json(node);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /nodes/:id
router.patch('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { name, location, isActive } = req.body;
  const node = nodeService.update(req.params.id, { name, location, isActive });

  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }

  res.json(node);
});

export default router;
