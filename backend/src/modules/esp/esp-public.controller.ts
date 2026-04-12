import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/db.js';

const router = Router();

router.get('/latest/:nodeId', (req: Request, res: Response): void => {
  try {
    const db = getDatabase();
    const result = db.exec(
      `SELECT pressure FROM telemetry
       WHERE node_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.params.nodeId]
    );
    const row = result.length > 0 && result[0].values.length > 0 
      ? { pressure: result[0].values[0][0] } 
      : { pressure: 3.5 };
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;