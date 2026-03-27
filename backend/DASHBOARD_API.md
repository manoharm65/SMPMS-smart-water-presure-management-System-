## Module: Dashboard API
## File: src/modules/api/

---

## Purpose
Serve all data the frontend needs across three screens:
Map View, Overview, and Zone Detail.
All endpoints are GET except manual valve override.
All responses use consistent field names matching frontend
data needs exactly.

---

## Base URL: /api/v1/dashboard

---

## Endpoints

---

### GET /api/v1/dashboard/zones
Used by: Map View (zone markers), Overview (zone table)

Response:
[
  {
    id: "DMA-01",
    name: string,
    lat: number,
    lng: number,
    pressure: number,         // BAR, 2dp
    valve_position: number,   // % integer
    ai_confidence: number,    // 0–100 integer (confidence * 100)
    status: "ok"|"warn"|"low"|"crit",
    trend: "up"|"down"|"stable",   // derived server-side
    last_reading: string      // "HH:MM"
  }
]

Trend logic (server-side):
  Compare latest pressure to reading from 15 min ago.
  > 0.2 BAR increase → "up"
  > 0.2 BAR decrease → "down"
  else → "stable"

---

### GET /api/v1/dashboard/kpi
Used by: Map View (KPI strip), Overview (KPI row)

Response:
{
  zones_online: number,       // count of nodes with recent data
  zones_total: number,        // always 8 for now
  avg_pressure: number,       // BAR, 2dp
  active_alerts: number,
  leaks_flagged: number,      // count of CRITICAL LOW decisions
  valve_ops: number           // count of commands dispatched today
}

zones_online: node is online if last telemetry < 5 min ago

---

### GET /api/v1/dashboard/alerts
Used by: Map View (active alerts panel), Overview

Response:
[
  {
    id: string,
    zone_id: string,
    zone_name: string,
    severity: "crit"|"warn"|"low",
    message: string,
    time: string              // "HH:MM"
  }
]

Returns only unresolved alerts, ordered by severity then time.
Limit: 10 most recent.

---

### GET /api/v1/dashboard/pressure-history/:zoneId
Used by: Overview (24H chart), Zone Detail (7-day chart)

Query params:
  ?range=24h   → hourly data points for last 24 hours
  ?range=7d    → daily average for last 7 days

Response (24h):
{
  zone_id: string,
  range: "24h",
  readings: [
    { label: "00:00", pressure: number },
    { label: "01:00", pressure: number },
    ...24 entries
  ]
}

Response (7d):
{
  zone_id: string,
  range: "7d",
  readings: [
    { label: "Mon", pressure: number },
    ...7 entries
  ]
}

If no real data exists for a time slot, fill with last known value.
Never return null for a pressure field — use 0.00 as fallback.

---

### GET /api/v1/dashboard/zones/:zoneId
Used by: Zone Detail hero section + stats grid

Response:
{
  id: string,
  name: string,
  pressure: number,
  min_today: number,
  max_today: number,
  avg_7d: number,
  valve_position: number,
  valve_mode: "auto"|"override",
  ai_confidence: number,        // 0–100 integer
  ai_recommendation: number,    // recommended valve % from decision engine
  ai_reason: string,
  last_reading: string          // "HH:MM:SS"
}

---

### GET /api/v1/dashboard/zones/:zoneId/anomalies
Used by: Zone Detail AI Anomaly Log panel

Response:
[
  {
    confidence: number,         // 0–100 integer
    severity: "crit"|"warn",
    message: string,
    model: string,              // "Rule Engine v1" now, "Isolation Forest + LSTM" later
    time: string                // "HH:MM"
  }
]

Limit: last 10 anomaly entries for this zone.
Only CRITICAL and WARNING entries qualify.

---

### POST /api/v1/dashboard/zones/:zoneId/valve
Used by: Zone Detail valve control — Apply Override button

Request body:
{
  position: number,    // 0–100 integer
  mode: "override"     // always "override" from this endpoint
}

Behavior:
1. Validate position is 0–100
2. Store command in commands table
3. Emit ACTION_DISPATCHED event immediately
4. CommandService dispatches to ESP
5. Update valve_mode to "override" for this node

Response:
{
  success: true,
  command_id: string,
  node_id: string,
  position: number,
  dispatched_at: string
}

---

### POST /api/v1/dashboard/zones/:zoneId/valve/revert
Used by: Zone Detail — Revert to Auto Mode button

Behavior:
1. Set valve_mode back to "auto" for this node
2. No command dispatched to ESP (auto mode means engine controls it)
3. Next decision cycle will take over

Response:
{ success: true, node_id: string, mode: "auto" }

---

## Response conventions matching frontend

- All pressure: float, 2 decimal places
- All valve positions: integer 0–100
- All confidence scores: integer 0–100 (multiply engine's 0.0–1.0 by 100)
- All timestamps: "HH:MM" or "HH:MM:SS" 24h
- Zone IDs: "DMA-01" through "DMA-08"
- Status/severity: lowercase strings only