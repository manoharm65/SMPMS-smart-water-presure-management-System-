Reading the skill file before writing the PRD.```markdown
# PRD — Illegal Water Extraction Detection System (IWEDS)
**Project:** AquaBytes ID3 — SMPMS Extension  
**Module:** Household Motor Detection  
**Version:** v1.0 — April 2026  
**Status:** Draft

---

## 1. Overview

IWEDS is a standalone detection module that identifies illegal booster motor usage at household connections by comparing actual drawn flow (measured at the household) against the theoretically permissible passive flow (derived from zone supply pressure at the nearest valve point). A significant positive delta between actual and theoretical flow is attributed to a booster motor illegally augmenting draw, starving other connections in the zone.

---

## 2. System Boundary

```
[Zone Valve Node]                    [Household Node]
  ESP32 (existing SMPMS)               ESP32 (new dedicated HW)
  └─ Pressure sensor (bar)             └─ Flow sensor (LPS)
       │                                     │
       └──────────── Backend API ────────────┘
                          │
                    Detection Engine
                          │
                    Webhook Dispatcher
```

IWEDS does **not** modify the existing SMPMS pipeline. It reads zone pressure from the existing TimescaleDB `pressure_readings` table and ingests household flow from a new dedicated endpoint.

---

## 3. Detection Algorithm

### 3.1 Theoretical Passive Flow Derivation

Using the orifice/Torricelli model for a household connection under gravity-fed pressure:

```
Q_theoretical = Cd × A × √(2 × P / ρ)
```

| Symbol | Description | Value |
|---|---|---|
| `Cd` | Discharge coefficient | 0.62 (standard for domestic inlet) |
| `A` | Cross-sectional area of pipe (m²) | Fixed per deployment — computed from known diameter |
| `P` | Supply pressure at nearest valve (Pa) | From `pressure_readings` (convert bar → Pa: ×100,000) |
| `ρ` | Water density (kg/m³) | 1000 |
| `Q_theoretical` | Maximum passive flow (m³/s → convert to LPS) | Output |

**Pipe diameter** is fixed per household and stored in the `household_connections` reference table (see §7.3). The area `A = π(d/2)²` is precomputed at registration time.

### 3.2 Excess Flow Computation

```
Q_excess = Q_actual − Q_theoretical
```

| Condition | Decision |
|---|---|
| `Q_excess ≤ 0` | NORMAL — passive draw within limits |
| `0 < Q_excess ≤ WARN_THRESHOLD` | SUSPECT — log, do not alert |
| `Q_excess > ALERT_THRESHOLD` | ILLEGAL — trigger webhook |

**Default thresholds (tunable per zone):**

| Parameter | Default Value | Notes |
|---|---|---|
| `WARN_THRESHOLD` | 0.08 LPS | ~5% above theoretical max for std ½" connection |
| `ALERT_THRESHOLD` | 0.15 LPS | Consistent with ~50W booster motor draw |
| `CONFIRM_WINDOW_SEC` | 120 | Excess must persist for 2 min before alert fires |
| `COOLDOWN_SEC` | 600 | Minimum gap between repeated alerts for same household |

The `CONFIRM_WINDOW_SEC` guard eliminates transient pressure dips (e.g., valve adjustment) triggering false positives.

### 3.3 Severity Scoring

```
severity_score = Q_excess / Q_theoretical   (clamped 0.0–1.0+)
```

| Range | Label |
|---|---|
| `< 0` | NORMAL |
| `0.00–0.20` | LOW |
| `0.20–0.50` | MEDIUM |
| `> 0.50` | HIGH |

Severity is included in the webhook payload but is not the primary alert gate.

---

## 4. ESP32 Firmware Specification (Household Node)

### 4.1 Responsibilities

- Read flow sensor at 1-second cadence.
- Compute 30-second rolling average (smooths pulse noise).
- POST averaged reading to backend `/api/v1/household/flow` every 30 seconds.
- Buffer up to 256 readings in EEPROM on connectivity loss; flush on reconnect.
- Transmit device health (WiFi RSSI, battery voltage if applicable) with each payload.

### 4.2 Firmware Payload Schema (ESP32 → Backend)

```json
{
  "household_id": "HH-DMA03-042",
  "dma_id": "DMA-03",
  "timestamp": "2026-04-10T09:15:00Z",
  "flow_rate_lps": 0.31,
  "signal_quality": "GOOD",
  "rssi_dbm": -67,
  "firmware_version": "iweds-hw-v1.0.2"
}
```

### 4.3 Firmware Behaviour Rules

| Condition | Action |
|---|---|
| Backend unreachable | Buffer to EEPROM, retry every 60s |
| Flow sensor out of range (< 0 or > 5 LPS) | Discard reading, set `signal_quality = "POOR"` |
| EEPROM buffer full (256 readings) | Drop oldest, continue buffering |
| HTTP 401 from backend | Clear stored API key, re-register via `/api/v1/device/register` |

### 4.4 Sensor Cadence

| Parameter | Value |
|---|---|
| Raw sample rate | 1 Hz |
| Rolling average window | 30 samples |
| Transmission interval | 30 seconds |
| EEPROM buffer depth | 256 readings |

---

## 5. Backend API Specification

Base URL: `/api/v1/iweds`

---

### 5.1 `POST /household/flow`
Ingest a household flow reading from ESP32.

**Request Body:**
```json
{
  "household_id": "HH-DMA03-042",
  "dma_id": "DMA-03",
  "timestamp": "2026-04-10T09:15:00Z",
  "flow_rate_lps": 0.31,
  "signal_quality": "GOOD",
  "rssi_dbm": -67,
  "firmware_version": "iweds-hw-v1.0.2"
}
```

**Response `200`:**
```json
{
  "status": "received",
  "detection_result": "NORMAL | SUSPECT | ILLEGAL",
  "severity": "LOW | MEDIUM | HIGH | null",
  "q_theoretical_lps": 0.18,
  "q_excess_lps": 0.13,
  "webhook_fired": false
}
```

**Processing steps (synchronous):**
1. Validate payload schema and bounds.
2. Fetch latest `pressure_bar` for `dma_id` from `pressure_readings` (last reading ≤ 60s old; else return `503 PRESSURE_STALE`).
3. Retrieve `pipe_area_m2` from `household_connections` for `household_id`.
4. Compute `Q_theoretical`, `Q_excess`, `severity_score`.
5. Persist to `household_flow_readings`.
6. Run confirm-window check against rolling buffer.
7. If ILLEGAL and confirm window met and cooldown elapsed → fire webhook, log to `illegal_extraction_events`.
8. Return result.

---

### 5.2 `POST /device/register`
Register a new household ESP32 node.

**Request Body:**
```json
{
  "household_id": "HH-DMA03-042",
  "dma_id": "DMA-03",
  "pipe_diameter_mm": 15,
  "address": "Plot 42, Sector 7, Solapur",
  "consumer_id": "SMC-CON-20934"
}
```

**Response `201`:**
```json
{
  "household_id": "HH-DMA03-042",
  "api_key": "<generated_key>",
  "pipe_area_m2": 0.000176715,
  "warn_threshold_lps": 0.08,
  "alert_threshold_lps": 0.15,
  "confirm_window_sec": 120
}
```

---

### 5.3 `GET /status/{household_id}`
Returns the current detection state for a household.

**Response `200`:**
```json
{
  "household_id": "HH-DMA03-042",
  "current_state": "NORMAL",
  "last_reading_at": "2026-04-10T09:15:00Z",
  "last_q_actual_lps": 0.19,
  "last_q_theoretical_lps": 0.18,
  "active_alert": false,
  "total_alerts_30d": 2
}
```

---

### 5.4 `GET /alerts`
List recent illegal extraction events.

**Query params:** `dma_id`, `from`, `to`, `severity`, `limit` (default 50)

**Response `200`:**
```json
{
  "total": 3,
  "alerts": [
    {
      "event_id": "uuid",
      "household_id": "HH-DMA03-042",
      "dma_id": "DMA-03",
      "onset_time": "2026-04-10T08:45:00Z",
      "q_excess_lps": 0.21,
      "severity": "HIGH",
      "webhook_fired": true,
      "resolved": false
    }
  ]
}
```

---

### 5.5 Webhook Payload (Outbound)

Fired to the configured webhook URL via `POST` on ILLEGAL confirmation.

```json
{
  "event": "ILLEGAL_EXTRACTION_DETECTED",
  "event_id": "uuid",
  "household_id": "HH-DMA03-042",
  "dma_id": "DMA-03",
  "consumer_id": "SMC-CON-20934",
  "address": "Plot 42, Sector 7, Solapur",
  "onset_time": "2026-04-10T08:45:00Z",
  "q_actual_lps": 0.39,
  "q_theoretical_lps": 0.18,
  "q_excess_lps": 0.21,
  "severity": "HIGH",
  "severity_score": 1.17,
  "supply_pressure_bar": 2.1,
  "confirm_duration_sec": 120,
  "zone_pressure_source": "DMA-03-VALVE-01",
  "webhook_version": "v1"
}
```

Webhook expects a `2xx` response within 5 seconds. On failure: retry 3× with exponential backoff (10s, 30s, 90s), then log as `WEBHOOK_FAILED`.

---

## 6. Data Schema

### 6.1 `household_flow_readings` (TimescaleDB Hypertable)

| Column | Type | Description |
|---|---|---|
| `time` | TIMESTAMPTZ PK | Reading timestamp |
| `household_id` | TEXT FK | Household reference |
| `dma_id` | TEXT FK | Zone reference |
| `flow_rate_lps` | FLOAT4 | Actual flow reported by ESP32 |
| `q_theoretical_lps` | FLOAT4 | Computed at ingest time |
| `q_excess_lps` | FLOAT4 | Computed delta |
| `detection_state` | TEXT | NORMAL / SUSPECT / ILLEGAL |
| `severity_score` | FLOAT4 | 0.0–1.0+ |
| `signal_quality` | TEXT | GOOD / POOR / LOST |
| `pressure_source_bar` | FLOAT4 | Zone pressure used for computation |

### 6.2 `household_connections` (Reference Table)

| Column | Type | Description |
|---|---|---|
| `household_id` | TEXT PK | Unique household node ID |
| `dma_id` | TEXT FK | Zone assignment |
| `consumer_id` | TEXT | SMC consumer number |
| `address` | TEXT | Physical address |
| `pipe_diameter_mm` | INT | Fixed inlet pipe diameter |
| `pipe_area_m2` | FLOAT8 | Precomputed: π(d/2)² |
| `warn_threshold_lps` | FLOAT4 | Per-household tunable |
| `alert_threshold_lps` | FLOAT4 | Per-household tunable |
| `confirm_window_sec` | INT | Confirm window |
| `cooldown_sec` | INT | Alert cooldown |
| `api_key_hash` | TEXT | Hashed ESP32 API key |
| `registered_at` | TIMESTAMPTZ | Registration time |
| `is_active` | BOOLEAN | Node active flag |

### 6.3 `illegal_extraction_events`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Event ID |
| `household_id` | TEXT FK | Source household |
| `dma_id` | TEXT | Zone |
| `onset_time` | TIMESTAMPTZ | When confirm window was first breached |
| `resolved_time` | TIMESTAMPTZ | NULL until manually resolved |
| `q_excess_lps` | FLOAT4 | Excess at detection |
| `severity` | TEXT | LOW / MEDIUM / HIGH |
| `severity_score` | FLOAT4 | Numeric score |
| `webhook_fired` | BOOLEAN | Delivery status |
| `webhook_attempts` | INT | Retry count |
| `resolved` | BOOLEAN | Manually cleared by operator |
| `notes` | TEXT | Field team notes |

---

## 7. Acceptance Criteria

| # | Criterion | Threshold |
|---|---|---|
| AC-01 | Detection latency (flow ingested → webhook fired) | ≤ confirm_window + 5s |
| AC-02 | False positive rate (confirmed benign events flagged) | ≤ 5% |
| AC-03 | Webhook delivery success rate | ≥ 99% (with retries) |
| AC-04 | ESP32 EEPROM buffer recovery on reconnect | 100% — zero reading loss |
| AC-05 | Backend availability | ≥ 99.5% uptime |
| AC-06 | Pressure staleness guard | Reject if zone pressure > 60s old |
| AC-07 | Throughput | ≥ 500 household nodes per zone without degradation |

---

## 8. Out of Scope (v1.0)

- ML-based motor classification (future: motor signature pattern from flow waveform)
- Integration into SMPMS dashboard UI
- Automated valve response to detected illegal extraction
- Legal/billing system integration
```