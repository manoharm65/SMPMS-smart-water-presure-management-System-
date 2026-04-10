import { Router, Request, Response } from 'express';
import { mpcService } from './mpc.service.js';

const router = Router();

router.get('/status', (req: Request, res: Response) => {
  res.json(mpcService.getStatus());
});

router.get('/history', (req: Request, res: Response) => {
  res.json(mpcService.getHistory());
});

router.get('/nodes', (req: Request, res: Response) => {
  res.json(mpcService.getNodes());
});

router.get('/config', (req: Request, res: Response) => {
  res.json(mpcService.getConfig());
});

router.put('/config', (req: Request, res: Response) => {
  const updated = mpcService.updateConfig(req.body);
  res.json(updated);
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const result = await mpcService.runCycle();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
