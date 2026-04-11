import { Request, Response, NextFunction } from 'express';
import { iwedsRepository } from '../../repositories/iweds.repository.js';

export interface IwedsAuthenticatedRequest extends Request {
  iwedsHouseholdId?: string;
  iwedsDmaId?: string;
}

export function iwedsAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const household = iwedsRepository.getHouseholdByApiKey(apiKey);
  if (!household) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  (req as IwedsAuthenticatedRequest).iwedsHouseholdId = household.householdId;
  (req as IwedsAuthenticatedRequest).iwedsDmaId = household.dmaId;
  next();
}
