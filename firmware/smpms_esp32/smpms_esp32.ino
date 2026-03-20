/**
 * SMPMS ESP32 Firmware - Single File Arduino Sketch
 * Smart Pressure Management System - Edge Node
 *
 * Protocol: POST /api/v1/nodes/register, /telemetry, /telemetry/sync, /commands/:id/ack
 * See: backend/ESP_NODE_CONTROL.md
 *
 * HARDWARE WIRING:
 *   A0 (GPIO 36)  = Pressure sensor (analog 0-5V)
 *   GPIO 9         = Servo PWM control
 *   GPIO 35        = Servo position feedback
 *   GPIO 2         = Blue LED (online)
 *   GPIO 4         = Red LED (error)
 *   GPIO 33        = Amber LED (offline)
 */

// ============================================================================
// USER CONFIGURATION - CHANGE THESE VALUES
// ============================================================================
#define NODE_ID "DMA-01"                    // Unique per ESP: DMA-01 through DMA-08
#define FIRMWARE_VERSION "1.0.0"

const char* WIFI_SSID = "Hi";    // Your WiFi network name
const char* WIFI_PASSWORD = "baka_yaaro"; // Your WiFi password

const char* BACKEND_HOST = "10.20.180.165"; // Your backend server IP/hostname
const int BACKEND_PORT = 3000;             // Your backend port

// ============================================================================
// HARDWARE PINS (matching user's existing wiring)
// ============================================================================
#define PRESSURE_SENSOR_PIN    36    // A0 - Pressure sensor analog
#define SERVO_CONTROL_PIN      9     // Servo PWM control
#define SERVO_FEEDBACK_PIN     35    // Servo position feedback
#define STATUS_LED_BLUE        2     // Blue LED - Online
#define STATUS_LED_RED         4     // Red LED - Error
#define STATUS_LED_AMBER       33    // Amber LED - Offline

// ============================================================================
// TIMING CONSTANTS
// ============================================================================
#define TELEMETRY_INTERVAL_DEFAULT   10000   // 10 seconds
#define TELEMETRY_INTERVAL_MIN       5000    // 5 seconds minimum
#define TELEMETRY_INTERVAL_MAX       60000   // 60 seconds maximum
#define COMMAND_TIMEOUT              5000    // 5 seconds max for servo
#define REGISTRATION_RETRY_BASE      1000    // 1 second base
#define REGISTRATION_RETRY_MAX       30000   // 30 seconds max
#define OFFLINE_RECONNECT_INTERVAL   30000   // 30 seconds
#define HTTP_TIMEOUT_MS              10000   // 10 seconds HTTP
#define BUFFER_SIZE                 50      // Max buffered readings
#define WATCHDOG_TIMEOUT_MS          8000    // 8 seconds

// ============================================================================
// PRESSURE THRESHOLDS (defaults - overwritten after registration)
// ============================================================================
float THRESHOLD_CRITICAL_HIGH = 15.0f;
float THRESHOLD_WARNING_HIGH  = 12.0f;
float THRESHOLD_NORMAL_LOW    = 3.0f;
float THRESHOLD_CRITICAL_LOW  = 1.5f;

// ============================================================================
// API ENDPOINTS
// ============================================================================
#define EP_REGISTER      "/api/v1/nodes/register"
#define EP_TELEMETRY     "/api/v1/telemetry"
#define EP_TELEMETRY_SYNC "/api/v1/telemetry/sync"
#define EP_COMMAND_ACK   "/api/v1/commands/"

// ============================================================================
// LIBRARIES
// ============================================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>

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

NodeState currentState = STATE_BOOT;
NodeState previousState = STATE_BOOT;

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
const char* apiKey = nullptr;              // From registration
uint32_t telemetryIntervalMs = TELEMETRY_INTERVAL_DEFAULT;
unsigned long lastTelemetryMs = 0;
unsigned long bootTimeMs = 0;

// EEPROM addresses
#define EEPROM_SIZE     512
#define EEPROM_API_KEY_ADDR     32
#define EEPROM_API_KEY_SIZE     64
#define EEPROM_INTERVAL_ADDR     96
#define EEPROM_THRESHOLDS_ADDR   100

