import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/db.js';

const router = Router();

router.post('/valve-override', async (req: Request, res: Response): Promise<void> => {
  try {
    const { node_id, position } = req.body;
    
    if (!node_id || position === undefined) {
      res.status(400).json({ error: 'node_id and position are required' });
      return;
    }

    const db = getDatabase();
    const commandId = `sim-${Date.now()}-${node_id}`;
    const timestamp = new Date().toISOString();

    db.run(
      `INSERT INTO commands (id, node_id, command, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [commandId, node_id, `SET_VALVE:${position}`, 'EXECUTED', timestamp, timestamp]
    );

    res.json({
      success: true,
      node_id,
      position,
      timestamp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;