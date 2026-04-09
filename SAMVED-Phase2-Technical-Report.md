# SAMVED 2026 - Phase 2 Prototype Development Submission

---

## Technical Report

---

## Problem Recap & SMC Context

### Problem Title

**Smart Water Pressure Management System (SMPMS)**

### Brief Problem Description

A real-time SCADA-style dashboard for monitoring and controlling water pressure across DMA (District Metered Area) zones in municipal water distribution networks. The system provides control center operators with live visibility into pipeline pressure, valve positions, flow rates, and AI-based anomaly/leak detection.

### Current Challenges in SMC Related to This Problem

- Manual, periodic monitoring of water pressure instead of continuous real-time surveillance
- No automated anomaly or leak detection mechanism
- Delay in identifying pressure drops, leaks, and equipment failures
- Lack of centralized data visualization for control room operators
- No remote valve control capability for quick response

### Objectives & Implementation Mapping

| Objective | Implemented (Yes/No) | Evidence (Module Names) |
|-----------|---------------------|------------------------|
| Real-time pressure monitoring | Yes | Overview.tsx, PressureChart.tsx, API polling (30s interval) |
| Interactive map visualization | Yes | MapView.tsx, PipelineMap.tsx, ZonePolygon.tsx |
| AI-based anomaly detection | Yes | ZoneDetail.tsx (Isolation Forest + LSTM), Analytics.tsx |
| Remote valve control | Yes | ValveControl.tsx, setValvePosition API |
| Alert management system | Yes | Alerts.tsx, AlertTicker.tsx |
| Analytics & pattern analysis | Yes | Analytics.tsx (heatmap, scatter, bar charts) |
| Multi-zone DMA support | Yes | ZoneDetail.tsx, ZoneTable.tsx |

### Constraints & Handling Mapping

| Constraint Type | How Addressed |
|-----------------|---------------|
| Technical | React 19 with TypeScript provides type-safe, maintainable codebase |
| Operational | 30-second polling balance between real-time updates and server load |
| Financial | Uses open-source technologies (MongoDB Atlas free tier, Express.js) |
| Performance | Vite build tool ensures fast frontend bundling and HMR |

---

