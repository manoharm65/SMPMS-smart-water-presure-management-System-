## Module: ESP Node Protocol
## File: src/modules/telemetry/ (additions) + src/modules/command/

---

## Purpose
Define the exact REST contract between the ESP32 edge nodes
and the backend. This PRD is also the spec the ESP firmware
developer follows.

---

## Node Identity

Each ESP node has:
- node_id: "DMA-01" through "DMA-08" (hardcoded in firmware)
- api_key: generated at seed time, stored in nodes table
  Used as Bearer token for all ESP requests.

Header for all ESP requests:
  Authorization: Bearer <api_key>

---

## ESP → Backend (Data Push)

### POST /api/v1/telemetry

Called by: ESP every N seconds (configurable, default 10s)

Request body:
{
  node_id: string,
  pressure: number,       // BAR, float, 2dp
  valve_position: number, // current servo position %, integer
  timestamp: string       // ISO8601 or epoch ms
}

Success Response (200):
{
  received: true,
  command: null | {
    command_id: string,
    type: "SET_VALVE",
    value: number         // target valve position %
  }
}

The command field is the key design decision here:
Backend piggybacks any pending command onto the telemetry
response. ESP checks this field after every POST.
If command is not null, ESP executes immediately.
This avoids needing a separate polling endpoint.

Error Responses:
  401 → invalid api_key
  400 → malformed payload
  503 → backend not ready

---

## ESP → Backend (Startup Registration)

### POST /api/v1/nodes/register

Called by: ESP on boot, before starting telemetry loop.

Request body:
{
  node_id: string,
  firmware_version: string,   // "1.0.0"
  ip_address: string
}

Response:
{
  registered: true,
  node_id: string,
  telemetry_interval_ms: number,    // backend tells ESP how often to push
  pressure_thresholds: {
    critical_high: number,
    warning_high: number,
    normal_low: number,
    critical_low: number
  }
}

This allows backend to push config to ESP at boot.
ESP stores thresholds locally as fallback rule for
offline operation.

---

## ESP → Backend (Command Acknowledgement)

### POST /api/v1/commands/:commandId/ack

Called by: ESP after executing a valve command.

Request body:
{
  node_id: string,
  executed: boolean,
  actual_position: number,    // what servo actually moved to
  timestamp: string
}

Response:
{ acknowledged: true }

Backend updates command status to "executed" or "failed".

---

## Backend → ESP (Command Piggyback)

No separate push endpoint needed.
Commands are returned in the telemetry POST response.
ESP must check response.command on every telemetry push.

Command structure:
{
  command_id: string,
  type: "SET_VALVE",
  value: number           // target position %
}

Only one pending command returned at a time.
Backend queues multiple commands and serves them one per
telemetry cycle.

---

## ESP Fallback Behavior (offline mode)

When backend is unreachable:
1. ESP uses locally stored thresholds from registration response.
2. Applies local rule:
   pressure > critical_high → close valve 20%
   pressure < critical_low  → open valve 20%
   else → hold position
3. Buffers telemetry readings in local memory (max 50 readings).
4. On reconnect, flushes buffer via:

### POST /api/v1/telemetry/sync

Request body:
{
  node_id: string,
  readings: [
    { pressure, valve_position, timestamp },
    ...
  ]
}

Response:
{ synced: number }    // count of readings accepted

---

## Node Status Tracking

Backend considers a node OFFLINE if no telemetry received
for more than 2x telemetry_interval_ms.

Node status stored in nodes table:
  status: "online" | "offline" | "degraded"
  last_seen: timestamp

GET /api/v1/nodes reflects this status.
Dashboard zones_online KPI derived from this.