/**
 * SMPMS ESP32 Firmware v1.0.0
 * Smart Pressure Management System - Edge Node
 * 
 * NOTE: Running in SIMULATION MODE — no physical sensors connected.
 *       Replace readPressure() and readValvePosition() with real
 *       sensor reads when hardware is available.
 */

// ============================================================================
// USER CONFIGURATION
// ============================================================================
#define NODE_ID          "DMA-01"
#define FIRMWARE_VERSION "1.0.0"

const char* WIFI_SSID     = "Hi";
const char* WIFI_PASSWORD = "baka_yaaro";
const char* BACKEND_HOST  = "10.132.54.165";
const int   BACKEND_PORT  = 3000;

// ============================================================================
// HARDWARE PINS
// ============================================================================
#define PRESSURE_SENSOR_PIN  36
#define SERVO_CONTROL_PIN     9
#define SERVO_FEEDBACK_PIN   35
#define STATUS_LED_BLUE       2
#define STATUS_LED_RED        4
#define STATUS_LED_AMBER     33

// ============================================================================
// TIMING CONSTANTS
// ============================================================================
#define TELEMETRY_INTERVAL_DEFAULT   5000UL   // ← 5 seconds
#define TELEMETRY_INTERVAL_MIN       5000UL   // ← 5 seconds minimum
#define TELEMETRY_INTERVAL_MAX      60000UL
#define COMMAND_TIMEOUT              5000UL
#define REGISTRATION_RETRY_DELAY     3000UL
#define OFFLINE_RECONNECT_INTERVAL  30000UL
#define HTTP_TIMEOUT_MS             10000UL
#define WIFI_CONNECT_TIMEOUT_MS     15000UL
#define BUFFER_SIZE                    50

// ============================================================================
// PRESSURE THRESHOLDS
// ============================================================================
float THRESHOLD_CRITICAL_HIGH = 5.5f;
float THRESHOLD_WARNING_HIGH  = 4.5f;
float THRESHOLD_NORMAL_LOW    = 2.5f;
float THRESHOLD_CRITICAL_LOW  = 1.5f;

// ============================================================================
// API ENDPOINTS
// ============================================================================
#define EP_REGISTER       "/api/v1/nodes/register"
#define EP_TELEMETRY      "/api/v1/esp/telemetry"
#define EP_TELEMETRY_SYNC "/api/v1/esp/telemetry/sync"
#define EP_COMMAND_ACK    "/api/v1/esp/commands/"

// ============================================================================
// LIBRARIES
// ============================================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <ESP32Servo.h>
#include <esp_task_wdt.h>

// ============================================================================
// EEPROM LAYOUT
// ============================================================================
#define EEPROM_SIZE            512
#define EEPROM_MAGIC_ADDR        0
#define EEPROM_API_KEY_ADDR     32
#define EEPROM_INTERVAL_ADDR    96
#define EEPROM_THRESHOLDS_ADDR 100
#define EEPROM_MAGIC_STR "SMPMS_ESP32_CONFIG_v1_"

// ============================================================================
// STATE MACHINE
// ============================================================================
enum NodeState {
    STATE_BOOT,
    STATE_REGISTERING,
    STATE_ONLINE,
    STATE_OFFLINE,
    STATE_ERROR
};

NodeState currentState  = STATE_BOOT;
NodeState previousState = STATE_BOOT;

// ============================================================================
// GLOBALS
// ============================================================================
char        apiKeyBuf[65]        = {0};
const char* apiKey               = nullptr;
uint32_t    telemetryIntervalMs  = TELEMETRY_INTERVAL_DEFAULT;
unsigned long lastTelemetryMs    = 0;

struct Reading {
    float         pressure;
    int           valvePosition;
    unsigned long timestamp;
};

Reading buffer[BUFFER_SIZE];
uint8_t bufferCount = 0;
uint8_t bufferHead  = 0;

int   currentValvePosition = 50;
Servo valveServo;

