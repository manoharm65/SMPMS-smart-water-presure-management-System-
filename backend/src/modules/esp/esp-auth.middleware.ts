import { Request, Response, NextFunction } from 'express';
import { nodeRepository } from '../../repositories/node.repository.js';

export interface EspAuthenticatedRequest extends Request {
  nodeId?: string;
}

export function espAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const apiKey = authHeader.slice(7);
  const node = nodeRepository.findByApiKey(apiKey);

  if (!node) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  (req as EspAuthenticatedRequest).nodeId = node.nodeId;
  next();
}
