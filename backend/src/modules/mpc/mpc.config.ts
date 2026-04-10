export interface MPCConfig {
  enabled: boolean;
  interval_ms: number;
  stale_timeout_ms: number;
  max_valve_step_pct: number;
  valve_min_pct: number;
  valve_max_pct: number;
  alpha: number;
  beta: number;
  max_iterations: number;
  tolerance: number;
  learning_rate: number;
  history_size: number;
  dispatch_timeout_ms: number;
}

export const mpcConfigDefaults: MPCConfig = {
  enabled:            process.env.MPC_ENABLED            !== 'false',
  interval_ms:        parseInt(process.env.MPC_INTERVAL_MS || '30000', 10),
  stale_timeout_ms:   parseInt(process.env.MPC_STALE_TIMEOUT_MS || '60000', 10),
  max_valve_step_pct: parseInt(process.env.MPC_MAX_VALVE_STEP || '10', 10),
  valve_min_pct:      parseInt(process.env.MPC_VALVE_MIN || '20', 10),
  valve_max_pct:      parseInt(process.env.MPC_VALVE_MAX || '100', 10),
  alpha:              parseFloat(process.env.MPC_ALPHA || '1.0'),
  beta:               parseFloat(process.env.MPC_BETA || '0.1'),
  max_iterations:     200,
  tolerance:          1e-4,
  learning_rate:      0.8,
  history_size:       50,       // cycles to keep in memory
  dispatch_timeout_ms: 5000,    // HTTP timeout for valve command dispatch
};