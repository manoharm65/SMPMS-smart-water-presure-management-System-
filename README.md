# AquaBytes — SCADA IoT Monitoring Dashboard (Frontend)

AquaBytes is a SCADA-style, dark-theme React dashboard for monitoring municipal water pipeline pressure across multiple DMA zones with real-time IoT telemetry and AI anomaly detection.

## Tech Stack (and why)

- React + TypeScript: UI + strict typing for telemetry, map layers, and alerts.
- Vite: fast development server and production builds.
- TailwindCSS: dense SCADA-style layout, thin borders, glowing accents.
- React Router: page routing (`/`, `/overview`, `/alerts`, `/analytics`, `/zones/:zoneId`).
- React Query: server/state sync for fetch-based data (e.g., GeoJSON map layers, historical charts, alerts API).
- Zustand: in-memory operational store for high-frequency real-time telemetry (WebSocket events).
- Leaflet + React-Leaflet: interactive pipeline network map (zones, pipelines, valves, leak indicators).
- Recharts: charts (wired as dependency; page components are stubs to be completed next).

## Run Locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Configuration (Solapur map data + telemetry)

### Municipal map layers (GeoJSON)

By default, the app loads GeoJSON layers from:

- `/data/solapur/zones.geojson`
- `/data/solapur/pipelines.geojson`
- `/data/solapur/valves.geojson`

These are served from the `public/` directory. Replace the sample files with the real Solapur Municipal exports.

Supported geometry types:

- Zones: `Polygon` / `MultiPolygon`
- Pipelines: `LineString` / `MultiLineString`
- Valves: `Point`

Expected properties (best effort parsing is implemented):

- `zoneId` (preferred) or `dma` (used to join telemetry)
- `name` for labels (optional)
- `pipelineId` / `valveId` / `id` for stable feature IDs

Optional env overrides:

- `VITE_ZONES_GEOJSON_URL`
- `VITE_PIPELINES_GEOJSON_URL`
- `VITE_VALVES_GEOJSON_URL`
- or `VITE_MAP_DATA_BASE_URL` (prefix; defaults to `/data/solapur`)

### Real-time telemetry (WebSocket)

Set the WS endpoint:

- `VITE_WS_URL=ws://<host>:<port>/<path>`

If `VITE_WS_URL` is not set, the app uses a built-in mock stream so the UI still updates in real time.

Event shape consumed (example):

```json
{
  "zoneId": "DMA-05",
  "pressure": 5.8,
  "valvePosition": 70,
  "flowRate": 42,
  "anomalyScore": 0.91
}
```

## How the app works (real workflow)

### App shell

On startup, the app mounts:

- `src/main.tsx`: React Query provider + global CSS + Leaflet CSS.
- `src/App.tsx`: top-level layout (Topbar + Sidebar) and routes.

### Map View (default route: `/`)

The Map View is the operational SCADA screen:

1. `useMapData()` fetches municipal GeoJSON and hydrates the store with zones/pipelines/valves.
2. `connectPressureSocket()` connects to the WebSocket (or mock stream) and streams telemetry.
3. Each telemetry message updates the Zustand store (`upsertTelemetry`).
4. `PipelineMap` renders:
   - Zone polygons
   - Pipeline polylines (colored by computed pressure status)
   - Valve nodes (clickable)
   - Leak indicators (animated) when anomaly score is high
5. Clicking a valve updates `selectedValveId` and opens details in the inspector.

Pressure coloring logic:

- green: normal
- amber: warning
- red: critical
- blue: low pressure

### Overview (`/overview`)

This page is scaffolded for KPI cards + zone table + 24h trends. Components exist as stubs and will be connected to real APIs next.

### Zone Detail (`/zones/:zoneId`)

Scaffolded as a placeholder for a single DMA detail view (pressure gauge, valve control, 7-day chart, anomaly log).

### Alerts (`/alerts`)

Scaffolded placeholder for alert cards with filters and operator actions (ack/dispatch/resolve).

### Analytics (`/analytics`)

Scaffolded placeholder for heatmap/scatter/trend analytics.

## Project Structure

The codebase is organized by feature area:

- `src/components/layout`: Topbar, Sidebar, KPI bar
- `src/components/map`: Leaflet map + layer controls and primitives
- `src/components/dashboard`: overview widgets (stubs)
- `src/components/panels`: inspector/control panels
- `src/pages`: route-level screens
- `src/services`: API and WebSocket clients + map-data loader
- `src/hooks`: React Query hooks
- `src/store`: Zustand store for real-time telemetry + map layers

## Notes

- The Leaflet base map uses CARTO dark tiles via a public URL.
- GeoJSON coordinates must be WGS84 (`[lng, lat]`). If the municipal data is in a different projection, it must be reprojected before use.
