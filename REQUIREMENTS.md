# AquaBytes Frontend — Requirements

This document defines the frontend requirements for **AquaBytes**, a SCADA-style municipal water monitoring dashboard focused on DMA-zone pressure monitoring (Solapur Municipal use case).

## 1) Product Goal

- Provide a **control-center dashboard** for real-time visibility into pipeline pressure, valve positions, flow rates, and AI-based anomaly detection.
- Support **DMA zones** as the primary organizational unit for monitoring and alerting.

## 2) Users & Environment

- Primary users: municipal control center operators and supervisors.
- Operating context: large wall displays + operator workstations.
- UI theme: dark SCADA/industrial, data-dense, minimal spacing, thin borders, numeric values in monospace.

## 3) Functional Requirements

### 3.1 Map View (default)

Must provide an interactive map that displays:

- DMA zone polygons
- pipeline lines
- valve nodes
- leak/anomaly indicators

Interactions:

- clicking a valve opens a side inspector panel
- zoom controls
- layer toggles (pipelines / valves / zones)

Data-driven rendering:

- pipelines change color based on pressure status:
  - green = normal
  - amber = warning
  - red = critical
  - blue = low pressure
- leak indicators should appear for high anomaly confidence and have an animated pulse.

### 3.2 Overview Dashboard

Must provide:

- KPI cards
- zone status table
- pressure trend chart (24h)

KPI cards must include:

- Active zones
- Average pressure
- Critical zones
- Leaks detected
- Valve operations today

### 3.3 Zone Detail Page

Must provide per-zone detail:

- pressure gauge
- valve control slider
- 7-day pressure chart
- anomaly event log

### 3.4 Alerts Page

Must display alert cards with:

- severity
- zone
- message
- timestamp
- AI confidence

Must provide filters:

- All
- Critical
- Warning
- Resolved

Must provide actions:

- Acknowledge
- Dispatch
- Resolve

### 3.5 Analytics Page

Must provide:

- pressure heatmap (zones vs hours)
- flow vs pressure scatter plot
- leak probability trend

## 4) Data Requirements

### 4.1 Real-time telemetry (WebSocket)

- Frontend consumes real-time pressure updates via WebSocket.
- Example message shape:

```json
{
  "zoneId": "DMA-05",
  "pressure": 5.8,
  "valvePosition": 70,
  "flowRate": 42,
  "anomalyScore": 0.91
}
```

Frontend behavior:

- UI updates in real time when events arrive.
- Telemetry joins to DMA zones by `zoneId`.

### 4.2 Municipal GIS layers (GeoJSON)

- Zones, pipelines, and valves must be provided as GeoJSON.
- GeoJSON coordinates are expected as WGS84 `[lng, lat]`.
- Each feature should include stable IDs and join keys:
  - zones: `properties.zoneId` (or feature `id`)
  - pipelines: `properties.zoneId`
  - valves: `properties.zoneId`

If the municipal department data is not WGS84, it must be reprojected before use.

## 5) Non-Functional Requirements

- Performance: map should remain responsive under frequent telemetry updates.
- Reliability: UI must degrade gracefully when:
  - WebSocket disconnects
  - municipal GeoJSON fails to load
- Maintainability: reusable components, typed models, minimal coupling between view and data sources.
- Visual: dark industrial theme using specified palette and IBM Plex Sans/Mono.

## 6) Acceptance Criteria (MVP)

- App boots to Map View and renders a pipeline network with valves and zones.
- Clicking a valve shows a side inspector with zone name, pressure, valve position, flow rate, anomaly confidence.
- Layer toggles work for pipelines/valves/zones.
- UI shows live/offline status in top bar.
- Real-time event ingestion updates the map coloring and inspector values.
- Codebase follows the provided folder structure.
