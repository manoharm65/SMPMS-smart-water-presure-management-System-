# SMPMS - Smart Pressure Management System

A SCADA-style IoT monitoring dashboard for municipal water pipeline pressure management across multiple DMA zones with real-time telemetry and valve control.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [ESP32 Firmware Setup](#esp32-firmware-setup)
7. [Running the Application](#running-the-application)
8. [Finding Your Computer's IP Address](#finding-your-computers-ip-address)

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Software | Version | Purpose |
|----------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | JavaScript runtime |
| [Arduino IDE](https://www.arduino.cc/en/software) | 2.0+ | ESP32 firmware development |
| [Git](https://git-scm.com/) | Latest | Version control |

### Additional Setup for ESP32

1. **Add ESP32 Board Support to Arduino IDE:**
   - Open Arduino IDE
   - Go to `File > Preferences`
   - In "Additional Boards Manager URLs", add:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to `Tools > Board > Boards Manager`
   - Search for "ESP32" and install "esp32 by Espressif Systems"

2. **Required Arduino Libraries:**
   - `WiFi` (built-in)
   - `HTTPClient` (built-in)
   - `ArduinoJson` (install via Library Manager)
   - `EEPROM` (built-in)
   - `ESP32Servo` (install via Library Manager)

---

## Project Structure

```
SMPMS/
├── backend/                 # Node.js + Express backend API
│   ├── src/               # TypeScript source files
│   ├── esp32/             # ESP32 firmware (Arduino sketch)
│   │   └── esp32.ino     # Main ESP32 firmware file
│   ├── data/              # SQLite database storage
│   └── package.json       # Backend dependencies
│
├── frontend/              # React + TypeScript frontend
│   ├── src/              # React source files
│   └── package.json      # Frontend dependencies
│
├── package.json          # Root package (runs both frontend + backend)
└── scripts/              # Utility scripts
```

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SMPMS-smart-water-presure-management-System-
```

### 2. Install Root Dependencies

```bash
npm install
```

This installs `concurrently` which runs both frontend and backend together.

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Backend Setup

### Configure Environment Variables

The backend requires a `.env` file for configuration.

1. Copy the example file:
   ```bash
   cd backend
   copy .env.example .env
   ```

2. Edit `.env` with your settings:
   ```env
   PORT=3000
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRES_IN=7d
   TELEGRAM_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   PRESSURE_MIN_THRESHOLD=2.0
   PRESSURE_MAX_THRESHOLD=6.0
   SQLITE_DB_PATH=./data/smpms.db
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   ```

### Initialize the Database

```bash
cd backend
npm run db:init
```

---

## ESP32 Firmware Setup

### Configuration Required Before Upload

Open `backend/esp32/esp32.ino` in Arduino IDE and modify the following sections:

#### 1. WiFi Credentials (Required)

```cpp
const char* WIFI_SSID     = "Your_WiFi_Name";
const char* WIFI_PASSWORD = "Your_WiFi_Password";
```

#### 2. Backend IP Address (Required)

```cpp
const char* BACKEND_HOST  = "192.168.x.x";  // Your computer's IP address
const int   BACKEND_PORT  = 3000;
```

#### 3. Node ID (Required for Multi-Node Setups)

```cpp
#define NODE_ID "DMA_01"
```

If deploying multiple ESP32 nodes, give each a unique ID:
- Node 1: `DMA_01`
- Node 2: `DMA_02`
- Node 3: `DMA_03`
- etc.

### Uploading Firmware to ESP32

1. Connect your ESP32 board via USB
2. Open `backend/esp32/esp32.ino` in Arduino IDE
3. Select your board: `Tools > Board > ESP32 > DOIT ESP32 DEVKIT V1` (or your specific board)
4. Select the correct port: `Tools > Port > COM_X` (Windows) or `/dev/ttyUSB0` (Linux/Mac)
5. Click the **Upload** button (right arrow icon)

### ESP32 Hardware Configuration

If using real sensors (not simulation mode), connect:

| Pin | Component |
|-----|-----------|
| GPIO 36 | Pressure Sensor (Analog) |
| GPIO 9 | Servo Control Signal |
| GPIO 35 | Servo Feedback (Optional) |
| GPIO 2 | Blue Status LED |
| GPIO 4 | Red Error LED |
| GPIO 33 | Amber Status LED |

---

## Running the Application

### Option 1: Run Everything Together (Recommended)

From the **root directory**:

```bash
npm run dev
```

This uses `concurrently` to run:
- Backend API at `http://localhost:3000`
- Frontend at `http://localhost:5173`

### Option 2: Run Backend and Frontend Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Verify Everything is Running

1. **Frontend Dashboard:** Open `http://localhost:5173` in your browser
2. **Backend API:** Check `http://localhost:3000/api/v1/health` (should return `{"status":"ok"}`)

### Default Login Credentials

- **Username:** `admin`
- **Password:** `admin123`

---

## Finding Your Computer's IP Address

### Windows

```cmd
ipconfig
```

Look for "IPv4 Address" under your active network adapter (Wi-Fi or Ethernet).

Example output:
```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . : 192.168.1.100
```

### macOS / Linux

```bash
ip addr show
# or
ifconfig
```

Look for `inet` under your active network interface (e.g., `en0`, `wlan0`).

Example output:
```
en0: inet 192.168.1.100
```

### Quick Test

Verify your computer is reachable from your ESP32 network:
```bash
ping 192.168.1.100
```

---

## Troubleshooting

### Backend won't start

1. Check that port 3000 is not in use:
   ```bash
   # Windows
   netstat -ano | findstr :3000

   # Linux/Mac
   lsof -i :3000
   ```

2. Ensure the database directory exists:
   ```bash
   mkdir -p backend/data
   ```

### ESP32 can't connect to backend

1. Verify WiFi credentials are correct in `esp32.ino`
2. Ensure the ESP32 and your computer are on the **same network**
3. Check that your firewall allows connections on port 3000
4. Verify the backend IP address in `esp32.ino` is correct

### Frontend shows "Connection Error"

1. Ensure the backend is running
2. Check browser console for specific errors
3. Verify CORS settings in backend

### ESP32 stays in "Registering" state

1. Check Serial Monitor in Arduino IDE (baud rate: 115200)
2. Verify the backend API is accessible from the ESP32
3. Check that `BACKEND_HOST` IP address is correct
