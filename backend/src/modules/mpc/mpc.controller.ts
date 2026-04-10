import { MPCConfig } from './mpc.config.js';

export interface MPCNodeState {
  id: string;
  pressure_bar: number;
  flow_lps: number;
  valve_pct: number;
  elevation_m: number;
  setpoint_bar: number;
  min_pressure_bar: number;
  max_pressure_bar: number;
  last_seen?: number;
  ip?: string;
  status?: string;
  last_command?: string;
}

export interface MPCCommandResult {
  id: string;
  valve_target_pct: number;
  delta_pct: number;
  reason: string;
  estimated_pressure: number;
  setpoint_bar: number;
}

export interface MPCOptimizationResult {
  commands: MPCCommandResult[];
  converged: boolean;
  iterations: number;
  cost: number;
  cycle_ms: number;
  error?: string;
}

export function computePressure(node: MPCNodeState, valvePct: number): number {
  const K_ELEV = 0.008;
  const K_RES  = 0.015;

  const restriction = 1.0 - (valvePct / 100.0);
  const flowEffect  = K_RES * restriction * (node.flow_lps || 0);
  const elevEffect  = K_ELEV * node.elevation_m;

  const currentRestriction = 1.0 - (node.valve_pct / 100.0);
  const pSource = node.pressure_bar
    + K_ELEV * node.elevation_m
    + K_RES * currentRestriction * (node.flow_lps || 0);

  return pSource - elevEffect - flowEffect;
}

export function networkCost(nodes: MPCNodeState[], proposedValves: number[], currentValves: number[], alpha: number, beta: number): number {
  let pressureCost = 0;
  let movementCost = 0;
  let penaltyCost  = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node     = nodes[i];
    const valve    = proposedValves[i];
    const pressure = computePressure(node, valve);

    const err = pressure - node.setpoint_bar;
    pressureCost += err * err;

    const delta = valve - currentValves[i];
    movementCost += delta * delta;

    if (pressure < node.min_pressure_bar) {
      const violation = node.min_pressure_bar - pressure;
      penaltyCost += 1000 * violation * violation;
    }
  }

  return alpha * pressureCost + beta * movementCost + penaltyCost;
}

export function optimizeValves(nodes: MPCNodeState[], config: Partial<MPCConfig>): { valves: number[]; cost: number; converged: boolean; iterations: number } {
  const max_valve_step_pct = config.max_valve_step_pct ?? 10;
  const valve_min_pct      = config.valve_min_pct ?? 20;
  const valve_max_pct      = config.valve_max_pct ?? 100;
  const alpha              = config.alpha ?? 1.0;
  const beta               = config.beta ?? 0.1;
  const max_iterations     = config.max_iterations ?? 200;
  const tolerance          = config.tolerance ?? 1e-4;
  let learning_rate        = config.learning_rate ?? 0.8;

  const N = nodes.length;
  const currentValves = nodes.map(n => n.valve_pct);

  let valves = [...currentValves];
  const EPS  = 0.5;

  let prevCost = networkCost(nodes, valves, currentValves, alpha, beta);
  let iterations = 0;
  let converged  = false;

  for (let iter = 0; iter < max_iterations; iter++) {
    iterations++;

    const grad = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const vPlus  = [...valves]; vPlus[i]  += EPS;
      const vMinus = [...valves]; vMinus[i] -= EPS;
      grad[i] = (
        networkCost(nodes, vPlus,  currentValves, alpha, beta) -
        networkCost(nodes, vMinus, currentValves, alpha, beta)
      ) / (2 * EPS);
    }

    const next = valves.map((v, i) => v - learning_rate * grad[i]);

    for (let i = 0; i < N; i++) {
      next[i] = Math.max(currentValves[i] - max_valve_step_pct,
                Math.min(currentValves[i] + max_valve_step_pct, next[i]));
      next[i] = Math.max(valve_min_pct, Math.min(valve_max_pct, next[i]));
    }

    const newCost = networkCost(nodes, next, currentValves, alpha, beta);

    if (Math.abs(prevCost - newCost) < tolerance) {
      valves    = next;
      prevCost  = newCost;
      converged = true;
      break;
    }

    if (newCost < prevCost) {
      valves   = next;
      prevCost = newCost;
    } else {
      learning_rate *= 0.5;
      if (learning_rate < 1e-4) { converged = true; break; }
    }
  }

  return { valves, cost: prevCost, converged, iterations };
}

export function runMPCCycle(input: { nodes: MPCNodeState[]; config?: Partial<MPCConfig> }): MPCOptimizationResult {
  const { nodes, config = {} } = input;

  if (!nodes || nodes.length === 0) {
    return { commands: [], converged: false, iterations: 0, cost: 0, cycle_ms: 0, error: 'No active nodes' };
  }

  const t0 = Date.now();
  const { valves, cost, converged, iterations } = optimizeValves(nodes, config);
  const cycle_ms = Date.now() - t0;

  const commands = nodes.map((node, i) => {
    const target = Math.round(valves[i]);
    const delta  = target - node.valve_pct;
    const estimatedPressure = computePressure(node, target);

    let reason = 'nominal';
    if (node.pressure_bar > node.setpoint_bar + 0.2)      reason = 'overpressure';
    else if (node.pressure_bar < node.setpoint_bar - 0.2) reason = 'underpressure';

    return {
      id:                  node.id,
      valve_target_pct:    target,
      delta_pct:           delta,
      reason,
      estimated_pressure:  +estimatedPressure.toFixed(3),
      setpoint_bar:        node.setpoint_bar,
    };
  });

  return { commands, converged, iterations, cost: +cost.toFixed(6), cycle_ms };
}