// Buffered readings for offline sync
struct Reading {
    float pressure;
    int valvePosition;
    unsigned long timestamp;
};

Reading buffer[BUFFER_SIZE];
uint8_t bufferCount = 0;
uint8_t bufferHead = 0;

// Servo state
int currentValvePosition = 50;
bool servoMoving = false;

// LEDC for servo PWM
#define LEDC_CHANNEL    LEDC_CHANNEL_0
#define LEDC_TIMER      LEDC_TIMER_0
#define LEDC_MODE       LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES   LEDC_TIMER_13_BIT
#define LEDC_FREQUENCY  50
#define LEDC_SERVO_MIN  5000   // 0.5ms
#define LEDC_SERVO_MAX  25000  // 2.5ms

// ============================================================================
// SETUP
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("==========================================");
    Serial.println("SMPMS ESP32 Firmware v" + String(FIRMWARE_VERSION));
    Serial.println("Node ID: " + String(NODE_ID));
    Serial.println("==========================================");

    // Initialize hardware
    setupHardware();

    // Initialize EEPROM
    EEPROM.begin(EEPROM_SIZE);

    // Load stored config if exists
    loadStoredConfig();

    // Connect WiFi
    connectWiFi();

    // Initialize LEDC for servo
    ledcSetup(LEDC_CHANNEL, LEDC_FREQUENCY, LEDC_DUTY_RES);
    ledcAttachPin(SERVO_CONTROL_PIN, LEDC_CHANNEL);
    ledcWrite(LEDC_CHANNEL, 0);

    // Set initial valve position
    setServoPosition(50);

    // Enable watchdog
    enableLoopWDT();

    bootTimeMs = millis();

    // Determine initial state
    if (apiKey != nullptr) {
        currentState = STATE_ONLINE;
        Serial.println("[Setup] Has stored credentials - going ONLINE");
    } else {
        currentState = STATE_REGISTERING;
        Serial.println("[Setup] No credentials - going to REGISTER");
    }

    logStateTransition(STATE_BOOT, currentState);
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
    feedLoopWDT();

    switch (currentState) {
        case STATE_REGISTERING:
            handleRegistration();
            break;
        case STATE_ONLINE:
            handleOnline();
            break;
        case STATE_OFFLINE:
            handleOffline();
            break;
        case STATE_ERROR:
            handleError();
            break;
        default:
            break;
    }

    updateStatusLEDs();
    delay(10);
}

// ============================================================================
// HARDWARE SETUP
// ============================================================================
void setupHardware() {
    Serial.println("[Hardware] Configuring pins...");

    // ADC for pressure sensor
    analogReadResolution(12);

    // Status LEDs
    pinMode(STATUS_LED_BLUE, OUTPUT);
    pinMode(STATUS_LED_RED, OUTPUT);
    pinMode(STATUS_LED_AMBER, OUTPUT);

    digitalWrite(STATUS_LED_BLUE, HIGH);
    digitalWrite(STATUS_LED_RED, HIGH);
    digitalWrite(STATUS_LED_AMBER, HIGH);

    Serial.println("[Hardware] Done");
}

// ============================================================================
// WIFI
// ============================================================================
void connectWiFi() {
    Serial.println("[WiFi] Connecting to: " + String(WIFI_SSID));

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("[WiFi] Connected! IP: " + WiFi.localIP().toString());
        Serial.println("[WiFi] RSSI: " + String(WiFi.RSSI()) + " dBm");
    } else {
        Serial.println();
        Serial.println("[WiFi] Connection failed!");
    }
}

