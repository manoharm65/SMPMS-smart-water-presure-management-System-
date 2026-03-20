import { Router, Request, Response } from 'express';
import { authService } from './auth.service.js';
import { authMiddleware, AuthenticatedRequest } from './auth.middleware.js';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const result = await authService.register(username, email || '', password);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const result = await authService.login(username, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// GET /auth/profile (protected)
router.get('/profile', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  res.json({
    userId: req.user!.userId,
    username: req.user!.username,
  });
});

export default router;
