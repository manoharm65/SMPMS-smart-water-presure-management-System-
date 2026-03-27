import { Router, Request, Response } from 'express';
import { dashboardService } from './dashboard.service.js';

const router = Router();

// GET /api/v1/dashboard/zones
router.get('/zones', (_req: Request, res: Response) => {
  try {
    const zones = dashboardService.getZones();
    res.json(zones);
  } catch (err) {
    console.error('[Dashboard] Error getting zones:', err);
    res.status(500).json({ error: 'Failed to get zones' });
  }
});

// GET /api/v1/dashboard/kpi
router.get('/kpi', (_req: Request, res: Response) => {
  try {
    const kpi = dashboardService.getKpi();
    res.json(kpi);
  } catch (err) {
    console.error('[Dashboard] Error getting KPI:', err);
    res.status(500).json({ error: 'Failed to get KPI' });
  }
});

// GET /api/v1/dashboard/alerts
router.get('/alerts', (_req: Request, res: Response) => {
  try {
    const alerts = dashboardService.getAlerts();
    res.json(alerts);
  } catch (err) {
    console.error('[Dashboard] Error getting alerts:', err);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// GET /api/v1/dashboard/pressure-history/:zoneId
router.get('/pressure-history/:zoneId', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const range = (req.query.range as '24h' | '7d') || '24h';
    const history = dashboardService.getPressureHistory(zoneId, range);
    res.json(history);
  } catch (err) {
    console.error('[Dashboard] Error getting pressure history:', err);
    res.status(500).json({ error: 'Failed to get pressure history' });
  }
});

// GET /api/v1/dashboard/zones/:zoneId
router.get('/zones/:zoneId', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const zone = dashboardService.getZoneDetail(zoneId);
    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }
    res.json(zone);
  } catch (err) {
    console.error('[Dashboard] Error getting zone detail:', err);
    res.status(500).json({ error: 'Failed to get zone detail' });
  }
});

// GET /api/v1/dashboard/zones/:zoneId/anomalies
router.get('/zones/:zoneId/anomalies', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const anomalies = dashboardService.getAnomalies(zoneId);
    res.json(anomalies);
  } catch (err) {
    console.error('[Dashboard] Error getting anomalies:', err);
    res.status(500).json({ error: 'Failed to get anomalies' });
  }
});

// POST /api/v1/dashboard/zones/:zoneId/valve
router.post('/zones/:zoneId/valve', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const { position, mode } = req.body;

    if (mode !== 'override') {
      res.status(400).json({ error: 'Mode must be override' });
      return;
    }

    if (typeof position !== 'number' || position < 0 || position > 100) {
      res.status(400).json({ error: 'Position must be 0-100' });
      return;
    }

    const result = dashboardService.setValveOverride(zoneId, position);
    res.json(result);
  } catch (err: any) {
    console.error('[Dashboard] Error setting valve override:', err);
    res.status(500).json({ error: err.message ?? 'Failed to set valve override' });
  }
});

// POST /api/v1/dashboard/zones/:zoneId/valve/revert
router.post('/zones/:zoneId/valve/revert', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const result = dashboardService.revertToAuto(zoneId);
    res.json(result);
  } catch (err: any) {
    console.error('[Dashboard] Error reverting valve:', err);
    res.status(500).json({ error: err.message ?? 'Failed to revert valve' });
  }
});

export default router;