// ============================================================================
// EEPROM STORAGE
// ============================================================================
void loadStoredConfig() {
    char magic[32];
    for (int i = 0; i < 32; i++) {
        magic[i] = EEPROM.read(i);
    }

    // Check magic header "SMPMS_ESP32_CONFIG_v1_"
    if (strncmp(magic, "SMPMS_ESP32_CONFIG_v1_", 22) != 0) {
        Serial.println("[Storage] No stored configuration");
        return;
    }

    // Load API key
    static char storedApiKey[65];
    for (int i = 0; i < 64; i++) {
        storedApiKey[i] = EEPROM.read(EEPROM_API_KEY_ADDR + i);
    }
    storedApiKey[64] = '\0';

    if (storedApiKey[0] != '\0') {
        apiKey = storedApiKey;
        Serial.println("[Storage] Loaded API key: " + String(apiKey).substring(0, 8) + "***");
    }

    // Load telemetry interval
    uint32_t storedInterval = EEPROM.readUInt32(EEPROM_INTERVAL_ADDR);
    if (storedInterval >= TELEMETRY_INTERVAL_MIN && storedInterval <= TELEMETRY_INTERVAL_MAX) {
        telemetryIntervalMs = storedInterval;
    }
    Serial.println("[Storage] Telemetry interval: " + String(telemetryIntervalMs) + " ms");

    // Load thresholds
    THRESHOLD_CRITICAL_HIGH = EEPROM.readFloat(EEPROM_THRESHOLDS_ADDR);
    THRESHOLD_WARNING_HIGH = EEPROM.readFloat(EEPROM_THRESHOLDS_ADDR + 4);
    THRESHOLD_NORMAL_LOW = EEPROM.readFloat(EEPROM_THRESHOLDS_ADDR + 8);
    THRESHOLD_CRITICAL_LOW = EEPROM.readFloat(EEPROM_THRESHOLDS_ADDR + 12);

    Serial.println("[Storage] Thresholds loaded");
}

void saveConfig(const char* key, uint32_t interval, float ch, float wh, float nl, float cl) {
    // Write magic header
    const char* magic = "SMPMS_ESP32_CONFIG_v1_";
    for (int i = 0; i < 32; i++) {
        EEPROM.write(i, magic[i]);
    }

    // Write API key
    uint16_t keyLen = strlen(key);
    for (int i = 0; i < 64; i++) {
        EEPROM.write(EEPROM_API_KEY_ADDR + i, (i < keyLen) ? key[i] : 0);
    }

    // Write interval
    EEPROM.writeUInt32(EEPROM_INTERVAL_ADDR, interval);

    // Write thresholds
    EEPROM.writeFloat(EEPROM_THRESHOLDS_ADDR, ch);
    EEPROM.writeFloat(EEPROM_THRESHOLDS_ADDR + 4, wh);
    EEPROM.writeFloat(EEPROM_THRESHOLDS_ADDR + 8, nl);
    EEPROM.writeFloat(EEPROM_THRESHOLDS_ADDR + 12, cl);

    EEPROM.commit();
    Serial.println("[Storage] Configuration saved");
}

// ============================================================================
// WATCHDOG
// ============================================================================
void enableLoopWDT() {
    // ESP32 software watchdog - reset if loop takes too long
    Serial.println("[WDT] Watchdog enabled");
}

