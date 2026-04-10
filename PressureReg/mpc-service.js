'use strict';

/**
 * mpc-service.js
 * AquaBytes SMPMS — MPC Runtime Service
 *
 * Responsibilities:
 *   - Maintain live node state registry (updated from telemetry POSTs)
 *   - Run MPC optimizer on schedule
 *   - Dispatch valve commands to ESP32 nodes via HTTP
 *   - Expose status, history, and on-demand trigger
 */

const http  = require('http');
const https = require('https');
const { runMPCCycle } = require('./mpc-controller');
const { defaults }   = require('./mpc-config');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let config  = { ...defaults };
let timer   = null;
let running = false;

// Node registry: Map<dma_id, NodeState>
// NodeState = { ...telemetry fields, ip, last_seen, status: ACTIVE|STALE }
const nodeRegistry = new Map();

// Cycle history: ring buffer of last config.history_size results
const history = [];

let lastCycle = null;

// ---------------------------------------------------------------------------
// Node Registry
// ---------------------------------------------------------------------------

/**
 * Called by telemetry ingestion on every incoming ESP32 POST.
 * Registers the node if new, updates its state if existing.
 *
 * @param {Object} telemetry - Must include: id, pressure_bar, flow_lps,
 *   valve_pct, elevation_m, setpoint_bar, min_pressure_bar, max_pressure_bar
 * @param {string} [ip] - ESP32 node IP for command dispatch (optional)
 */
function updateNodeState(telemetry, ip) {
  const entry = {
    ...telemetry,
    ip:        ip || nodeRegistry.get(telemetry.id)?.ip || null,
    last_seen: Date.now(),
    status:    'ACTIVE',
  };
  nodeRegistry.set(telemetry.id, entry);
}

/**
 * Mark nodes not seen recently as STALE and exclude from optimization.
 */
function refreshNodeStatuses() {
  const now = Date.now();
  for (const [id, node] of nodeRegistry.entries()) {
    node.status = (now - node.last_seen) > config.stale_timeout_ms ? 'STALE' : 'ACTIVE';
    nodeRegistry.set(id, node);
  }
}

function getActiveNodes() {
  refreshNodeStatuses();
  return [...nodeRegistry.values()].filter(n => n.status === 'ACTIVE');
}

// ---------------------------------------------------------------------------
// Command Dispatch
// ---------------------------------------------------------------------------

/**
 * Send valve target command to a single ESP32 node.
 * Fire-and-forget with timeout — non-blocking.
 */
function dispatchCommand(node, valve_target_pct) {
  if (!node.ip) return Promise.resolve({ skipped: true, reason: 'no_ip' });

  const body = JSON.stringify({ valve_target_pct });
  const url  = `http://${node.ip}/command`;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ error: 'timeout' }), config.dispatch_timeout_ms);

    const req = http.request(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      clearTimeout(timeout);
      resolve({ status: res.statusCode });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ error: err.message });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Dispatch all commands from an MPC cycle result.
 * Runs in parallel — does not block the next cycle.
 */
async function dispatchAll(commands) {
  const dispatches = commands.map(cmd => {
    const node = nodeRegistry.get(cmd.id);
    if (!node) return Promise.resolve({ id: cmd.id, error: 'node_not_found' });
    return dispatchCommand(node, cmd.valve_target_pct)
      .then(result => ({ id: cmd.id, ...result }));
  });

  return Promise.all(dispatches);
}

// ---------------------------------------------------------------------------
// Optimization Cycle
// ---------------------------------------------------------------------------

async function runCycle() {
  if (running) return null; // prevent overlapping cycles
  running = true;

  try {
    const activeNodes = getActiveNodes();

    if (activeNodes.length === 0) {
      lastCycle = {
        timestamp:  new Date().toISOString(),
        commands:   [],
        converged:  false,
        cost:       null,
        cycle_ms:   0,
        dispatched: [],
        error:      'No active nodes',
      };
      pushHistory(lastCycle);
      return lastCycle;
    }

    const result = runMPCCycle({ nodes: activeNodes, config });
    const dispatched = await dispatchAll(result.commands);

    // Update local valve_pct in registry after successful dispatch
    for (const cmd of result.commands) {
      const node = nodeRegistry.get(cmd.id);
      if (node) {
        node.valve_pct   = cmd.valve_target_pct;
        node.last_command = new Date().toISOString();
        nodeRegistry.set(cmd.id, node);
      }
    }

    lastCycle = {
      timestamp:  new Date().toISOString(),
      active_nodes: activeNodes.length,
      ...result,
      dispatched,
    };

    pushHistory(lastCycle);
    return lastCycle;

  } finally {
    running = false;
  }
}

function pushHistory(entry) {
  history.push(entry);
  if (history.length > config.history_size) history.shift();
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

function start() {
  if (!config.enabled) return;
  stop();
  timer = setInterval(runCycle, config.interval_ms);
  console.log(`[MPC] Started — interval ${config.interval_ms}ms`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function getStatus() {
  return {
    enabled:      config.enabled,
    running,
    interval_ms:  config.interval_ms,
    active_nodes: getActiveNodes().length,
    total_nodes:  nodeRegistry.size,
    last_cycle:   lastCycle,
  };
}

function getHistory() {
  return [...history];
}

function getNodes() {
  refreshNodeStatuses();
  return [...nodeRegistry.values()].map(({ ip, ...rest }) => rest); // omit ip from public response
}

function updateConfig(patch) {
  config = { ...config, ...patch };
  if (config.enabled && !timer) start();
  if (!config.enabled)           stop();
  return config;
}

module.exports = {
  start,
  stop,
  runCycle,         // for on-demand trigger
  updateNodeState,  // called by telemetry handler
  getStatus,
  getHistory,
  getNodes,
  updateConfig,
  getConfig: () => ({ ...config }),
};
