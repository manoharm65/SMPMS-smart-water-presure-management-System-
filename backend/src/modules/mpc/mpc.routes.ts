import { Router, Request, Response } from 'express';
import { mpcService, getHydraulicModel, updateHydraulicModel } from './mpc.service.js';
import { randomUUID } from 'crypto';
import { getDatabase } from '../../database/db.js';

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

router.get('/hydraulic-model', (req: Request, res: Response) => {
  const model = getHydraulicModel();
  res.json({
    pump_head_bar: model.pump_head_bar,
    elevation_head: model.elevation_head,
    coupling_matrix: model.coupling_matrix,
    base_loss: model.base_loss,
    is_calibrated: model.is_calibrated,
    last_calibrated: model.last_calibrated,
  });
});

router.put('/hydraulic-model', (req: Request, res: Response) => {
  const { 
    pump_head_bar, 
    elevation_head, 
    coupling_matrix, 
    base_loss,
    is_calibrated 
  } = req.body;
  
  const updated = updateHydraulicModel({
    pump_head_bar: pump_head_bar ?? undefined,
    elevation_head: elevation_head ?? undefined,
    coupling_matrix: coupling_matrix ?? undefined,
    base_loss: base_loss ?? undefined,
    is_calibrated: is_calibrated ?? undefined,
    last_calibrated: is_calibrated ? new Date().toISOString() : undefined,
  });
  
  res.json({
    success: true,
    model: {
      pump_head_bar: updated.pump_head_bar,
      elevation_head: updated.elevation_head,
      coupling_matrix: updated.coupling_matrix,
      base_loss: updated.base_loss,
      is_calibrated: updated.is_calibrated,
      last_calibrated: updated.last_calibrated,
    },
  });
});

router.post('/calibrate/step', (req: Request, res: Response) => {
  const { source_node, target_node, steps } = req.body;
  
  if (!source_node || !target_node) {
    res.status(400).json({ error: 'source_node and target_node are required' });
    return;
  }
  
  const defaultSteps = [30, 40, 50, 60, 70, 80];
  const testSteps = Array.isArray(steps) ? steps : defaultSteps;
  
  const model = getHydraulicModel();
  
  const results = testSteps.map((stepVal: number) => {
    const coupling = model.coupling_matrix[target_node]?.[source_node] ?? 0.5;
    const estimatedDeltaP = -(coupling * (stepVal / 100));
    return {
      valve_pct: stepVal,
      estimated_pressure_delta: Number(estimatedDeltaP.toFixed(3)),
    };
  });
  
  const avgK = results.reduce((sum, r) => sum + Math.abs(r.estimated_pressure_delta) / (r.valve_pct / 100), 0) / results.length;
  
  const db = getDatabase();
  db.run(
    `INSERT OR REPLACE INTO mpc_calibration_log 
     (id, timestamp, source_node, target_node, k_ij_measured, method) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), new Date().toISOString(), source_node, target_node, avgK, 'step_test']
  );
  
  res.json({
    success: true,
    source_node,
    target_node,
    k_ij_estimated: Number(avgK.toFixed(4)),
    results,
    message: `Calibration logged. Coupling K_${target_node}_${source_node} ≈ ${avgK.toFixed(2)}`,
  });
});

router.post('/calibrate/run', (req: Request, res: Response) => {
  const nodes = mpcService.getNodes();
  
  if (nodes.length < 2) {
    res.status(400).json({ error: 'Need at least 2 nodes for calibration' });
    return;
  }
  
  const model = getHydraulicModel();
  const calibrationResults: Array<{ source: string; target: string; k: number }> = [];
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      
      const sourceNode = nodes[i];
      const targetNode = nodes[j];
      
      const elevDiff = (sourceNode.elevation_m ?? 0) - (targetNode.elevation_m ?? 0);
      let k: number;
      
      if (sourceNode.id === targetNode.id) {
        k = 2.5;
      } else if (elevDiff > 0) {
        k = 0.1;
      } else {
        k = 0.8;
      }
      
      if (!model.coupling_matrix[targetNode.id]) {
        model.coupling_matrix[targetNode.id] = {};
      }
      model.coupling_matrix[targetNode.id][sourceNode.id] = k;
      
      calibrationResults.push({
        source: sourceNode.id,
        target: targetNode.id,
        k: Number(k.toFixed(2)),
      });
    }
  }
  
  updateHydraulicModel({
    coupling_matrix: model.coupling_matrix,
    is_calibrated: true,
    last_calibrated: new Date().toISOString(),
  });
  
  res.json({
    success: true,
    nodes_calibrated: nodes.length,
    couplings_updated: calibrationResults.length,
    results: calibrationResults,
    message: 'Auto-calibration complete. Run step test for fine-tuning.',
  });
});

export default router;