// ============================================================================
// FORWARD DECLARATIONS
// ============================================================================
void  setupHardware();
void  connectWiFi();
void  loadStoredConfig();
void  saveConfig(const char*, uint32_t, float, float, float, float);
void  logStateTransition(NodeState, NodeState);
void  updateStatusLEDs();
void  blinkErrorLED();
void  handleRegistration();
void  handleOnline();
void  handleOffline();
void  handleError();
void  sendTelemetry();
void  setServoPosition(int);
void  executeSetValve(int, const char*);
void  sendCommandAck(const char*, bool, int);
void  enterOfflineMode();
int   applyFallbackRules(float, int);
void  attemptReconnect();
void  syncBufferedReadings();
float readPressure();
int   readValvePosition();
String buildUrl(const char*);
String isoTimestamp();

// ============================================================================
// SETUP
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n==========================================");
    Serial.println("SMPMS ESP32 Firmware v" + String(FIRMWARE_VERSION));
    Serial.println("Node ID: " + String(NODE_ID));
    Serial.println("[Mode] SIMULATION — no physical sensors");
    Serial.println("==========================================");

    setupHardware();
    EEPROM.begin(EEPROM_SIZE);
    loadStoredConfig();

    // Subscribe WDT before connectWiFi so wdt_reset() works inside it
    esp_task_wdt_add(NULL);

    connectWiFi();

    valveServo.attach(SERVO_CONTROL_PIN);
    setServoPosition(50);

    currentState = (apiKey != nullptr) ? STATE_ONLINE : STATE_REGISTERING;
    Serial.println(currentState == STATE_ONLINE
        ? "[Setup] Has stored credentials - going ONLINE"
        : "[Setup] No credentials - going to REGISTER");
    logStateTransition(STATE_BOOT, currentState);
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
    esp_task_wdt_reset();

    switch (currentState) {
        case STATE_REGISTERING: handleRegistration(); break;
        case STATE_ONLINE:      handleOnline();       break;
        case STATE_OFFLINE:     handleOffline();      break;
        case STATE_ERROR:       handleError();        break;
        default: break;
    }

    updateStatusLEDs();
    delay(10);
}

// ============================================================================
// HARDWARE
// ============================================================================
void setupHardware() {
    analogReadResolution(12);
    pinMode(STATUS_LED_BLUE,  OUTPUT);
    pinMode(STATUS_LED_RED,   OUTPUT);
    pinMode(STATUS_LED_AMBER, OUTPUT);
    digitalWrite(STATUS_LED_BLUE,  HIGH);
    digitalWrite(STATUS_LED_RED,   HIGH);
    digitalWrite(STATUS_LED_AMBER, HIGH);
    Serial.println("[Hardware] Pins configured");
}

// ============================================================================
// SIMULATION — PRESSURE
//
// Pattern repeats every 120 seconds:
//   0– 39s  Normal  : ~4.0 bar with gentle sine fluctuation
//  40– 59s  Leak    : Fast drop to ~1.0 bar (below CRITICAL_LOW → alert fires)
//  60– 79s  Recovery: Gradual climb back to normal
//  80–119s  Normal  : ~4.0 bar again
// ============================================================================
float readPressure() {
    unsigned long phase = (millis() / 1000) % 120;
    float pressure;

    if (phase < 40) {
        // Normal — gentle sine wave around 4.0 bar
        pressure = 4.0f + 0.3f * sinf(phase * 0.5f);

    } else if (phase < 60) {
        float progress = (phase - 40) / 20.0f;   // 0.0 → 1.0
        if (progress < 0.2f) {
            // Fast initial drop (first 4 seconds of leak)
            pressure = 4.0f - (3.0f) * (progress / 0.2f);
        } else {
            // Hold low with small jitter
            pressure = 1.0f + 0.15f * sinf(phase * 2.0f);
        }

    } else if (phase < 80) {
        // Recovery — linear climb from 1.0 → 4.0 bar
        float progress = (phase - 60) / 20.0f;   // 0.0 → 1.0
        pressure = 1.0f + 3.0f * progress;

    } else {
        // Normal again
        pressure = 4.0f + 0.3f * sinf(phase * 0.5f);
    }

    // Tiny random noise ±0.05 bar
    pressure += (float)random(-50, 50) / 1000.0f;

    Serial.println("[Sim] Phase=" + String(phase) +
                   "s  P=" + String(pressure, 2) + " bar");

    return constrain(pressure, 0.0f, 20.0f);
}

// SIMULATION — VALVE POSITION
// Returns last commanded position (no feedback pot connected)
int readValvePosition() {
    return currentValvePosition;
}

