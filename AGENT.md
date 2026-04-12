# SMPMS - Smart Municipal Pressure Management System

## Project Overview

SMPMS is a real-time pressure monitoring and control system for municipal water networks. It integrates ESP32 hardware nodes with a React frontend and Express backend to provide:

- **Real-time telemetry** from pressure sensors and flow meters
- **Model Predictive Control (MPC)** for optimized pressure management
- **Leak detection** via anomaly analysis
- **IWEDS** (Intelligent Water Event Detection System) for smart monitoring
- **Manual control** via a Control Center dashboard

## Architecture

```
┌─────────────────┐     ┌─────────────┐     ┌────────────────┐
│   ESP32 Nodes   │────▶│   Backend   │────▶│    Frontend    │
│  (valve_1, etc) │     │  (Express)  │     │   (React)      │
└─────────────────┘     └─────────────┘     └────────────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
               ┌────▼────┐ ┌───▼───┐ ┌───▼───┐
               │   MPC   │ │ IWEDS │ │ Leak  │
               │ Service │ │ Service│ │Detection│
               └─────────┘ └───────┘ └───────┘
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand, Chart.js
- **Backend**: Node.js, Express, TypeScript
- **Hardware**: ESP32 (Arduino), pressure sensors, servo valves, flow sensors

## Key Components

### Frontend Pages
- `/` - Home dashboard
- `/map` - Geographic map view
- `/overview` - All DMA zones with KPIs
- `/alerts` - System alerts
- `/ml-simulation` - ML anomaly simulation
- `/model-hub` - MPC, Leak Detection, IWEDS tabs
- `/control` - Manual valve control

### Backend Modules
- `src/modules/telemetry/` - ESP32 telemetry ingestion
- `src/modules/mpc/` - Model Predictive Control
- `src/modules/integration/` - IWEDS orchestration
- `src/modules/esp/` - ESP32 registration and commands
- `src/repositories/` - In-memory data stores

## Hardware Configuration

### ESP32 Pinout (esp32.ino)
```
PRESSURE_SENSOR_PIN  = GPIO 36 (ADC)
SERVO_CONTROL_PIN   = GPIO 14
SERVO_FEEDBACK_PIN   = GPIO 35
FLOW_SENSOR_PIN     = GPIO 34 (optional)
STATUS_LED_BLUE     = GPIO 2
STATUS_LED_RED      = GPIO 4
STATUS_LED_AMBER    = GPIO 33
```

### Feature Flags (esp32.ino)
- `ENABLE_FLOW_SENSOR` - Set to `true` to enable flow sensor data transmission

## API Endpoints

### ESP Telemetry
- `POST /api/v1/esp/telemetry` - Receive sensor data
- `POST /api/v1/esp/telemetry/sync` - Sync buffered readings

### Dashboard
- `GET /api/v1/dashboard/zones` - All zone data
- `GET /api/v1/dashboard/kpi` - System KPIs
- `GET /api/v1/dashboard/nodes/telemetry?ids=valve_1,valve_2` - Node telemetry

### Model Hub
- `GET /api/v1/model-hub/status` - Model status
- `POST /api/v1/model-hub/run` - Run scenario

### Control
- `GET /api/v1/control/state` - Current control state
- `POST /api/v1/control/setpoint` - Set pressure setpoint
- `POST /api/v1/control/valve` - Send valve command
- `POST /api/v1/control/mode` - Toggle auto/manual

## Mock Data

When hardware is not connected, the system falls back to mock data:
- Frontend stores return hardcoded values
- Backend endpoints return demo data
- No hardware errors shown in UI

## Running the Project

### Backend
```bash
cd backend
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

### ESP32
Upload `backend/esp32/esp32.ino` to ESP32 board via Arduino IDE or PlatformIO.

## Environment Variables

- `PORT` - Backend server port (default: 3000)
- `NODE_ENV` - development/production

## Current State

- Frontend fully implemented with Model Hub and Control Center
- Backend has MPC and Integration services wired up
- ESP32 firmware supports registration, telemetry, and commands
- Mock data fallback enabled for testing without hardware

## Future Enhancements

- Database persistence (currently in-memory)
- WebSocket real-time updates
- User authentication
- Historical data charts
- Alert notifications