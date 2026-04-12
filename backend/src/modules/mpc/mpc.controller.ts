import { MPCConfig, HydraulicModel, defaultHydraulicModel } from './mpc.config.js';

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
  reason: 'nominal' | 'overpressure' | 'underpressure' | 'protect_higher_zone';
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

export function computeNetworkPressure(
  valves: Record<string, number>,
  model: HydraulicModel
): Record<string, number> {
  const pressures: Record<string, number> = {};
  const nodeIds = Object.keys(model.elevation_head);
  
  for (const nodeId of nodeIds) {
    let mainPressure = model.pump_head_bar;
    
    for (const [valveId, vOpen] of Object.entries(valves)) {
      const coupling = model.coupling_matrix[nodeId]?.[valveId] ?? (nodeId === valveId ? 0.1 : 0.05);
      mainPressure -= coupling * (vOpen / 100);
    }
    
    const elevBar = (model.elevation_head[nodeId] ?? 0) * 0.098;
    const lossBar = model.base_loss[nodeId] ?? 0.2;
    
    pressures[nodeId] = mainPressure - elevBar - lossBar;
  }
  
  return pressures;
}

export function networkCostWithModel(
  nodes: MPCNodeState[],
  valveMap: Record<string, number>,
  currentValveMap: Record<string, number>,
  model: HydraulicModel,
  alpha: number,
  beta: number
): number {
  let pressureCost = 0;
  let movementCost = 0;
  let penaltyCost = 0;
  
  const pressures = computeNetworkPressure(valveMap, model);
  
  for (const node of nodes) {
    const pressure = pressures[node.id] ?? node.pressure_bar;
    const err = pressure - node.setpoint_bar;
    pressureCost += err * err;
    
    const currentValve = currentValveMap[node.id] ?? node.valve_pct;
    const delta = (valveMap[node.id] ?? node.valve_pct) - currentValve;
    movementCost += delta * delta;
    
    if (pressure < node.min_pressure_bar) {
      const violation = node.min_pressure_bar - pressure;
      penaltyCost += 1000 * violation * violation;
    }
  }
  
  return alpha * pressureCost + beta * movementCost + penaltyCost;
}