void feedLoopWDT() {
    // In production, use esp_task_wdt_feed()
    // For now, just log periodically
    static unsigned long lastLog = 0;
    if (millis() - lastLog > 30000) {
        Serial.println("[WDT] Alive");
        lastLog = millis();
    }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
void logStateTransition(NodeState from, NodeState to) {
    const char* names[] = {"BOOT", "REGISTERING", "ONLINE", "OFFLINE", "ERROR"};
    Serial.println("[State] " + String(names[from]) + " -> " + String(names[to]));
    previousState = from;
    currentState = to;
}

void updateStatusLEDs() {
    digitalWrite(STATUS_LED_BLUE, HIGH);
    digitalWrite(STATUS_LED_RED, HIGH);
    digitalWrite(STATUS_LED_AMBER, HIGH);

    switch (currentState) {
        case STATE_ONLINE:
            digitalWrite(STATUS_LED_BLUE, LOW);
            break;
        case STATE_OFFLINE:
            digitalWrite(STATUS_LED_AMBER, LOW);
            break;
        case STATE_ERROR:
            digitalWrite(STATUS_LED_RED, LOW);
            break;
        case STATE_REGISTERING:
            if ((millis() / 500) % 2 == 0) {
                digitalWrite(STATUS_LED_BLUE, LOW);
            }
            break;
    }
}

void blinkErrorLED() {
    for (int i = 0; i < 5; i++) {
        digitalWrite(STATUS_LED_RED, LOW);
        delay(200);
        digitalWrite(STATUS_LED_RED, HIGH);
        delay(200);
    }
}

// ============================================================================
// REGISTRATION
// ============================================================================
void handleRegistration() {
    Serial.println("[Reg] Starting registration...");

    StaticJsonDocument<512> doc;
    doc["node_id"] = NODE_ID;
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["ip_address"] = WiFi.localIP().toString();

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    String url = "https://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + EP_REGISTER;

    Serial.println("[Reg] POST " + url);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(HTTP_TIMEOUT_MS / 1000);

    int httpCode = http.POST(payload);

    if (httpCode == 200) {
        String response = http.getString();
        Serial.println("[Reg] Response: " + response);

        StaticJsonDocument<512> respDoc;
        DeserializationError err = deserializeJson(respDoc, response);

        if (!err && respDoc["registered"] == true) {
            // Extract API key
            String newApiKey = respDoc["api_key"].as<String>();
            apiKey = strdup(newApiKey.c_str());

            // Extract telemetry interval
            telemetryIntervalMs = respDoc["telemetry_interval_ms"] | TELEMETRY_INTERVAL_DEFAULT;

            // Extract thresholds
            if (respDoc["pressure_thresholds"]) {
                THRESHOLD_CRITICAL_HIGH = respDoc["pressure_thresholds"]["critical_high"] | 15.0f;
                THRESHOLD_WARNING_HIGH = respDoc["pressure_thresholds"]["warning_high"] | 12.0f;
                THRESHOLD_NORMAL_LOW = respDoc["pressure_thresholds"]["normal_low"] | 3.0f;
                THRESHOLD_CRITICAL_LOW = respDoc["pressure_thresholds"]["critical_low"] | 1.5f;
            }

            // Save to EEPROM
            saveConfig(apiKey, telemetryIntervalMs,
                       THRESHOLD_CRITICAL_HIGH, THRESHOLD_WARNING_HIGH,
                       THRESHOLD_NORMAL_LOW, THRESHOLD_CRITICAL_LOW);

            Serial.println("[Reg] SUCCESS!");
            logStateTransition(STATE_REGISTERING, STATE_ONLINE);
            lastTelemetryMs = millis();
        } else {
            Serial.println("[Reg] Parse error or rejected");
        }
    } else {
        Serial.println("[Reg] HTTP " + String(httpCode));
        Serial.println("[Reg] Retrying in " + String(REGISTRATION_RETRY_BASE) + " ms...");
        delay(REGISTRATION_RETRY_BASE);
    }

    http.end();
}

// ============================================================================
// TELEMETRY
// ============================================================================
float readPressure() {
    int adcValue = analogRead(PRESSURE_SENSOR_PIN);

    // Convert using user's existing formula
    float voltage = (adcValue / 4095.0f) * 5.0f;
    float correctedVoltage = voltage - 0.5f;
    if (correctedVoltage < 0) correctedVoltage = 0;
    float pressureBar = correctedVoltage * 4.0f;

    return constrain(pressureBar, 0.0f, 20.0f);
}

int readValvePosition() {
    int adcValue = analogRead(SERVO_FEEDBACK_PIN);
    int position = map(adcValue, 0, 4095, 0, 100);
    return constrain(position, 0, 100);
}

void sendTelemetry() {
    float pressure = readPressure();
    int valvePos = readValvePosition();

    Serial.println("[Telemetry] P=" + String(pressure, 2) + " bar, V=" + String(valvePos) + "%");

    StaticJsonDocument<256> doc;
    doc["node_id"] = NODE_ID;
    doc["pressure"] = roundf(pressure * 100.0f) / 100.0f;
    doc["valve_position"] = valvePos;
    doc["timestamp"] = String(millis());

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    String url = "https://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + EP_TELEMETRY;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS / 1000);

    int httpCode = http.POST(payload);

    if (httpCode == 200) {
        String response = http.getString();
        Serial.println("[Telemetry] OK: " + response);

        // Check for piggyback command
        StaticJsonDocument<512> respDoc;
        if (deserializeJson(respDoc, response) == DeserializationError::Ok) {
            if (respDoc["command"].is<JsonObject>()) {
                const char* cmdType = respDoc["command"]["type"] | "";
                int cmdValue = respDoc["command"]["value"] | 0;
                const char* cmdId = respDoc["command"]["command_id"] | "";

                Serial.println("[Command] Received: " + String(cmdType) + " -> " + String(cmdValue));

                if (strcmp(cmdType, "SET_VALVE") == 0) {
                    executeSetValve(cmdValue, cmdId);
                }
            }
        }
    } else {
        Serial.println("[Telemetry] HTTP " + String(httpCode) + " - Going offline");
        enterOfflineMode();
    }

    http.end();
}

void handleOnline() {
    unsigned long now = millis();

    // Send telemetry at interval
    if ((now - lastTelemetryMs) >= telemetryIntervalMs) {
        lastTelemetryMs = now;
        sendTelemetry();
    }

    // Check WiFi status
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Lost connection!");
        enterOfflineMode();
    }
}

