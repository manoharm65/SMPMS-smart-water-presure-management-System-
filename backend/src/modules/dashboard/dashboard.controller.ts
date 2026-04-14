import { Router, Request, Response } from 'express';
import { dashboardService } from './dashboard.service.js';
import {
  ML_SIMULATION_SCENARIOS,
  MlSimulationOverrides,
  MlSimulationScenario,
  mlRuntimeService,
} from './ml-runtime.service.js';

const router = Router();

// GET /api/v1/dashboard/nodes/telemetry?ids=valve_1,valve_2,house_1
router.get('/nodes/telemetry', (req: Request, res: Response) => {
  try {
    const idsParam = String(req.query.ids ?? '');
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      res.status(400).json({ error: 'Query parameter ids is required' });
      return;
    }

    const telemetry = dashboardService.getNodesTelemetry(ids);
    res.json(telemetry);
  } catch (err) {
    console.error('[Dashboard] Error getting node telemetry:', err);
    res.status(500).json({ error: 'Failed to get node telemetry' });
  }
});

// GET /api/v1/dashboard/smart-meters?ids=meter_1
router.get('/smart-meters', (req: Request, res: Response) => {
  try {
    const idsParam = String(req.query.ids ?? '');
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      res.status(400).json({ error: 'Query parameter ids is required' });
      return;
    }

    const data = dashboardService.getSmartMeters(ids);
    res.json(data);
  } catch (err) {
    console.error('[Dashboard] Error getting smart meter data:', err);
    res.status(500).json({ error: 'Failed to get smart meter data' });
  }
});

// POST /api/v1/dashboard/motorized-flow
router.post('/motorized-flow', (req: Request, res: Response) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const result = dashboardService.toggleMotorizedFlow(enabled);
    res.json(result);
  } catch (err) {
    console.error('[Dashboard] Error toggling motorized flow:', err);
    res.status(500).json({ error: 'Failed to toggle motorized flow' });
  }
});

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
router.get('/alerts', (req: Request, res: Response) => {
  console.log(`[Dashboard] 🔔 Incoming alerts request from ${req.ip || req.socket.remoteAddress || 'unknown'}`);
  const startTime = Date.now();
  
  try {
    const alerts = dashboardService.getAlerts();
    const duration = Date.now() - startTime;
    
    console.log(`[Dashboard] ✅ Alerts response ready: ${alerts.length} items | Duration: ${duration}ms`);
    console.log(`[Dashboard] 📨 Sending response with payload size: ${JSON.stringify(alerts).length} bytes`);
    
    res.json(alerts);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[Dashboard] ❌ Error getting alerts after ${duration}ms:`, err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// GET /api/v1/dashboard/ml/status
router.get('/ml/status', (_req: Request, res: Response) => {
  try {
    res.json(mlRuntimeService.getStatus());
  } catch (err) {
    console.error('[Dashboard] Error getting ML status:', err);
    res.status(500).json({ error: 'Failed to get ML status' });
  }
});

// POST /api/v1/dashboard/ml/run
router.post('/ml/run', async (_req: Request, res: Response) => {
  try {
    const status = await mlRuntimeService.runPredictionNow('api');
    res.json(status);
  } catch (err) {
    console.error('[Dashboard] Error running ML prediction:', err);
    res.status(500).json({ error: 'Failed to run ML prediction' });
  }
});

// POST /api/v1/dashboard/ml/refresh
router.post('/ml/refresh', async (_req: Request, res: Response) => {
  try {
    const status = await mlRuntimeService.runPredictionNow('api');
    res.json({ success: true, status });
  } catch (err) {
    console.error('[Dashboard] Error refreshing ML prediction:', err);
    res.status(500).json({ error: 'Failed to refresh ML prediction' });
  }
});

// GET /api/v1/dashboard/ml/simulate/scenarios
router.get('/ml/simulate/scenarios', (_req: Request, res: Response) => {
  try {
    res.json({ scenarios: mlRuntimeService.getSimulationScenarios() });
  } catch (err) {
    console.error('[Dashboard] Error getting ML simulation scenarios:', err);
    res.status(500).json({ error: 'Failed to get ML simulation scenarios' });
  }
});

// POST /api/v1/dashboard/ml/simulate
router.post('/ml/simulate', async (req: Request, res: Response) => {
  try {
    const requested = req.body?.scenario;
    const scenario = (typeof requested === 'string' && requested.length > 0 ? requested : 'all') as MlSimulationScenario;
    const input = req.body?.input;
    const overrides: MlSimulationOverrides = typeof input === 'object' && input !== null
      ? {
          pressure: typeof input.pressure === 'number' ? input.pressure : undefined,
          flowRate: typeof input.flowRate === 'number' ? input.flowRate : undefined,
          valvePosition: typeof input.valvePosition === 'number' ? input.valvePosition : undefined,
          supplyOn: typeof input.supplyOn === 'boolean' ? input.supplyOn : undefined,
          constructionActivity:
            typeof input.constructionActivity === 'boolean' ? input.constructionActivity : undefined,
          pipeAgeYears: typeof input.pipeAgeYears === 'number' ? input.pipeAgeYears : undefined,
          previousValvePosition:
            typeof input.previousValvePosition === 'number' ? input.previousValvePosition : undefined,
          pressureLag2: typeof input.pressureLag2 === 'number' ? input.pressureLag2 : undefined,
          hydraulicGradeAngleDeg:
            typeof input.hydraulicGradeAngleDeg === 'number' ? input.hydraulicGradeAngleDeg : undefined,
        }
      : {};

    if (scenario !== 'all' && !ML_SIMULATION_SCENARIOS.includes(scenario)) {
      res.status(400).json({
        error: 'Invalid scenario',
        allowed: ['all', ...ML_SIMULATION_SCENARIOS],
      });
      return;
    }

    const simulation = await mlRuntimeService.simulateCondition(scenario, overrides);
    res.json({
      scenario,
      count: simulation.results.length,
      results: simulation.results,
      milestone: simulation.milestone,
    });
  } catch (err) {
    console.error('[Dashboard] Error running ML simulation:', err);
    res.status(500).json({ error: 'Failed to run ML simulation' });
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