## System Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Home   │ │ MapView │ │Overview │ │ Alerts  │ │Analytics│   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       └────────────┴───────────┴───────────┴───────────┘        │
│                         │                                      │
│  ┌──────────────────────┴───────────────────────────────────┐   │
│  │         State Management (Zustand 5.0.11)                 │   │
│  │              API Services (api.ts)                         │   │
│  └──────────────────────┬───────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │ REST API / HTTP
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Backend (Express.js 5.1 + Node.js)              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  /api/auth   │  │ /api/v1/      │  │    MongoDB         │    │
│  │ (JWT Login)  │  │ dashboard/*   │  │  (Mongoose ODM)   │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │     MongoDB Atlas     │
              │  (Users, Zones,      │
              │   Alerts, Telemetry) │
              └───────────────────────┘
```

### System Overview

#### Data Flow

```
ESP32 Sensors → Backend API → MongoDB → REST API → Frontend Dashboard
                                         ↑
                                  WebSocket / Polling
                                         ↑
                              Client Browser (30s polling)
```

#### User Flow

1. User logs in via `/login` (JWT authentication)
2. Dashboard loads with map view showing DMA zones
3. Real-time telemetry updates every 30 seconds
4. Clicking a valve opens ZoneInspector panel
5. Alerts appear in header ticker and Alerts page
6. Operators can override valve positions remotely
7. Analytics page shows historical patterns and trends

### Key Components

| Component | Technology | Description |
|-----------|-----------|-------------|
| PipelineMap | React-Leaflet | Interactive map rendering pipelines, valves, zones |
| ZoneInspector | React + Zustand | Side panel showing selected zone details |
| PressureChart | Chart.js 4.5.1 | Line chart for 24h/7d pressure history |
| AlertTicker | React | Scrolling alert notifications in topbar |
| ValveControl | React | Slider and presets for remote valve control |

---

## Subsystems

| Subsystem Name | Function | Input | Output | Technology Used |
|----------------|----------|-------|--------|-----------------|
| **Frontend UI** | Dashboard rendering, user interaction | API responses, user actions | Visual display, API calls | React 19, TypeScript, Tailwind CSS |
| **Map Visualization** | Render GIS layers (pipelines, valves, zones) | GeoJSON files | Interactive map with clickable features | React-Leaflet 5.0, Leaflet.js 1.9.4 |
| **State Management** | Global app state (auth, selected zone, alerts) | API data, user actions | Reactive UI updates | Zustand 5.0.11 |
| **Charting & Analytics** | Pressure trends, heatmaps, scatter plots | Historical pressure data | Visual analytics | Chart.js 4.5.1 |
| **Authentication** | User login, JWT session management | Credentials | Auth token, protected routes | JWT 9.0.2, bcryptjs 3.0.2 |
| **REST API** | Data CRUD, valve commands | API requests | JSON responses | Express.js 5.1.0 |
| **Database** | Persistent storage for users, zones, alerts | Mongoose operations | Data retrieval | MongoDB Atlas + Mongoose 8.19.0 |

### Subsystem Interaction Matrix

| Subsystem A | Subsystem B | Interaction Type | Description |
|-------------|-------------|-----------------|-------------|
| Frontend UI | REST API | Data/API | GET/POST requests for zones, alerts, KPI |
| Frontend UI | Map Visualization | Control/Data | Passes selected zone to inspector |
| State Management | REST API | Data | Caches API responses in Zustand store |
| REST API | Database | Data | MongoDB queries via Mongoose ODM |
| Authentication | REST API | Control | JWT middleware protects API routes |
| Charting | REST API | Data | Fetches pressure history for charts |

---

## Prototype Description

### Workflow: Step-by-Step Explanation

#### Step 1: User Authentication
- User navigates to `/login`
- Enters credentials (username/password)
- Backend validates and returns JWT token
- Frontend stores token in Zustand auth store
- Subsequent API calls include Bearer token

#### Step 2: Dashboard Overview (Home)
- User sees KPI cards: Zones Online, Avg Pressure, Active Alerts, Leaks Flagged, Valve Ops
- Zone table shows all DMA zones with live pressure, valve %, status, AI confidence
- 24h pressure chart renders for selected zone

#### Step 3: Interactive Map View
- Map renders DMA zone polygons from GeoJSON
- Pipeline lines show pressure status (green=normal, amber=warning, red=critical)
- Valve nodes are clickable markers
- Layer toggles for pipelines/valves/zones

#### Step 4: Zone Inspection
- Clicking a valve opens ZoneInspector side panel
- Shows: Zone name, live pressure, valve position, flow rate, anomaly score
- Option to open full ZoneDetail page

#### Step 5: Zone Detail Page
- Giant pressure display with live value
- 6-stat grid: Min/Max/Avg pressure, Valve %, AI confidence, Last reading
- Valve control slider with preset buttons (18%, 35%, 50%, 70%)
- AI anomaly log with Isolation Forest + LSTM detection
- 7-day pressure history chart

#### Step 6: Alert Management
- Alerts page shows all unacknowledged alerts
- Filter by: All, Critical, Warning, Resolved
- Each alert shows severity bar, zone, message, timestamp
- Actions: Acknowledge, Valve Control
- Valve control panel allows override/revert to auto

#### Step 7: Analytics Page
- Bar chart: Pressure by zone
- Scatter plot: Valve position vs Pressure correlation
- Heatmap: Zone pressure over 24 hours
- Pattern analysis table: Morning peak, Night flow anomaly, etc.

---

## Technology Stack & Tools

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | React 19.2.4 | Modern React with concurrent features |
| | TypeScript 5.9 | Type safety for complex data models |
| | Tailwind CSS 3.4.17 | Utility-first responsive styling |
| | Chart.js 4.5.1 | Flexible charting library |
| | React-Leaflet 5.0 | Interactive map component |
| | Zustand 5.0.11 | Lightweight state management |
| | React Router 7.13 | Client-side routing |
| | Vite 8.0 | Fast build tool |
| **Backend** | Express.js 5.1 | Minimal, flexible Node.js framework |
| | Node.js | Server-side JavaScript runtime |
| | Mongoose 8.19 | MongoDB object modeling |
| | JWT 9.0.2 | Stateless authentication |
| | bcryptjs 3.0.2 | Secure password hashing |
| | CORS 2.8.5 | Cross-origin resource sharing |
| **Database** | MongoDB Atlas | Cloud-hosted NoSQL database |
| | Mongoose ODM | Schema-based data modeling |
| **Tools** | ESLint 9.39 | Code linting |
| | PostCSS 8.5 | CSS processing |
| | concurrently 9.2 | Run frontend + backend simultaneously |

---

## Innovation Highlights

### What is New in Your Solution?

1. **Real-time WebSocket/Pollin Telemetry** - 30-second polling for live pressure updates across all DMA zones
2. **AI Anomaly Detection** - Combines Isolation Forest (statistical) + LSTM (deep learning) for leak detection
3. **Interactive GIS Visualization** - Leaflet-based map with dynamic pipeline coloring based on pressure status
4. **Remote Valve Control** - Operators can override valve positions directly from the dashboard
5. **Pattern Analysis** - Automated detection of recurring issues (Morning Peak Surge, Night Flow Anomaly)

### How is it Better Than Existing Approaches?

| Approach | Traditional SCADA | Manual Inspection | Spreadsheet-based |
|----------|------------------|-------------------|-------------------|
| SMPMS Advantage | AI-driven anomaly detection, web-based UI | 24/7 automated monitoring | Centralized multi-user access |

### AI / Data-Driven Innovation

- Anomaly score calculation combining Isolation Forest + LSTM models
- Pressure threshold alerts (normal >5.5 BAR = critical)
- AI valve position recommendations based on historical patterns
- 7-day rolling average pressure calculations

---

## Results / Demonstration

### Sample Outputs

- **Dashboard**: KPI cards with live data (Zones Online: 2/6, Avg Pressure: 4.6 BAR, Active Alerts, Leaks Flagged, Valve Ops)
- **Map View**: Pipeline network with color-coded pressure zones (green=normal, amber=warning, red=critical, blue=low)
- **ZoneDetail**: Pressure gauge with 7-day chart, valve control panel
- **Analytics**: Pressure heatmap, scatter plot (valve vs pressure), bar chart

### Screenshots (To be included)

1. Home/Dashboard Overview
2. Map View with pipelines and zones
3. Zone Detail with valve control
4. Alerts page
5. Analytics page

### Metrics

| Metric | Value |
|--------|-------|
| Telemetry polling interval | 30 seconds |
| Supported DMA zones | 6 zones |
| Pressure measurement range | 0-8 BAR |
| Alert response time | Real-time (polling-based) |
| Valve control precision | 1% increments |
| API response format | JSON REST |

---

## Reproducibility & Code Access

### GitHub Repository

**URL**: https://github.com/manoharm65/SMPMS-smart-water-presure-management-System-

### Steps to Run the System

```bash
# 1. Clone the repository
git clone https://github.com/manoharm65/SMPMS-smart-water-presure-management-System-.git
cd SMPMS-smart-water-presure-management-System-

# 2. Install dependencies
npm install

# 3. Setup environment variables
# Copy backend/src/.env.example to backend/src/.env
# Configure MONGODB_URI and other variables

# 4. Start frontend (development)
npm run dev

# 5. Start backend (separate terminal)
npm run dev:server

# 6. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
```

### Dependencies / Requirements

- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- npm 9+

---

## SMC Impact Assessment

### Proposed Impact Areas

| Impact Area | Current State | Proposed Improvement | Expected Benefit |
|-------------|---------------|---------------------|------------------|
| **Leak Detection** | Manual inspection, delayed response | Real-time AI anomaly detection | 50% faster leak identification |
| **Pressure Monitoring** | Periodic manual readings | Continuous automated monitoring | 24/7 surveillance without human presence |
| **Valve Operations** | Physical on-site adjustments | Remote override from control room | Reduced travel time, faster response |
| **Data Visibility** | Fragmented spreadsheets | Centralized real-time dashboard | Single source of truth for operators |
| **Maintenance Planning** | Reactive, after failure | Proactive, based on pattern analysis | Reduced equipment failures |

---

## Limitations & Future Scope

### Current Limitations

- Polling-based updates (30s interval) instead of true WebSocket real-time
- Simulated AI models (no actual ESP32 hardware integration yet)
- Limited to Solapur municipal area test data
- No mobile-responsive design optimization
- No offline mode or data caching

### Assumptions Made

- MongoDB Atlas cloud database is available
- ESP32 sensors will push data to the backend API
- Users have modern browsers with JavaScript enabled
- Municipal operators have basic computer literacy

### Possible Future Improvements

- Implement WebSocket for true real-time push updates
- Add SMS/email alert notifications
- Develop mobile companion app
- Integrate with actual SCADA hardware (Modbus protocol)
- Add predictive maintenance using LSTM forecasting
- Implement role-based access control (RBAC)
- Add data export and report generation

---

## Team Information

### Team Details

| Field | Value |
|-------|-------|
| Team Name | |
| Institute Code | |
| Institute Name | |
| City | |
| State | |

### Team Leader Information

| Field | Value |
|-------|-------|
| Leader Name | |
| Contact Number | |
| Email | |

### Mentor Details

| Field | Value |
|-------|-------|
| Mentor Name | |
| Contact Number | |
| Email | |

### Participant Details

| SN | Participant Name | Program | Semester | Contact Number | Email |
|----|------------------|---------|----------|----------------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

---

## Declaration

We hereby declare that the work titled **"Smart Water Pressure Management System (SMPMS)"** submitted for SAMVED-2026 is the original outcome of our team's efforts. The work has been carried out by us under the guidance of the undersigned mentor and is neither copied from any source nor generated using artificial intelligence (AI) tools.

**Place**: __________________________

**Date**: __________________________

&nbsp;

Team Leader Name: __________________________

&nbsp;

Mentor Name: __________________________

---

*Note: The above details will be used for certificate generation. Please ensure accuracy.*
