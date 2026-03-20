## Module: Valve Control
## File: src/modules/command/

---

## Purpose
Manage valve state per node, handle auto vs override modes,
dispatch commands to ESP, track command lifecycle, and
prevent conflicting commands.

---

## Valve State (per node, stored in nodes table)

{
  node_id: string,
  current_position: number,     // last known actual position %
  target_position: number,      // what backend wants it to be
  mode: "auto" | "override",
  last_command_id: string,
  last_updated: string
}

---

## Valve Modes

### Auto Mode
- Decision engine controls valve position.
- Every ACTION_DISPATCHED event triggers a command.
- No human confirmation needed.
- Override can interrupt at any time.

### Override Mode
- Set by operator via dashboard POST /valve endpoint.
- Decision engine still runs and logs recommendations.
- Decision engine does NOT dispatch commands while override is active.
- Override persists until:
  a) Operator clicks Revert to Auto, or
  b) CRITICAL anomaly detected — auto-revert to auto mode
     with alert sent to operator.

Auto-revert on CRITICAL is a safety rule:
  If mode is "override" AND new decision is CRITICAL,
  backend forces revert to auto, dispatches safety command,
  and sends Telegram alert:
  "⚠️ Manual override cancelled on DMA-XX — Critical pressure
  detected. System reverted to auto control."

---

## Command Lifecycle

States:
  PENDING → DISPATCHED → EXECUTED | FAILED | TIMEOUT

PENDING:   command created, waiting for next telemetry cycle
DISPATCHED: returned in telemetry response to ESP
EXECUTED:  ESP sent ACK with actual_position
FAILED:    ESP sent ACK with executed: false
TIMEOUT:   no ACK received within 3 telemetry cycles

Timeout logic:
  CommandService checks pending commands every 30 seconds.
  If command age > (3 * telemetry_interval_ms) with no ACK:
    → mark as TIMEOUT
    → emit ALERT_TRIGGERED with severity "warn"
    → message: "Valve command timeout on DMA-XX — no response
      from edge node"

---

## Command Queue

Only ONE command per node can be in PENDING or DISPATCHED
state at a time.

If a new command arrives while one is pending:
  → If new command is from CRITICAL decision: replace old command
  → If new command is from WARNING decision: queue, wait for ACK
  → If new command is manual override: replace old command always

Queue is per-node, stored in commands table.
CommandService checks queue on each telemetry cycle per node.

---

## Command Dispatch Flow

1. ACTION_DISPATCHED event received by CommandService
2. Check node mode:
   - If "override" and not CRITICAL: skip dispatch, log skipped
   - If "auto" or CRITICAL override: proceed
3. Check queue: is there already a PENDING command for this node?
   - Yes and not higher priority: skip
   - Yes and higher priority or manual: replace
4. Create command record (status: PENDING)
5. Command is returned to ESP on next telemetry POST response
6. Status updated to DISPATCHED
7. Await ACK from ESP
8. On ACK: update status, update current_position in nodes table

---

## Manual Override Dispatch Flow

1. POST /api/v1/dashboard/zones/:zoneId/valve received
2. Validate position (0–100)
3. Set node mode to "override"
4. Create command with priority: "manual"
5. Any existing PENDING command for this node is cancelled
6. New command immediately enters queue as PENDING
7. Dispatched on next telemetry cycle from this node
8. Response returned to dashboard immediately
   (do not wait for ESP ACK before responding)

---

## Revert to Auto Flow

1. POST /api/v1/dashboard/zones/:zoneId/valve/revert received
2. Set node mode to "auto"
3. No command dispatched — valve stays at current position
4. Decision engine resumes control on next telemetry cycle
5. If next decision is NORMAL, no action taken
6. If next decision is ACTION type, new command created normally

---

## Telegram Notifications for Valve Events

Send Telegram message for:
- CRITICAL command dispatched:
  "🔴 CRITICAL: Valve command sent to DMA-XX
   Action: REDUCE_FLOW → target 35%
   Pressure: 6.20 BAR"

- Command TIMEOUT:
  "⚠️ WARNING: Valve command timeout — DMA-XX not responding"

- Override auto-cancelled due to CRITICAL:
  "⚠️ Override cancelled on DMA-XX — auto control resumed"

- Manual override applied:
  "🔧 Manual override on DMA-XX — valve set to 50% by operator"

---

## Acceptance Criteria

- Auto mode dispatches commands from decision engine correctly
- Override mode blocks decision engine dispatch
- CRITICAL pressure auto-reverts override mode
- Command queue allows only one active command per node
- TIMEOUT detection works within 3 telemetry cycles
- All 4 Telegram notification types fire correctly
- ACK updates command status and node valve position
- Revert to auto leaves valve position unchanged