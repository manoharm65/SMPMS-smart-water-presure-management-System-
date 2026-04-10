'use strict';

/**
 * mpc-config.js
 * AquaBytes SMPMS — MPC Configuration
 * All values overridable via environment variables or PUT /mpc/config at runtime.
 */

const defaults = {
  enabled:            process.env.MPC_ENABLED            !== 'false',
  interval_ms:        parseInt(process.env.MPC_INTERVAL_MS)        || 30000,
  stale_timeout_ms:   parseInt(process.env.MPC_STALE_TIMEOUT_MS)   || 60000,
  max_valve_step_pct: parseInt(process.env.MPC_MAX_VALVE_STEP)      || 10,
  valve_min_pct:      parseInt(process.env.MPC_VALVE_MIN)           || 20,
  valve_max_pct:      parseInt(process.env.MPC_VALVE_MAX)           || 100,
  alpha:              parseFloat(process.env.MPC_ALPHA)             || 1.0,
  beta:               parseFloat(process.env.MPC_BETA)              || 0.1,
  max_iterations:     200,
  tolerance:          1e-4,
  learning_rate:      0.8,
  history_size:       50,       // cycles to keep in memory
  dispatch_timeout_ms: 5000,    // HTTP timeout for valve command dispatch
};

module.exports = { defaults };
