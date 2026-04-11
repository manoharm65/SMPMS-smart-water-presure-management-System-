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
  coupling_enabled: boolean;
}

export interface HydraulicModel {
  pump_head_bar: number;
  elevation_head: Record<string, number>;
  coupling_matrix: Record<string, Record<string, number>>;
  base_loss: Record<string, number>;
  is_calibrated: boolean;
  last_calibrated?: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseHydraulicModel(): HydraulicModel {
  const defaultModel: HydraulicModel = {
    pump_head_bar: parseFloat(process.env.MPC_PUMP_HEAD || '6.0'),
    elevation_head: {},
    coupling_matrix: {},
    base_loss: {},
    is_calibrated: false,
  };
  
  try {
    const elevRaw = process.env.MPC_ELEVATION_HEAD;
    if (elevRaw) {
      defaultModel.elevation_head = JSON.parse(elevRaw);
    }
    
    const matrixRaw = process.env.MPC_COUPLING_MATRIX;
    if (matrixRaw) {
      defaultModel.coupling_matrix = JSON.parse(matrixRaw);
    }
    
    const lossRaw = process.env.MPC_BASE_LOSS;
    if (lossRaw) {
      defaultModel.base_loss = JSON.parse(lossRaw);
    }
  } catch (e) {
    console.warn('[MPC] Failed to parse hydraulic model from env, using defaults');
  }
  
  return defaultModel;
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
  history_size:       50,
  dispatch_timeout_ms: 5000,
  coupling_enabled:   parseBoolean(process.env.MPC_COUPLING_ENABLED, true),
};

export const defaultHydraulicModel: HydraulicModel = parseHydraulicModel();