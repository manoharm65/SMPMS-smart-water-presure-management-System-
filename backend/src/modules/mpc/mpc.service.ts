import { runMPCCycle, MPCNodeState, MPCOptimizationResult } from './mpc.controller.js';
import { mpcConfigDefaults, MPCConfig } from './mpc.config.js';
import { eventBus, ActionPayload } from '../../core/event-bus.js';
import { integrationOrchestrator } from '../integration/integration.orchestrator.js';

let config: MPCConfig = { ...mpcConfigDefaults };
let timer: NodeJS.Timeout | null = null;
let running = false;

const nodeRegistry = new Map<string, MPCNodeState>();
const history: any[] = [];
let lastCycle: any = null;

export function updateNodeState(telemetry: Partial<MPCNodeState> & { id: string }, ip?: string) {
  const existing = nodeRegistry.get(telemetry.id);
  const entry: MPCNodeState = {
    id: telemetry.id,
    pressure_bar: telemetry.pressure_bar ?? existing?.pressure_bar ?? 0,
    flow_lps: telemetry.flow_lps ?? existing?.flow_lps ?? 0,
    valve_pct: telemetry.valve_pct ?? existing?.valve_pct ?? 0,
    elevation_m: telemetry.elevation_m ?? existing?.elevation_m ?? 0,
    setpoint_bar: telemetry.setpoint_bar ?? existing?.setpoint_bar ?? 3.0,
    min_pressure_bar: telemetry.min_pressure_bar ?? existing?.min_pressure_bar ?? 1.5,
    max_pressure_bar: telemetry.max_pressure_bar ?? existing?.max_pressure_bar ?? 5.5,
    ip: ip || existing?.ip,
    last_seen: Date.now(),
    status: 'ACTIVE',
  };
  nodeRegistry.set(telemetry.id, entry);
}

function refreshNodeStatuses() {
  const now = Date.now();
  for (const [id, node] of nodeRegistry.entries()) {
    node.status = (now - (node.last_seen || 0)) > config.stale_timeout_ms ? 'STALE' : 'ACTIVE';
    nodeRegistry.set(id, node);
  }
}

function getActiveNodes() {
  refreshNodeStatuses();
  return [...nodeRegistry.values()].filter(n => n.status === 'ACTIVE');
}

async function dispatchAll(commands: any[]) {
  const dispatches = commands.map(cmd => {
    const node = nodeRegistry.get(cmd.id);
    if (!node) return { id: cmd.id, error: 'node_not_found' };
    
    let riskLevel = 'NORMAL';
    if (cmd.reason === 'overpressure') riskLevel = 'HIGH';
    else if (cmd.reason === 'underpressure') riskLevel = 'WARNING';
    
    const payload: ActionPayload = {
      nodeId: cmd.id,
      command: 'SET_VALVE:' + cmd.valve_target_pct,
      targetPosition: cmd.valve_target_pct,
      riskLevel,
      pressure: cmd.estimated_pressure,
      source: 'decision',
    };
    
    eventBus.emitActionDispatched(payload);
    
    return { id: cmd.id, status: 'enqueued_via_event_bus' };
  });

  return dispatches;
}

export async function runCycle() {
  if (running) return null;
  running = true;

  try {
    const activeNodes = getActiveNodes();

    if (activeNodes.length === 0) {
      lastCycle = {
        timestamp: new Date().toISOString(),
        commands: [],
        converged: false,
        cost: null,
        cycle_ms: 0,
        dispatched: [],
        error: 'No active nodes',
      };
      pushHistory(lastCycle);
      return lastCycle;
    }

    const result = runMPCCycle({ nodes: activeNodes, config });
    const dispatched = await dispatchAll(result.commands);

    integrationOrchestrator.captureMpcCycle({
      timestamp: new Date().toISOString(),
      commands: result.commands.map(cmd => ({
        id: cmd.id,
        reason: cmd.reason || 'optimization',
        valve_target_pct: cmd.valve_target_pct,
        estimated_pressure: cmd.estimated_pressure,
      })),
      riskHint: result.cost !== null && result.cost > 100 ? 'WARNING' : undefined,
    });

    for (const cmd of result.commands) {
      const node = nodeRegistry.get(cmd.id);
      if (node) {
        node.valve_pct = cmd.valve_target_pct;
        node.last_command = new Date().toISOString();
        nodeRegistry.set(cmd.id, node);
      }
    }

    lastCycle = {
      timestamp: new Date().toISOString(),
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

function pushHistory(entry: any) {
  history.push(entry);
  if (history.length > config.history_size) history.shift();
}

export function start() {
  if (!config.enabled) return;
  stop();
  timer = setInterval(() => {
    runCycle().catch(console.error);
  }, config.interval_ms);
  console.log('[MPC] Started — interval ' + config.interval_ms + 'ms');
}

export function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function getStatus() {
  return {
    enabled: config.enabled,
    running,
    interval_ms: config.interval_ms,
    active_nodes: getActiveNodes().length,
    total_nodes: nodeRegistry.size,
    last_cycle: lastCycle,
  };
}

export function getHistory() {
  return [...history];
}

export function getNodes() {
  refreshNodeStatuses();
  return [...nodeRegistry.values()].map(({ ip, ...rest }) => rest);
}

export function updateConfig(patch: Partial<MPCConfig>) {
  config = { ...config, ...patch };
  if (config.enabled && !timer) start();
  if (!config.enabled) stop();
  return config;
}

export function getConfig() {
  return { ...config };
}

export const mpcService = {
  start,
  stop,
  runCycle,
  updateNodeState,
  getStatus,
  getHistory,
  getNodes,
  updateConfig,
  getConfig,
};
