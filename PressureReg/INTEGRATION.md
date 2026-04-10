# MPC Integration Guide
**AquaBytes ID3 — Wiring MPC into the Existing Node.js Backend**

---

## Step 1 — Copy the module

```
backend/
  mpc/
    mpc-controller.js   ← optimizer core
    mpc-service.js      ← runtime + registry
    mpc-config.js       ← defaults
  routes/
    mpc.routes.js       ← express endpoints
```

No npm install required. Pure Node.js, zero external dependencies.

---

## Step 2 — Start the service in your app entry point

In `server.js` or `app.js`, add:

```js
const mpcService = require('./mpc/mpc-service');

// After DB/MQTT init, before listening:
mpcService.start();
```

---

## Step 3 — Mount the router

```js
const mpcRoutes = require('./routes/mpc.routes');
app.use('/mpc', mpcRoutes);
```

---

## Step 4 — Feed telemetry into the node registry

In your existing telemetry POST handler, add one line:

```js
// existing handler (simplified):
app.post('/telemetry', async (req, res) => {
  const data = req.body;

  // --- EXISTING LOGIC (unchanged) ---
  await db.insertReading(data);
  mqttClient.publish('telemetry', JSON.stringify(data));

  // --- ADD THIS LINE ---
  mpcService.updateNodeState({
    id:               data.dma_id,          // your field name may differ
    pressure_bar:     data.pressure_bar,
    flow_lps:         data.flow_rate_lps,
    valve_pct:        data.valve_position_pct,
    elevation_m:      data.elevation_m      || getElevationForZone(data.dma_id),
    setpoint_bar:     data.setpoint_bar     || getSetpointForZone(data.dma_id),
    min_pressure_bar: data.min_pressure_bar || 1.5,
    max_pressure_bar: data.max_pressure_bar || 5.5,
  }, req.ip);   // pass IP for valve command dispatch

  res.json({ ok: true });
});
```

`getElevationForZone()` and `getSetpointForZone()` — look these up from your
zone config / DB. For the 2-node PoC, hardcode them:

```js
const ZONE_CONFIG = {
  'DMA-01': { elevation_m: 10,  setpoint_bar: 3.0 },
  'DMA-02': { elevation_m: 45,  setpoint_bar: 2.5 },
};
```

---

## Step 5 — Receive valve commands on ESP32

Your ESP32 firmware already has a `/command` endpoint from the existing
valve control work. Confirm it accepts:

```json
POST /command
{ "valve_target_pct": 65 }
```

If your field name is different (e.g. `valveTarget`), update `dispatchCommand()`
in `mpc-service.js` line ~60 to match.

---

## Step 6 — Dashboard integration (minimal)

Add to your existing Overview screen state fetch:

```js
// Poll MPC status every 10s
const mpcStatus = await fetch('/mpc/status').then(r => r.json());
```

Show in the existing DMA card:

```jsx
<span>MPC: {mpcStatus.last_cycle?.commands
  .find(c => c.id === dma.id)?.valve_target_pct ?? '—'}%</span>
```

For the demo "Optimize Now" button in Zone Detail:

```js
await fetch('/mpc/run', { method: 'POST' });
```

---

## Step 7 — Verify it works (2-node smoke test)

```bash
# 1. Start your backend normally

# 2. POST two fake telemetry readings to register nodes
curl -X POST http://localhost:3000/telemetry \
  -H "Content-Type: application/json" \
  -d '{"dma_id":"DMA-01","pressure_bar":3.8,"flow_rate_lps":12,"valve_position_pct":75}'

curl -X POST http://localhost:3000/telemetry \
  -H "Content-Type: application/json" \
  -d '{"dma_id":"DMA-02","pressure_bar":1.4,"flow_rate_lps":4,"valve_position_pct":60}'

# 3. Trigger MPC immediately
curl -X POST http://localhost:3000/mpc/run

# Expected response:
# {
#   "commands": [
#     { "id": "DMA-01", "valve_target_pct": 65, "delta_pct": -10, "reason": "overpressure" },
#     { "id": "DMA-02", "valve_target_pct": 70, "delta_pct": +10, "reason": "underpressure" }
#   ],
#   "converged": true,
#   "cost": 0.034,
#   "cycle_ms": 3
# }

# 4. Check node registry
curl http://localhost:3000/mpc/nodes
```

---

## Field Name Mapping

If your telemetry payload uses different field names, update the mapping
in Step 4. Common mismatches:

| MPC expects | Your system might use |
|---|---|
| `dma_id` | `nodeId`, `zone_id`, `id` |
| `pressure_bar` | `pressure`, `pressureBar` |
| `flow_rate_lps` | `flowRate`, `flow` |
| `valve_position_pct` | `valvePosition`, `valve_pct` |

---

## Environment Variables (optional)

Add to your `.env`:

```
MPC_ENABLED=true
MPC_INTERVAL_MS=30000
MPC_MAX_VALVE_STEP=10
MPC_VALVE_MIN=20
MPC_ALPHA=1.0
MPC_BETA=0.1
MPC_STALE_TIMEOUT_MS=60000
```
