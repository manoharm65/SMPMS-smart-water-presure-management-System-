'use strict';

/**
 * mpc-controller.js
 * AquaBytes SMPMS — Model Predictive Controller (Core Optimizer)
 *
 * Pure function — no I/O, no side effects, no dependencies.
 * Takes current node states, returns optimal valve commands.
 * Scales to any number of nodes without structural change.
 */

// ---------------------------------------------------------------------------
// Hydraulic Model
// ---------------------------------------------------------------------------

/**
 * Estimate pressure at a node given its valve position.
 * Linear approximation valid for gravity-fed low-velocity networks.
 *
 * P_i = P_source - k_elev × elevation - k_res × (1 - valve/100) × flow
 *
 * k_elev and k_res are calibrated constants.
 * For demo: derive P_source from current observed pressure + reverse model.
 */
function computePressure(node, valvePct) {
  const K_ELEV = 0.008;   // bar per metre of elevation
  const K_RES  = 0.015;   // bar per (lps × valve-restriction-fraction)

  const restriction = 1.0 - (valvePct / 100.0);
  const flowEffect  = K_RES * restriction * (node.flow_lps || 0);
  const elevEffect  = K_ELEV * node.elevation_m;

  // Back-calculate P_source from current observed state so model is anchored
  // to reality at each cycle, not drifting over time.
  const currentRestriction = 1.0 - (node.valve_pct / 100.0);
  const pSource = node.pressure_bar
    + K_ELEV * node.elevation_m
    + K_RES * currentRestriction * (node.flow_lps || 0);

  return pSource - elevEffect - flowEffect;
}

// ---------------------------------------------------------------------------
// Cost Function
// ---------------------------------------------------------------------------

/**
 * Total network cost.
 * alpha: weight on pressure error (primary objective)
 * beta:  weight on valve movement (smoothness penalty)
 */
function networkCost(nodes, proposedValves, currentValves, alpha, beta) {
  let pressureCost = 0;
  let movementCost = 0;
  let penaltyCost  = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node     = nodes[i];
    const valve    = proposedValves[i];
    const pressure = computePressure(node, valve);

    // Pressure error vs setpoint
    const err = pressure - node.setpoint_bar;
    pressureCost += err * err;

    // Valve movement penalty (prefer small adjustments)
    const delta = valve - currentValves[i];
    movementCost += delta * delta;

    // Hard constraint penalty: below minimum pressure
    if (pressure < node.min_pressure_bar) {
      const violation = node.min_pressure_bar - pressure;
      penaltyCost += 1000 * violation * violation;
    }
  }

  return alpha * pressureCost + beta * movementCost + penaltyCost;
}

// ---------------------------------------------------------------------------
// Gradient Descent Optimizer
// ---------------------------------------------------------------------------

/**
 * Gradient descent over valve positions to minimize networkCost.
 * Returns converged valve positions.
 */
function optimizeValves(nodes, config) {
  const {
    max_valve_step_pct = 10,
    valve_min_pct      = 20,
    valve_max_pct      = 100,
    alpha              = 1.0,
    beta               = 0.1,
    max_iterations     = 200,
    tolerance          = 1e-4,
    learning_rate      = 0.8,
  } = config;

  const N = nodes.length;
  const currentValves = nodes.map(n => n.valve_pct);

  // Start from current valve positions
  let valves = [...currentValves];
  const EPS  = 0.5; // finite difference step (%)

  let prevCost = networkCost(nodes, valves, currentValves, alpha, beta);
  let iterations = 0;
  let converged  = false;

  for (let iter = 0; iter < max_iterations; iter++) {
    iterations++;

    // Compute gradient via finite differences
    const grad = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const vPlus  = [...valves]; vPlus[i]  += EPS;
      const vMinus = [...valves]; vMinus[i] -= EPS;
      grad[i] = (
        networkCost(nodes, vPlus,  currentValves, alpha, beta) -
        networkCost(nodes, vMinus, currentValves, alpha, beta)
      ) / (2 * EPS);
    }

    // Gradient step
    const next = valves.map((v, i) => v - learning_rate * grad[i]);

    // Apply constraints
    for (let i = 0; i < N; i++) {
      // Rate limit: max change per MPC cycle
      next[i] = Math.max(currentValves[i] - max_valve_step_pct,
                Math.min(currentValves[i] + max_valve_step_pct, next[i]));
      // Hard bounds
      next[i] = Math.max(valve_min_pct, Math.min(valve_max_pct, next[i]));
    }

    const newCost = networkCost(nodes, next, currentValves, alpha, beta);

    // Convergence check
    if (Math.abs(prevCost - newCost) < tolerance) {
      valves    = next;
      prevCost  = newCost;
      converged = true;
      break;
    }

    // Armijo line search: only accept step if it reduces cost
    if (newCost < prevCost) {
      valves   = next;
      prevCost = newCost;
    } else {
      // Reduce learning rate and retry (simple backtracking)
      learning_rate *= 0.5;
      if (learning_rate < 1e-4) { converged = true; break; }
    }
  }

  return { valves, cost: prevCost, converged, iterations };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run one MPC cycle.
 *
 * @param {Object} input
 * @param {Array}  input.nodes   - Array of node state objects (see PRD §4.1)
 * @param {Object} input.config  - Optimizer config (see PRD §7)
 * @returns {Object} commands, converged, iterations, cost, cycle_ms
 */
function runMPCCycle(input) {
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

module.exports = { runMPCCycle, computePressure, networkCost };
