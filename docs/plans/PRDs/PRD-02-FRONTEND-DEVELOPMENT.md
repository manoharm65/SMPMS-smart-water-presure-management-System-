## Module: Frontend Development
## Owner: Frontend Team
## Phase: 2

---

## Purpose

Build the complete AquaBytes SCADA dashboard frontend per REQUIREMENTS.md.
The frontend currently has a modified MapView.tsx but lacks live data
connection, most pages, and real-time updates.

---

## Sub-Tasks

### 2.1 Map View Completion
- File: `frontend/src/pages/MapView.tsx`
- Render DMA zone polygons from GeoJSON (zones.json in src/data/)
- Render pipeline lines colored by pressure status (green/amber/red/blue)
- Render valve nodes as markers
- Leak indicators with animated pulse for CRITICAL LOW confidence > 0.85
- Side inspector panel on valve click: zone name, pressure, valve position,
  flow rate, anomaly confidence
- Layer toggles: pipelines / valves / zones checkboxes
- Zoom controls

### 2.2 Overview Dashboard
- File: `frontend/src/pages/Overview.tsx`
- KPI cards: Active zones, Average pressure, Critical zones, Leaks detected,
  Valve operations today
- Zone status table with: Zone ID, Pressure, Status, Trend, Last reading
- 24h pressure trend chart (use Recharts or similar)
- All data from GET /api/v1/dashboard/* endpoints

### 2.3 Zone Detail Page
- File: `frontend/src/pages/ZoneDetail.tsx`
- Pressure gauge visualization (semi-circle gauge)
- Valve control slider (0–100) with Apply / Revert to Auto buttons
- 7-day pressure chart
- AI Anomaly log panel (last 10 entries)
- Min/Max/Avg stats grid

### 2.4 Alerts Page
- File: `frontend/src/pages/Alerts.tsx`
- Alert cards: severity icon, zone, message, timestamp, AI confidence
- Filter tabs: All / Critical / Warning / Resolved
- Actions per card: Acknowledge, Dispatch, Resolve buttons
- Polling every 30s or WebSocket for real-time

### 2.5 Analytics Page
- File: `frontend/src/pages/Analytics.tsx`
- Pressure heatmap: zones (y-axis) vs hours of day (x-axis)
- Flow vs Pressure scatter plot
- Leak probability trend line chart

### 2.6 Real-Time Data Layer
- File: `frontend/src/services/api.ts`
- Axios instance with base URL: http://localhost:3000/api/v1
- JWT token attached to all protected requests
- API key attached for ESP endpoints (if used in browser)
- Polling service for dashboard endpoints (every 30s)
- WebSocket connection for real-time telemetry (if backend supports it)

### 2.7 GeoJSON Data
- Files: `frontend/src/data/zones.json`, `pipelines.json`, `valves.json`
- DMA zone polygons with zoneId, name, centroid lat/lng
- Pipeline polylines with zoneId
- Valve points with zoneId, position, status

---

## Acceptance Criteria

- [ ] Map View renders all 3 layers (zones, pipelines, valves) from GeoJSON
- [ ] Pipeline colors update based on pressure status
- [ ] Leak pulse animation triggers for CRITICAL LOW confidence > 0.85
- [ ] Clicking valve opens inspector with all 5 data fields
- [ ] Layer toggles show/hide each layer
- [ ] Overview KPI cards match exact field names from DASHBOARD_API.md
- [ ] Zone Detail pressure gauge is interactive and readable
- [ ] Valve slider sends POST /valve and shows current/target position
- [ ] Alerts page filter tabs work and actions dispatch correctly
- [ ] Analytics charts render with real data from API
- [ ] All pressure values show 2 decimal places
- [ ] All confidence scores shown as 0–100 integer
- [ ] Timestamps in HH:MM 24h format
- [ ] Dark SCADA industrial theme per REQUIREMENTS.md
- [ ] IBM Plex Sans + IBM Plex Mono fonts loaded

---

## Claude Code Usage Instructions

### Recommended Agent Strategy

1. **frontend-design skill** — Use BEFORE writing any UI code.
   Invoke with: /frontend-design
   This ensures production-grade frontend quality and design standards.

2. **Plan agent** — Use for complex pages (MapView, ZoneDetail).
   The map rendering with GeoJSON, layers, and inspector panel is non-trivial.
   Launch before starting 2.1 and 2.3.

3. **code-reviewer agent** — After each page is complete, review the
   component for quality, accessibility, and performance.

4. **e2e-runner agent** — After all pages are complete, generate and run
   E2E tests for critical user flows.

### Page Execution Order (Recommended)

  1. Start with 2.6 (API service layer) — all pages depend on it
  2. Then 2.1 (MapView) — most complex, establishes data flow
  3. Then 2.2 (Overview) — simplest dashboard page
  4. Then 2.3 (ZoneDetail) — valve control logic
  5. Then 2.4 (Alerts) — real-time updates
  6. Then 2.5 (Analytics) — charts
  7. Then 2.7 (GeoJSON) — if not already provided

### Critical Files (Read First)

- `frontend/src/pages/MapView.tsx` (current modified state)
- `frontend/src/App.tsx` (routing structure)
- `frontend/src/services/api.ts` (if exists)
- `frontend/src/data/` (check for existing GeoJSON)
- `REQUIREMENTS.md` (full requirements reference)
- `backend/DASHBOARD_API.md` (exact API response shapes)
- `backend/DECISION_ENGINE.md` (confidence/risk level meanings)

### Component Libraries

- Use React Leaflet for map rendering (or Mapbox GL if API key available)
- Use Recharts for all charts (pressure trends, scatter, heatmap)
- Use Tailwind CSS for styling (dark SCADA theme)
- DO NOT use UI component libraries (Material UI, AntD) — custom industrial look

### Real-Time Updates

- If backend adds WebSocket: use Socket.io client
- If polling only: use setInterval with 30s cycle in a React hook
- Always show "LIVE" or "OFFLINE" indicator in top bar

### Dark SCADA Theme Colors

```
Background: #0a0a0f
Card background: #12131a
Border: #1e1f2e
Text primary: #e8e8f0
Text secondary: #8888a0
Accent blue: #3b82f6
Status green: #22c55e
Status amber: #f59e0b
Status red: #ef4444
Status blue (low): #3b82f6
Font: IBM Plex Sans, IBM Plex Mono (Google Fonts)
```