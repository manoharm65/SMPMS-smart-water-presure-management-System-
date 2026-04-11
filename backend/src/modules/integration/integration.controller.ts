import { Request, Response, Router } from 'express';
import { integrationOrchestrator } from './integration.orchestrator.js';
import { IntegrationRiskState } from './integration.types.js';

const router = Router();

function parseSeverity(value: unknown): IntegrationRiskState | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.toUpperCase();
  if (upper === 'NORMAL' || upper === 'ELEVATED' || upper === 'HIGH' || upper === 'CRITICAL') {
    return upper as IntegrationRiskState;
  }
  return undefined;
}

router.get('/zones/:zoneId/risk', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const result = integrationOrchestrator.getZoneRisk(zoneId, from, to);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get zone risk' });
  }
});

router.get('/zones/:zoneId/timeline', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const severity = parseSeverity(req.query.severity);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const timeline = integrationOrchestrator.getTimeline({ zoneId, from, to, severity, limit });
    res.json({
      zone_id: zoneId,
      total: timeline.length,
      timeline,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get integration timeline' });
  }
});

router.get('/summary', (req: Request, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const severity = parseSeverity(req.query.severity);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const summary = integrationOrchestrator.getSummary({ from, to, severity, limit });
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get integration summary' });
  }
});

router.post('/ml/load-predictions', (req: Request, res: Response) => {
  try {
    const csvPath = typeof req.body.csv_path === 'string' ? req.body.csv_path : undefined;
    const path = csvPath || integrationOrchestrator.getMlPredictionsPath();
    const inserted = integrationOrchestrator.captureMlPredictionsFromCsv(path);
    res.json({ success: true, inserted_events: inserted, csv_path: path });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load ML predictions' });
  }
});

export default router;