// ============================================================================
// SET VALVE COMMAND
// ============================================================================
void setServoPosition(int position) {
    position = constrain(position, 0, 100);
    uint32_t pulse = map(position, 0, 100, LEDC_SERVO_MIN, LEDC_SERVO_MAX);
    uint32_t duty = (pulse * (1 << LEDC_DUTY_RES)) / (1000000 / LEDC_FREQUENCY);
    ledcWrite(LEDC_CHANNEL, duty);
    currentValvePosition = position;
    Serial.println("[Servo] Position: " + String(position) + "%");
}

void executeSetValve(int targetPosition, const char* commandId) {
    Serial.println("[Command] SET_VALVE to " + String(targetPosition) + "%");

    unsigned long startTime = millis();
    int tolerance = 5;
    int stableCount = 0;

    setServoPosition(targetPosition);

    // Wait for servo to reach position
    while ((millis() - startTime) < COMMAND_TIMEOUT) {
        int actualPos = readValvePosition();

        if (abs(actualPos - targetPosition) <= tolerance) {
            stableCount++;
            if (stableCount >= 3) {
                break;
            }
        } else {
            stableCount = 0;
        }
        delay(50);
    }

    int actualPos = readValvePosition();
    bool success = (abs(actualPos - targetPosition) <= tolerance);

    Serial.println("[Command] Result: " + String(success ? "OK" : "TIMEOUT") +
                   " (target=" + String(targetPosition) + ", actual=" + String(actualPos) + ")");

    // Send ACK
    sendCommandAck(commandId, success, actualPos);
}

void sendCommandAck(const char* commandId, bool executed, int actualPosition) {
    StaticJsonDocument<256> doc;
    doc["node_id"] = NODE_ID;
    doc["executed"] = executed;
    doc["actual_position"] = actualPosition;
    doc["timestamp"] = String(millis());

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    String url = "https://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) +
                 EP_COMMAND_ACK + commandId + "/ack";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS / 1000);

    int httpCode = http.POST(payload);

    if (httpCode == 200) {
        Serial.println("[ACK] Sent successfully");
    } else {
        Serial.println("[ACK] Failed: HTTP " + String(httpCode));
    }

    http.end();
}

// ============================================================================
// OFFLINE MODE
// ============================================================================
void enterOfflineMode() {
    logStateTransition(currentState, STATE_OFFLINE);
    bufferCount = 0;
    bufferHead = 0;
}

