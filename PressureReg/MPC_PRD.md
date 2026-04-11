# PRD — MPC Pressure Regulation Module
**AquaBytes ID3 · SMPMS · v1.0**

| Field | Value |
|---|---|
| Module | `mpc` — Model Predictive Controller |
| Scope | Pressure regulation across N DMA nodes |
| Stack | Node.js (pure JS, no Python dependency) |
| Status | PoC — 2-node demo, N-node ready |

---

## 1. Problem

Rule-based valve control (threshold + bang-bang) fails at scale because DMA nodes are hydraulically interdependent. Closing a valve at one node changes pressure at all downstream nodes simultaneously. Rules written per-node conflict at network level causing valve hunting and unequal pressure distribution.

---

## 2. Objective

Deploy a centralized MPC optimizer that:
- Takes real-time pressure, flow, and valve state from all active nodes
- Computes optimal valve positions network-wide every 30 seconds
- Sends valve commands back to each ESP32 node
- Scales to any number of nodes without structural code change

---

## 3. Architecture

```
ESP32 Node(s)
  └── POST /telemetry  →  Node.js Backend
                              └── mpc-service.js  (runs every 30s)
                                    └── mpc-controller.js  (optimizer core)
                                          └── returns { dma_id, valve_target_pct }[]
                              └── POST /command  →  ESP32 Node(s)
                              └── stores result  →  DB / in-memory
React Dashboard
  └── GET /mpc/status   →  current valve targets, pressure deltas, cycle info
  └── GET /mpc/history  →  past N cycles
```

---

## 4. Module Breakdown

### 4.1 `mpc/mpc-controller.js` — Core Optimizer

Pure function. No I/O. No side effects. Receives node states, returns valve commands.

**Input:**
```js
{
  nodes: [
    {
      id: "DMA-01",
      pressure_bar: 3.8,
      flow_lps: 12.4,
      valve_pct: 75,
      elevation_m: 10,
      setpoint_bar: 3.0,
      min_pressure_bar: 1.5,
      max_pressure_bar: 5.5
    },
    // ... N nodes
  ],
  config: {
    max_valve_step_pct: 10,   // max change per cycle
    valve_min_pct: 20,
    valve_max_pct: 100,
    alpha: 1.0,               // pressure error weight
    beta: 0.1                 // valve movement penalty weight
  }
}
```

**Output:**
```js
{
  commands: [
    { id: "DMA-01", valve_target_pct: 60, delta_pct: -15, reason: "overpressure" },
    { id: "DMA-02", valve_target_pct: 85, delta_pct: +10, reason: "underpressure" }
  ],
  converged: true,
  iterations: 12,
  cost: 0.034,
  cycle_ms: 3
}
```

**Algorithm:**

Gradient descent on a quadratic cost function:

```
Cost = α × Σ(P_i - setpoint_i)²  +  β × Σ(ΔV_i)²

Subject to:
  V_i ∈ [valve_min, valve_max]
  |ΔV_i| ≤ max_valve_step
  P_i ≥ min_pressure_bar  (enforced via penalty)
```

Hydraulic model (linear approximation, sufficient for PoC):

```
P_i = P_source_i - k_elevation × elevation_i - k_resistance × (1 - V_i/100) × flow_i
```

`k_elevation` and `k_resistance` are calibrated from observed data or set as constants for demo.

---

### 4.2 `mpc/mpc-service.js` — Runtime Integration

Wraps the optimizer. Handles scheduling, node registry, command dispatch, and history.

**Responsibilities:**
- Maintains in-memory node state registry (updated on each telemetry POST)
- Runs optimizer every `MPC_INTERVAL_MS` (default: 30000)
- Dispatches valve commands to ESP32 nodes via HTTP POST
- Exposes `/mpc/status` and `/mpc/history` endpoints
- On-demand trigger via `/mpc/run`

**Node Registry (in-memory):**
```js
Map<dma_id, { ...latestTelemetry, last_seen: timestamp }>
```

Nodes not seen for >60s are marked `STALE` and excluded from optimization.

---

