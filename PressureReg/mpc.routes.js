'use strict';

/**
 * mpc.routes.js
 * AquaBytes SMPMS — MPC API Routes
 * Mount in your Express app: app.use('/mpc', require('./routes/mpc.routes'));
 */

const express    = require('express');
const router     = express.Router();
const mpcService = require('../mpc/mpc-service');

// GET /mpc/status
router.get('/status', (req, res) => {
  res.json(mpcService.getStatus());
});

// GET /mpc/history
router.get('/history', (req, res) => {
  res.json(mpcService.getHistory());
});

// GET /mpc/nodes
router.get('/nodes', (req, res) => {
  res.json(mpcService.getNodes());
});

// GET /mpc/config
router.get('/config', (req, res) => {
  res.json(mpcService.getConfig());
});

// PUT /mpc/config  — update optimizer parameters at runtime
router.put('/config', (req, res) => {
  const updated = mpcService.updateConfig(req.body);
  res.json(updated);
});

// POST /mpc/run  — trigger immediate optimization cycle
router.post('/run', async (req, res) => {
  try {
    const result = await mpcService.runCycle();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