// ============================================================================
// HELPERS
// ============================================================================
String buildUrl(const char* endpoint) {
    return "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + endpoint;
}

// Fake ISO 8601 timestamp derived from millis()
// Replace with NTP sync for production
String isoTimestamp() {
    unsigned long secs = millis() / 1000;
    char buf[32];
    snprintf(buf, sizeof(buf), "2026-01-01T%02lu:%02lu:%02luZ",
             (secs / 3600) % 24,
             (secs / 60)   % 60,
              secs          % 60);
    return String(buf);
}

// ============================================================================
// WIFI
// ============================================================================
void connectWiFi() {
    Serial.println("[WiFi] Connecting to: " + String(WIFI_SSID));
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        esp_task_wdt_reset();
        delay(500);
        Serial.print(".");
        if (millis() - start > WIFI_CONNECT_TIMEOUT_MS) {
            Serial.println("\n[WiFi] Timeout — continuing offline");
            return;
        }
    }
    Serial.println();
    Serial.println("[WiFi] Connected! IP: " + WiFi.localIP().toString());
    Serial.println("[WiFi] RSSI: " + String(WiFi.RSSI()) + " dBm");
}

// ============================================================================
// EEPROM
// ============================================================================
void loadStoredConfig() {
    char magic[32] = {0};
    for (int i = 0; i < 32; i++) magic[i] = EEPROM.read(i);

    if (strncmp(magic, EEPROM_MAGIC_STR, strlen(EEPROM_MAGIC_STR)) != 0) {
        Serial.println("[Storage] No stored configuration");
        return;
    }

    for (int i = 0; i < 64; i++) apiKeyBuf[i] = EEPROM.read(EEPROM_API_KEY_ADDR + i);
    apiKeyBuf[64] = '\0';
    if (apiKeyBuf[0] != '\0') {
        apiKey = apiKeyBuf;
        Serial.println("[Storage] API key: " + String(apiKey).substring(0, 8) + "***");
    }

    uint32_t storedInterval = 0;
    EEPROM.get(EEPROM_INTERVAL_ADDR, storedInterval);
    if (storedInterval >= TELEMETRY_INTERVAL_MIN && storedInterval <= TELEMETRY_INTERVAL_MAX)
        telemetryIntervalMs = storedInterval;

    EEPROM.get(EEPROM_THRESHOLDS_ADDR,       THRESHOLD_CRITICAL_HIGH);
    EEPROM.get(EEPROM_THRESHOLDS_ADDR +  4,  THRESHOLD_WARNING_HIGH);
    EEPROM.get(EEPROM_THRESHOLDS_ADDR +  8,  THRESHOLD_NORMAL_LOW);
    EEPROM.get(EEPROM_THRESHOLDS_ADDR + 12,  THRESHOLD_CRITICAL_LOW);

    Serial.println("[Storage] Config loaded. Interval=" + String(telemetryIntervalMs) + "ms");
}

