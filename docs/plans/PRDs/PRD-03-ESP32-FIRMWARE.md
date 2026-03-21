## Module: ESP32 Firmware
## Owner: Embedded Team
## Phase: 3

---

## Purpose

Implement ESP32 firmware that communicates with the backend per the
ESP_NODE_CONTROL.md protocol. The firmware handles sensor reading,
valve control, offline fallback, and buffered sync.

---

## Sub-Tasks

### 3.1 Boot Registration
- On startup, POST /api/v1/nodes/register with node_id, firmware_version, ip_address
- Store returned telemetry_interval_ms and pressure_thresholds in EEPROM/FLASH
- If registration fails, retry with exponential backoff (1s, 2s, 4s, max 30s)
- Store API key locally after successful registration

### 3.2 Telemetry Loop
- Read pressure sensor (analog or digital sensor per hardware)
- Read valve position from servo feedback
- POST /api/v1/telemetry every telemetry_interval_ms (default 10s)
- Include node_id, pressure (2dp), valve_position, timestamp
- Check response.command — if not null, execute SET_VALVE

### 3.3 Command Execution (SET_VALVE)
- Parse command.value (0–100 target position)
- Move servo to target position
- Wait for servo feedback or timeout (5s max)
- POST /api/v1/commands/:commandId/ack with executed flag,
  actual_position, timestamp
- If command fails, still ACK with executed: false

### 3.4 Offline Fallback Mode
- If POST /telemetry fails (connection error or 503):
  - Switch to offline mode
  - Use locally stored pressure thresholds
  - Apply local rule: if pressure > critical_high → close valve 20%
  - If pressure < critical_low → open valve 20%, else hold
  - Buffer readings in RAM (max 50 readings, FIFO)
- Reconnect every 30s to attempt registration/telemetry

### 3.5 Buffered Sync on Reconnect
- On successful reconnect, POST /api/v1/telemetry/sync
- Send all buffered readings as array
- Clear buffer after successful sync
- Resume normal telemetry loop

### 3.6 Watchdog & Stability
- Implement hardware watchdog timer (WDT) reset
- If node_id or API key missing after boot → halt and blink error LED
- Log all state transitions (boot, online, offline, command exec) to serial

---

## Hardware Assumptions

- ESP32 (WiFi capable)
- Pressure sensor: analog 0–5V mapped to 0–20 BAR
- Servo: PWM controlled, 0–100% position feedback
- Status LED: built-in or external (blue=online, red=error, amber=offline)

---

## Acceptance Criteria

- [ ] Node registers and receives config on every cold boot
- [ ] Telemetry sent exactly every telemetry_interval_ms
- [ ] SET_VALVE command executes within 5s or times out
- [ ] ACK posted to backend after every command execution
- [ ] Offline mode activates within 10s of losing backend connection
- [ ] Offline mode applies local threshold rules correctly
- [ ] Buffered readings sync on reconnect (up to 50 readings)
- [ ] Watchdog prevents indefinite hangs
- [ ] No hardcoded credentials — all from registration response or EEPROM

---

## Claude Code Usage Instructions

### Important Note

Claude Code is a web/TypeScript/JavaScript focused tool. ESP32 firmware
is typically written in C/C++ using PlatformIO or Arduino IDE.
This PRD is primarily for HUMAN developers to implement.

### Claude Code's Role for ESP32

1. **code-reviewer agent** — After firmware code is written, use to review
   for common embedded pitfalls (buffer overflows, watchdog handling,
   network timeout logic, memory management).

2. **Plan agent** — If you need help designing the state machine for
   offline/online transitions, use to model the logic.

3. **For the backend side** — Claude Code CAN help verify the ESP-facing
   API endpoints work correctly using the e2e-runner agent or manual
   API testing with curl/Postman.

### What Claude Code CAN Help With (Backend Verification)

- Writing integration tests for POST /telemetry, POST /telemetry/sync,
  POST /commands/:id/ack using Supertest
- Verifying the piggyback response format matches ESP expectations
- Adding the buffered sync endpoint tests
- Reviewing backend timeout handling for ESP connection scenarios

### Critical Files (Read First)

- `backend/ESP_NODE_CONTROL.md` (full protocol spec — the firmware dev's bible)
- `backend/src/modules/telemetry/telemetry.service.ts` (createForEsp, syncBuffered)
- `backend/src/modules/command/command.service.ts` (ACK handling)
- `backend/src/modules/node/node.service.ts` (registration response)

### Testing the ESP Protocol (Backend-Side)

Use the e2e-runner agent or manual testing to:
- Simulate ESP registration and verify correct config response
- Simulate telemetry POST and verify command piggyback
- Simulate command ACK and verify DB update
- Simulate bulk sync and verify all readings stored