import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = authService.verifyToken(token);
    req.user = {
      userId: payload.userId,
      username: payload.username,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