void saveConfig(const char* key, uint32_t interval,
                float ch, float wh, float nl, float cl) {
    const char* magic = EEPROM_MAGIC_STR;
    for (size_t i = 0; i < 32; i++) EEPROM.write(i, magic[i]);

    uint16_t klen = strlen(key);
    for (int i = 0; i < 64; i++)
        EEPROM.write(EEPROM_API_KEY_ADDR + i, (i < klen) ? key[i] : 0);

    EEPROM.put(EEPROM_INTERVAL_ADDR,       interval);
    EEPROM.put(EEPROM_THRESHOLDS_ADDR,       ch);
    EEPROM.put(EEPROM_THRESHOLDS_ADDR +  4,  wh);
    EEPROM.put(EEPROM_THRESHOLDS_ADDR +  8,  nl);
    EEPROM.put(EEPROM_THRESHOLDS_ADDR + 12,  cl);
    EEPROM.commit();
    Serial.println("[Storage] Config saved");
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
void logStateTransition(NodeState from, NodeState to) {
    const char* n[] = {"BOOT", "REGISTERING", "ONLINE", "OFFLINE", "ERROR"};
    Serial.println("[State] " + String(n[from]) + " -> " + String(n[to]));
    previousState = from;
    currentState  = to;
}

void updateStatusLEDs() {
    digitalWrite(STATUS_LED_BLUE,  HIGH);
    digitalWrite(STATUS_LED_RED,   HIGH);
    digitalWrite(STATUS_LED_AMBER, HIGH);

    switch (currentState) {
        case STATE_ONLINE:  digitalWrite(STATUS_LED_BLUE,  LOW); break;
        case STATE_OFFLINE: digitalWrite(STATUS_LED_AMBER, LOW); break;
        case STATE_ERROR:   digitalWrite(STATUS_LED_RED,   LOW); break;
        case STATE_REGISTERING:
            if ((millis() / 500) % 2 == 0) digitalWrite(STATUS_LED_BLUE, LOW);
            break;
        default: break;
    }
}

void blinkErrorLED() {
    for (int i = 0; i < 5; i++) {
        digitalWrite(STATUS_LED_RED, LOW);  delay(200);
        digitalWrite(STATUS_LED_RED, HIGH); delay(200);
    }
}

// ============================================================================
// REGISTRATION
// ============================================================================
void handleRegistration() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Reg] No WiFi — waiting...");
        esp_task_wdt_reset();
        delay(2000);
        return;
    }

    Serial.println("[Reg] Starting registration...");

    StaticJsonDocument<256> doc;
    doc["nodeId"]          = NODE_ID;
    doc["firmwareVersion"] = FIRMWARE_VERSION;
    doc["ipAddress"]       = WiFi.localIP().toString();
    String payload;
    serializeJson(doc, payload);

    String url = buildUrl(EP_REGISTER);
    Serial.println("[Reg] POST " + url);
    Serial.println("[Reg] Body: " + payload);

    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(HTTP_TIMEOUT_MS);

    esp_task_wdt_reset();
    int code = http.POST(payload);

    if (code == 200 || code == 201) {
        String resp = http.getString();
        Serial.println("[Reg] Response: " + resp);

        StaticJsonDocument<512> rd;
        if (!deserializeJson(rd, resp) && rd["registered"] == true) {

            // Store API key
            if (rd.containsKey("api_key")) {
                strncpy(apiKeyBuf, rd["api_key"] | "", 64);
            } else {
                strncpy(apiKeyBuf, NODE_ID, 64);
                Serial.println("[Reg] WARNING: no api_key in response");
            }
            apiKeyBuf[64] = '\0';
            apiKey = apiKeyBuf;

            // Telemetry interval from server (clamped to our min/max)
            uint32_t serverInterval = rd["telemetry_interval_ms"] | TELEMETRY_INTERVAL_DEFAULT;
            telemetryIntervalMs = constrain(serverInterval,
                                            TELEMETRY_INTERVAL_MIN,
                                            TELEMETRY_INTERVAL_MAX);

            // Thresholds — backend uses camelCase
            if (rd.containsKey("pressure_thresholds")) {
                JsonObject pt = rd["pressure_thresholds"];
                THRESHOLD_CRITICAL_HIGH = pt["criticalHigh"] | 5.5f;
                THRESHOLD_WARNING_HIGH  = pt["warningHigh"]  | 4.5f;
                THRESHOLD_NORMAL_LOW    = pt["normalLow"]    | 2.5f;
                THRESHOLD_CRITICAL_LOW  = pt["criticalLow"]  | 1.5f;
            }

            saveConfig(apiKey, telemetryIntervalMs,
                       THRESHOLD_CRITICAL_HIGH, THRESHOLD_WARNING_HIGH,
                       THRESHOLD_NORMAL_LOW,    THRESHOLD_CRITICAL_LOW);

            Serial.println("[Reg] SUCCESS! Key: " + String(apiKey).substring(0, 8) + "***");
            Serial.println("[Reg] Interval: " + String(telemetryIntervalMs) + "ms");
            http.end();
            lastTelemetryMs = millis();
            logStateTransition(STATE_REGISTERING, STATE_ONLINE);
            return;
        }
        Serial.println("[Reg] Rejected or parse error");

    } else {
        String errBody = http.getString();
        Serial.println("[Reg] HTTP " + String(code) + " | " + errBody);
    }

    http.end();
    Serial.println("[Reg] Retrying in " + String(REGISTRATION_RETRY_DELAY) + "ms...");
    esp_task_wdt_reset();
    delay(REGISTRATION_RETRY_DELAY);
}