## 5. API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/mpc/status` | GET | Latest cycle result: commands, cost, converged, cycle_ms |
| `/mpc/history` | GET | Last 50 optimization cycles |
| `/mpc/run` | POST | Trigger optimization immediately (demo use) |
| `/mpc/config` | GET | Current optimizer config |
| `/mpc/config` | PUT | Update config at runtime (setpoints, weights, limits) |
| `/mpc/nodes` | GET | All registered nodes with current state and ACTIVE/STALE status |

---

## 6. Integration with Existing System

### 6.1 Telemetry Ingestion

Existing `POST /telemetry` handler adds one line:

```js
mpcService.updateNodeState(telemetry); // register/update node in MPC registry
```

No other changes to existing telemetry pipeline.

### 6.2 Valve Command Dispatch

MPC service calls existing ESP32 command endpoint after each optimization cycle:

```js
POST http://{node_ip}/command
{ "valve_target_pct": 65 }
```

This is the same endpoint already used by manual dashboard valve control.

### 6.3 Dashboard Integration

Two additions to existing dashboard:

- **Overview screen**: MPC status badge (ACTIVE / STALE / ERROR), last cycle time, network cost value
- **Zone Detail screen**: MPC-computed valve target shown alongside current valve position, with delta indicator

No new screen required. Slots into existing component structure.

---

## 7. Configuration

All tunable at runtime via `/mpc/config` PUT or environment variables:

| Variable | Default | Description |
|---|---|---|
| `MPC_ENABLED` | true | Enable/disable MPC (falls back to rule-based if false) |
| `MPC_INTERVAL_MS` | 30000 | Optimization cycle interval |
| `MPC_MAX_VALVE_STEP` | 10 | Max valve % change per cycle (rate limiter) |
| `MPC_VALVE_MIN` | 20 | Hard floor on valve open % |
| `MPC_ALPHA` | 1.0 | Pressure error cost weight |
| `MPC_BETA` | 0.1 | Valve movement penalty weight |
| `MPC_STALE_TIMEOUT_MS` | 60000 | Node excluded from optimization if silent >60s |

---

## 8. Scalability

| Dimension | How it scales |
|---|---|
| More nodes | Append to `nodes[]` array. Optimizer loop is O(N×iterations). Up to 20 nodes under 10ms. |
| New node type | Add telemetry fields; optimizer only requires `pressure_bar`, `valve_pct`, `setpoint_bar`, `elevation_m` |
| Different network topology | Update `k_elevation`, `k_resistance` constants per deployment |
| Real hydraulic model | Replace linear approximation in `computePressure()` with EPANET call — interface unchanged |

---

## 9. Demo Scenario (2-Node PoC)

| Step | What Happens | What Evaluator Sees |
|---|---|---|
| 1 | DMA-01 (low elevation) overpressure at 3.8 bar | Alert fires on dashboard |
| 2 | MPC cycle runs | Optimizer computes: close DMA-01 valve, open DMA-02 |
| 3 | Valve commands dispatched | Dashboard shows valve % animating |
| 4 | DMA-01 pressure drops to ~3.0 | DMA-02 pressure rises toward setpoint |
| 5 | Network cost value drops to near 0 | Both zones green |

**Demo trigger:** `/mpc/run` POST from dashboard "Optimize Now" button.

---

## 10. File Structure

```
backend/
  mpc/
    mpc-controller.js    ← pure optimizer, no dependencies
    mpc-service.js       ← runtime, scheduling, dispatch
    mpc-config.js        ← defaults and env var loading
  routes/
    mpc.routes.js        ← express router for /mpc/* endpoints
```

---

## 11. Acceptance Criteria

| # | Criteria |
|---|---|
| AC-01 | Optimizer returns valve commands for N nodes in <10ms for N≤8 |
| AC-02 | Adding a new node requires only appending to node registry — no code change |
| AC-03 | Node silent for >60s is excluded from optimization without crashing |
| AC-04 | Valve command never exceeds `max_valve_step` per cycle |
| AC-05 | Valve position never goes below `valve_min` or above `valve_max` |
| AC-06 | `/mpc/run` endpoint triggers immediate cycle and returns result synchronously |
| AC-07 | MPC disabled → system falls back to existing rule-based control silently |
| AC-08 | All config values updatable at runtime without restart |