export function optimizeCoupledValves(
  nodes: MPCNodeState[],
  model: HydraulicModel,
  config: Partial<MPCConfig>
): { valves: Record<string, number>; converged: boolean; iterations: number; cost: number } {
  const max_valve_step_pct = config.max_valve_step_pct ?? 10;
  const valve_min_pct = config.valve_min_pct ?? 20;
  const valve_max_pct = config.valve_max_pct ?? 100;
  const alpha = config.alpha ?? 1.0;
  const beta = config.beta ?? 0.1;
  const max_iterations = config.max_iterations ?? 200;
  const tolerance = config.tolerance ?? 1e-4;
  let learning_rate = config.learning_rate ?? 0.1;
  
  const nodeIds = nodes.map(n => n.id);
  const currentValveMap: Record<string, number> = {};
  const currentValves: number[] = [];
  
  for (const node of nodes) {
    currentValveMap[node.id] = node.valve_pct;
    currentValves.push(node.valve_pct);
  }
  
  let valveMap: Record<string, number> = { ...currentValveMap };
  let prevCost = networkCostWithModel(nodes, valveMap, currentValveMap, model, alpha, beta);
  let iterations = 0;
  let converged = false;
  const EPS = 0.5;
  
  for (let iter = 0; iter < max_iterations; iter++) {
    iterations++;
    const grad: Record<string, number> = {};
    
    for (const nodeId of nodeIds) {
      const vPlus = { ...valveMap };
      vPlus[nodeId] = Math.min(100, vPlus[nodeId] + EPS);
      const vMinus = { ...valveMap };
      vMinus[nodeId] = Math.max(0, vMinus[nodeId] - EPS);
      
      const costPlus = networkCostWithModel(nodes, vPlus, currentValveMap, model, alpha, beta);
      const costMinus = networkCostWithModel(nodes, vMinus, currentValveMap, model, alpha, beta);
      grad[nodeId] = (costPlus - costMinus) / (2 * EPS);
    }
    
    const nextValves: Record<string, number> = {};
    for (const nodeId of nodeIds) {
      const currentValve = currentValveMap[nodeId];
      let step = -learning_rate * grad[nodeId];
      step = Math.max(-max_valve_step_pct, Math.min(max_valve_step_pct, step));
      let newValve = (valveMap[nodeId] ?? currentValve) + step;
      newValve = Math.max(valve_min_pct, Math.min(valve_max_pct, newValve));
      nextValves[nodeId] = newValve;
    }
    
    const newCost = networkCostWithModel(nodes, nextValves, currentValveMap, model, alpha, beta);
    
    if (Math.abs(prevCost - newCost) < tolerance) {
      valveMap = nextValves;
      prevCost = newCost;
      converged = true;
      break;
    }
    
    if (newCost < prevCost) {
      valveMap = nextValves;
      prevCost = newCost;
    } else {
      learning_rate *= 0.5;
      if (learning_rate < 1e-4) {
        converged = true;
        break;
      }
    }
  }
  
  return { valves: valveMap, converged, iterations, cost: +prevCost.toFixed(6) };
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

export function runMPCCycle(input: { 
  nodes: MPCNodeState[]; 
  config?: Partial<MPCConfig>;
  hydraulicModel?: HydraulicModel;
}): MPCOptimizationResult {
  const { nodes, config = {}, hydraulicModel } = input;

  if (!nodes || nodes.length === 0) {
    return { commands: [], converged: false, iterations: 0, cost: 0, cycle_ms: 0, error: 'No active nodes' };
  }

  const t0 = Date.now();
  const couplingEnabled = config.coupling_enabled ?? false;
  
  let valveResults: { valves: number[] | Record<string, number>; converged: boolean; iterations: number; cost: number };
  let pressures: Record<string, number> = {};
  
  if (couplingEnabled && hydraulicModel) {
    const model = buildHydraulicModelFromNodes(nodes, hydraulicModel);
    const coupledResult = optimizeCoupledValves(nodes, model, config);
    valveResults = {
      valves: Object.values(coupledResult.valves),
      converged: coupledResult.converged,
      iterations: coupledResult.iterations,
      cost: coupledResult.cost,
    };
    pressures = computeNetworkPressure(coupledResult.valves, model);
  } else {
    const independentResult = optimizeValves(nodes, config);
    valveResults = independentResult;
  }
  
  const cycle_ms = Date.now() - t0;
  const valveArray = Array.isArray(valveResults.valves) 
    ? valveResults.valves 
    : Object.values(valveResults.valves);

  const commands = nodes.map((node, i) => {
    const target = Math.round(valveArray[i]);
    const delta = target - node.valve_pct;
    
    const estimatedPressure = couplingEnabled && hydraulicModel
      ? pressures[node.id] ?? node.pressure_bar
      : computePressure(node, target);

    let reason: 'nominal' | 'overpressure' | 'underpressure' | 'protect_higher_zone' = 'nominal';
    if (node.pressure_bar > node.setpoint_bar + 0.2) reason = 'overpressure';
    else if (node.pressure_bar < node.setpoint_bar - 0.2) reason = 'underpressure';
    
    if (couplingEnabled && hydraulicModel) {
      const higherNodes = nodes.filter(n => (n.elevation_m ?? 0) > (node.elevation_m ?? 0));
      for (const higherNode of higherNodes) {
        const higherPressure = pressures[higherNode.id] ?? higherNode.pressure_bar;
        if (higherPressure < higherNode.setpoint_bar - 0.3 && Math.abs(delta) > 5) {
          reason = 'protect_higher_zone';
          break;
        }
      }
    }

    return {
      id: node.id,
      valve_target_pct: target,
      delta_pct: delta,
      reason,
      estimated_pressure: +estimatedPressure.toFixed(3),
      setpoint_bar: node.setpoint_bar,
    };
  });

  return { 
    commands, 
    converged: valveResults.converged, 
    iterations: valveResults.iterations, 
    cost: +valveResults.cost.toFixed(6), 
    cycle_ms 
  };
}

function buildHydraulicModelFromNodes(nodes: MPCNodeState[], baseModel: HydraulicModel): HydraulicModel {
  const elevationHead: Record<string, number> = {};
  const baseLoss: Record<string, number> = {};
  const couplingMatrix: Record<string, Record<string, number>> = {};
  
  for (const node of nodes) {
    elevationHead[node.id] = node.elevation_m;
    baseLoss[node.id] = 0.2;
    couplingMatrix[node.id] = {};
    
    for (const otherNode of nodes) {
      if (node.id === otherNode.id) {
        couplingMatrix[node.id][otherNode.id] = baseModel.coupling_matrix[node.id]?.[otherNode.id] ?? 2.5;
      } else {
        const elevDiff = (node.elevation_m ?? 0) - (otherNode.elevation_m ?? 0);
        couplingMatrix[node.id][otherNode.id] = elevDiff > 0 ? 0.1 : 0.8;
      }
    }
  }
  
  return {
    pump_head_bar: baseModel.pump_head_bar,
    elevation_head: elevationHead,
    base_loss: baseLoss,
    coupling_matrix: couplingMatrix,
    is_calibrated: baseModel.is_calibrated,
  };
}