// ============================================================================
// ONLINE
// ============================================================================
void handleOnline() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Lost connection!");
        enterOfflineMode();
        return;
    }

    unsigned long now = millis();
    if ((now - lastTelemetryMs) >= telemetryIntervalMs) {
        lastTelemetryMs = now;
        sendTelemetry();
    }
}

// ============================================================================
// TELEMETRY
// ============================================================================
void sendTelemetry() {
    float pressure = readPressure();
    int   valvePos = readValvePosition();

    Serial.println("[Telemetry] P=" + String(pressure, 2) +
                   " bar | V=" + String(valvePos) + "%");

    StaticJsonDocument<256> doc;
    doc["nodeId"]        = NODE_ID;
    doc["pressure"]      = roundf(pressure * 100.0f) / 100.0f;
    doc["valvePosition"] = valvePos;
    doc["timestamp"]     = isoTimestamp();
    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    http.begin(buildUrl(EP_TELEMETRY));
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS);

    esp_task_wdt_reset();
    int code = http.POST(payload);

    if (code == 200 || code == 201) {
        String resp = http.getString();
        Serial.println("[Telemetry] OK");

        // Check for piggyback command
        StaticJsonDocument<512> rd;
        if (!deserializeJson(rd, resp) && rd["command"].is<JsonObject>()) {
            const char* cmdType = rd["command"]["type"]       | "";
            int         cmdVal  = rd["command"]["value"]      | 0;
            const char* cmdId   = rd["command"]["command_id"] | "";
            Serial.println("[Command] Received: " + String(cmdType) +
                           " -> " + String(cmdVal));
            if (strcmp(cmdType, "SET_VALVE") == 0)
                executeSetValve(cmdVal, cmdId);
        }

    } else {
        String errBody = http.getString();
        Serial.println("[Telemetry] HTTP " + String(code) + " | " + errBody); // already there
        Serial.println("[Telemetry] URL was: " + buildUrl(EP_TELEMETRY));      // ← add this
        http.end();
        enterOfflineMode();
        return;
    }

    http.end();
}

// ============================================================================
// SERVO / VALVE
// ============================================================================
void setServoPosition(int position) {
    position = constrain(position, 0, 100);
    int angle = map(position, 0, 100, 0, 180);
    valveServo.write(angle);
    currentValvePosition = position;
    Serial.println("[Servo] -> " + String(position) + "% (angle=" + String(angle) + ")");
}

void executeSetValve(int target, const char* cmdId) {
    Serial.println("[Command] SET_VALVE to " + String(target) + "%");
    setServoPosition(target);

    unsigned long start = millis();
    int stableCount = 0;
    while (millis() - start < COMMAND_TIMEOUT) {
        esp_task_wdt_reset();
        int actual = readValvePosition();
        stableCount = (abs(actual - target) <= 5) ? stableCount + 1 : 0;
        if (stableCount >= 3) break;
        delay(50);
    }

    int  actual = readValvePosition();
    bool ok     = (abs(actual - target) <= 5);
    Serial.println("[Command] " + String(ok ? "OK" : "TIMEOUT") +
                   " target=" + String(target) +
                   " actual=" + String(actual));
    sendCommandAck(cmdId, ok, actual);
}

void sendCommandAck(const char* cmdId, bool executed, int actualPos) {
    StaticJsonDocument<256> doc;
    doc["nodeId"]         = NODE_ID;
    doc["executed"]       = executed;
    doc["actualPosition"] = actualPos;
    doc["timestamp"]      = isoTimestamp();
    String payload;
    serializeJson(doc, payload);

    String endpoint = String("/api/v1/esp/commands/") + cmdId + "/ack";
    HTTPClient http;
    http.begin(buildUrl(endpoint.c_str()));
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS);

    esp_task_wdt_reset();
    int code = http.POST(payload);
    Serial.println("[ACK] HTTP " + String(code));
    http.end();
}

// ============================================================================
// OFFLINE MODE
// ============================================================================
void enterOfflineMode() {
    logStateTransition(currentState, STATE_OFFLINE);
    bufferCount = 0;
    bufferHead  = 0;
}