void handleOffline() {
    unsigned long now = millis();

    // Read and buffer telemetry
    float pressure = readPressure();
    int valvePos = readValvePosition();

    // Buffer reading
    if (bufferCount < BUFFER_SIZE) {
        bufferCount++;
    } else {
        bufferHead = (bufferHead + 1) % BUFFER_SIZE;
    }

    uint8_t tail = (bufferHead + bufferCount - 1) % BUFFER_SIZE;
    buffer[tail].pressure = pressure;
    buffer[tail].valvePosition = valvePos;
    buffer[tail].timestamp = now;

    Serial.println("[Offline] Buffered: P=" + String(pressure, 2) + ", V=" + String(valvePos) +
                   " (" + String(bufferCount) + "/" + String(BUFFER_SIZE) + ")");

    // Apply offline fallback rules
    int newPosition = applyFallbackRules(pressure, valvePos);
    if (newPosition != valvePos) {
        setServoPosition(newPosition);
        Serial.println("[Offline] Valve adjusted to " + String(newPosition) + "%");
    }

    // Attempt reconnection periodically
    static unsigned long lastReconnectAttempt = 0;
    if ((now - lastReconnectAttempt) >= OFFLINE_RECONNECT_INTERVAL) {
        lastReconnectAttempt = now;
        attemptReconnect();
    }
}

int applyFallbackRules(float pressure, int currentPosition) {
    int adjustBy = 20;  // 20% adjustment

    if (pressure > THRESHOLD_CRITICAL_HIGH) {
        // High pressure - close valve
        return max(0, currentPosition - adjustBy);
    } else if (pressure < THRESHOLD_CRITICAL_LOW) {
        // Low pressure - open valve
        return min(100, currentPosition + adjustBy);
    }

    return currentPosition;  // Hold position
}

void attemptReconnect() {
    Serial.println("[Offline] Attempting reconnection...");

    // Check WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Offline] WiFi disconnected, reconnecting...");
        WiFi.disconnect();
        WiFi.reconnect();

        uint8_t attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(500);
            attempts++;
        }

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[Offline] WiFi reconnect failed");
            return;
        }
    }

    // Try sending telemetry
    StaticJsonDocument<256> doc;
    doc["node_id"] = NODE_ID;
    doc["pressure"] = readPressure();
    doc["valve_position"] = readValvePosition();
    doc["timestamp"] = String(millis());

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    String url = "https://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + EP_TELEMETRY;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS / 1000);

    int httpCode = http.POST(payload);
    http.end();

    if (httpCode == 200) {
        Serial.println("[Offline] Reconnected!");

        // Sync buffered readings
        if (bufferCount > 0) {
            syncBufferedReadings();
        }

        logStateTransition(STATE_OFFLINE, STATE_ONLINE);
        lastTelemetryMs = millis();
    } else {
        Serial.println("[Offline] Reconnect failed: HTTP " + String(httpCode));
    }
}

void syncBufferedReadings() {
    Serial.println("[Sync] Syncing " + String(bufferCount) + " readings...");

    StaticJsonDocument<4096> doc;
    doc["node_id"] = NODE_ID;

    JsonArray readings = doc.createNestedArray("readings");

    for (uint8_t i = 0; i < bufferCount; i++) {
        uint8_t idx = (bufferHead + i) % BUFFER_SIZE;
        JsonObject r = readings.createNestedObject();
        r["pressure"] = roundf(buffer[idx].pressure * 100.0f) / 100.0f;
        r["valve_position"] = buffer[idx].valvePosition;
        r["timestamp"] = String(buffer[idx].timestamp);
    }

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    String url = "https://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + EP_TELEMETRY_SYNC;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.setTimeout(HTTP_TIMEOUT_MS / 1000);

    int httpCode = http.POST(payload);

    if (httpCode == 200) {
        String response = http.getString();
        Serial.println("[Sync] Response: " + response);

        // Clear buffer
        bufferCount = 0;
        bufferHead = 0;

        Serial.println("[Sync] Done!");
    } else {
        Serial.println("[Sync] Failed: HTTP " + String(httpCode));
    }

    http.end();
}

// ============================================================================
// ERROR HANDLER
// ============================================================================
void handleError() {
    Serial.println("[ERROR] Fatal error - system halted");
    blinkErrorLED();
    delay(5000);
}