void handleOffline() {
    esp_task_wdt_reset();

    // ── Rate-limit offline reads to once every 3 seconds ──
    static unsigned long lastOfflineRead = 0;
    unsigned long now = millis();
    if (now - lastOfflineRead < 3000UL) return;
    lastOfflineRead = now;
    // ──────────────────────────────────────────────────────

    float pressure = readPressure();
    int   valvePos = readValvePosition();

    if (bufferCount < BUFFER_SIZE) bufferCount++;
    else bufferHead = (bufferHead + 1) % BUFFER_SIZE;

    uint8_t tail = (bufferHead + bufferCount - 1) % BUFFER_SIZE;
    buffer[tail]  = {pressure, valvePos, now};

    Serial.println("[Offline] P=" + String(pressure, 2) +
                   " V=" + String(valvePos) +
                   " buf=" + String(bufferCount) + "/" + String(BUFFER_SIZE));

    int newPos = applyFallbackRules(pressure, valvePos);
    if (newPos != valvePos) setServoPosition(newPos);

    static unsigned long lastReconnect = 0;
    if (now - lastReconnect >= OFFLINE_RECONNECT_INTERVAL) {
        lastReconnect = now;
        attemptReconnect();
    }
}

int applyFallbackRules(float pressure, int pos) {
    if (pressure > THRESHOLD_CRITICAL_HIGH) return max(0,   pos - 20);
    if (pressure < THRESHOLD_CRITICAL_LOW)  return min(100, pos + 20);
    return pos;
}

void attemptReconnect() {
    Serial.println("[Offline] Attempting reconnect...");

    if (WiFi.status() != WL_CONNECTED) {
        WiFi.disconnect();
        WiFi.reconnect();
        unsigned long start = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - start < 10000UL) {
            esp_task_wdt_reset();
            delay(500);
        }
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[Offline] WiFi reconnect failed");
            return;
        }
    }

    // Quick probe
    StaticJsonDocument<256> doc;
    doc["nodeId"]        = NODE_ID;
    doc["pressure"]      = readPressure();
    doc["valvePosition"] = readValvePosition();
    doc["timestamp"]     = isoTimestamp();
    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    http.begin(buildUrl(EP_TELEMETRY));
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS);

    esp_task_wdt_reset();
    int code = http.POST(payload);
    http.end();

    if (code == 200 || code == 201) {
        Serial.println("[Offline] Reconnected!");
        if (bufferCount > 0) syncBufferedReadings();
        lastTelemetryMs = millis();
        logStateTransition(STATE_OFFLINE, STATE_ONLINE);
    } else {
        Serial.println("[Offline] Reconnect failed: HTTP " + String(code));
    }
}

// ============================================================================
// SYNC BUFFERED READINGS
// ============================================================================
void syncBufferedReadings() {
    Serial.println("[Sync] Syncing " + String(bufferCount) + " readings...");

    StaticJsonDocument<4096> doc;
    doc["nodeId"] = NODE_ID;
    JsonArray arr = doc.createNestedArray("readings");

    for (uint8_t i = 0; i < bufferCount; i++) {
        uint8_t    idx  = (bufferHead + i) % BUFFER_SIZE;
        JsonObject r    = arr.createNestedObject();
        unsigned long s = buffer[idx].timestamp / 1000;
        char ts[32];
        snprintf(ts, sizeof(ts), "2026-01-01T%02lu:%02lu:%02luZ",
                 (s / 3600) % 24, (s / 60) % 60, s % 60);

        r["pressure"]      = roundf(buffer[idx].pressure * 100.0f) / 100.0f;
        r["valvePosition"] = buffer[idx].valvePosition;
        r["timestamp"]     = ts;
    }

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    http.begin(buildUrl(EP_TELEMETRY_SYNC));
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS);

    esp_task_wdt_reset();
    int code = http.POST(payload);

    if (code == 200) {
        bufferCount = 0;
        bufferHead  = 0;
        Serial.println("[Sync] Done!");
    } else {
        String err = http.getString();
        Serial.println("[Sync] Failed: HTTP " + String(code) + " | " + err);
    }
    http.end();
}

// ============================================================================
// ERROR
// ============================================================================
void handleError() {
    Serial.println("[ERROR] Fatal — halted");
    blinkErrorLED();
    esp_task_wdt_reset();
    delay(5000);
}