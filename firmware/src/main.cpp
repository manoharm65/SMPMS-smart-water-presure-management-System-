/**
 * SMPMS ESP32 Firmware - Main Entry Point
 *
 * Smart Pressure Management System - Edge Node Firmware
 *
 * Features:
 * - Boot registration with backend
 * - Periodic telemetry transmission
 * - SET_VALVE command execution via piggyback response
 * - Offline fallback with local threshold rules
 * - Buffered sync on reconnect
 * - Hardware watchdog timer
 *
 * Protocol: See backend/ESP_NODE_CONTROL.md
 */

#include <Arduino.h>
#include <WiFi.h>
#include <esp_task_wdt.h>
#include "config.h"
#include "storage.h"
#include "registration.h"
#include "telemetry.h"
#include "valve_command.h"
#include "offline_fallback.h"
#include "sync.h"

// ============================================================================
// Global Instances
// ============================================================================
Storage g_storage;
Registration g_registration;
Telemetry g_telemetry;
ValveCommand g_valveCommand;
OfflineFallback g_offlineFallback;
BufferedSync g_sync;

// ============================================================================
// WiFi Configuration (Set before compile or use config portal)
// ============================================================================
// These should be configured via EEPROM after first registration
// Default AP for initial setup if not configured
const char* WIFI_SSID = "SMPMS_SETUP";
const char* WIFI_PASSWORD = "smpms1234";  // Default, should be changed

// ============================================================================
// Global State
// ============================================================================
NodeState g_currentState = STATE_BOOT;
NodeState g_previousState = STATE_BOOT;
uint32_t g_telemetryIntervalMs = TELEMETRY_INTERVAL_DEFAULT;
PressureThresholds g_thresholds;
const char* g_apiKey = nullptr;
unsigned long g_lastTelemetryMs = 0;
unsigned long g_lastReconnectAttemptMs = 0;

// ============================================================================
// Function Prototypes
// ============================================================================
void setupHardware();
void setupWiFi();
void blinkStatusLED(uint8_t ledPin, uint8_t count, uint16_t delayMs);
void logStateTransition(NodeState from, NodeState to);
void updateStatusLEDs();
bool attemptReconnect();
void handleTelemetryLoop();
void handleOfflineReconnect();

// ============================================================================
// Setup
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("================================================");
    Serial.println("SMPMS ESP32 Firmware v" FIRMWARE_VERSION);
    Serial.printf("Node ID: %s\n", NODE_ID);
    Serial.println("================================================");

    // Initialize hardware
    setupHardware();

    // Initialize storage
    g_storage.begin();

    // Check for stored configuration
    if (g_storage.hasConfig()) {
        Serial.println("[Setup] Found stored configuration");

        // Load stored credentials
        g_apiKey = g_storage.getApiKey();
        if (g_apiKey == nullptr) {
            Serial.println("[Setup] ERROR: Stored API key is invalid");
            blinkStatusLED(STATUS_LED_RED, 10, 200);
            g_currentState = STATE_ERROR;
            while(1) {
                delay(1000);  // Halt
            }
        }

        // Load thresholds
        g_storage.getPressureThresholds(g_thresholds);
        g_telemetryIntervalMs = g_storage.getTelemetryInterval();

        Serial.printf("[Setup] API Key: %s***\n", String(g_apiKey).substring(0, 8).c_str());
        Serial.printf("[Setup] Telemetry Interval: %lu ms\n", g_telemetryIntervalMs);
    } else {
        Serial.println("[Setup] No stored configuration - must register");
    }

    // Initialize offline fallback with thresholds
    g_offlineFallback.begin(g_storage);

    // Connect to WiFi
    setupWiFi();

    // Initialize hardware watchdog
    esp_task_wdt_init(WATCHDOG_TIMEOUT_MS / 1000, true);
    esp_task_wdt_add(NULL);

    Serial.println("[Setup] Firmware initialization complete");
    Serial.println();

    // Transition to appropriate state
    if (g_apiKey != nullptr) {
        g_currentState = STATE_ONLINE;
    } else {
        g_currentState = STATE_REGISTERING;
    }
    logStateTransition(STATE_BOOT, g_currentState);
}

// ============================================================================
// Main Loop
// ============================================================================
void loop() {
    // Feed watchdog
    esp_task_wdt_reset();

    static unsigned long lastWDTLog = 0;
    if (millis() - lastWDTLog > 30000) {
        Serial.println("[WDT] Watchdog fed");
        lastWDTLog = millis();
    }

    // State machine
    switch (g_currentState) {
        case STATE_BOOT:
            // Should not happen after setup
            g_currentState = STATE_REGISTERING;
            break;

        case STATE_REGISTERING:
            handleRegistration();
            break;

        case STATE_ONLINE:
            handleTelemetryLoop();
            break;

        case STATE_OFFLINE:
            handleOfflineMode();
            break;

        case STATE_ERROR:
            handleErrorState();
            break;
    }

    updateStatusLEDs();
    delay(10);
}

// ============================================================================
// Hardware Setup
// ============================================================================
void setupHardware() {
    Serial.println("[Hardware] Configuring pins...");

    // Configure ADC for pressure sensor
    analogReadResolution(12);  // ESP32 12-bit ADC
    analogSetAttenuation(ADC_0db);  // 0-3.3V range (adjust for 5V sensor with divider)

    // Configure servo control pin
    pinMode(SERVO_CONTROL_PIN, OUTPUT);
    digitalWrite(SERVO_CONTROL_PIN, LOW);

    // Configure status LEDs
    pinMode(STATUS_LED_BLUE, OUTPUT);
    pinMode(STATUS_LED_RED, OUTPUT);
    pinMode(STATUS_LED_AMBER, OUTPUT);

    // All LEDs off initially
    digitalWrite(STATUS_LED_BLUE, HIGH);   // Common anode, HIGH = off
    digitalWrite(STATUS_LED_RED, HIGH);
    digitalWrite(STATUS_LED_AMBER, HIGH);

    Serial.println("[Hardware] Configuration complete");
}

// ============================================================================
// WiFi Setup
// ============================================================================
void setupWiFi() {
    Serial.println("[WiFi] Connecting to network...");

    // If no stored SSID/password, use default
    // In production, this should use a config portal or stored credentials
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
        Serial.printf("[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("[WiFi] Signal strength: %d dBm\n", WiFi.RSSI());
    } else {
        Serial.println();
        Serial.println("[WiFi] WARNING: Connection failed, will retry during operation");
    }
}

// ============================================================================
// State Management
// ============================================================================
void logStateTransition(NodeState from, NodeState to) {
    const char* stateNames[] = {"BOOT", "REGISTERING", "ONLINE", "OFFLINE", "ERROR"};

    if (from != to) {
        Serial.printf("[State] %s -> %s\n", stateNames[from], stateNames[to]);
        g_previousState = from;
        g_currentState = to;
    }
}

void updateStatusLEDs() {
    // Turn off all LEDs first (common anode)
    digitalWrite(STATUS_LED_BLUE, HIGH);
    digitalWrite(STATUS_LED_RED, HIGH);
    digitalWrite(STATUS_LED_AMBER, HIGH);

    // Turn on appropriate LED based on state
    switch (g_currentState) {
        case STATE_ONLINE:
            digitalWrite(STATUS_LED_BLUE, LOW);  // Blue = online
            break;
        case STATE_OFFLINE:
            digitalWrite(STATUS_LED_AMBER, LOW);  // Amber = offline
            break;
        case STATE_ERROR:
            digitalWrite(STATUS_LED_RED, LOW);  // Red = error
            break;
        case STATE_REGISTERING:
            // Blink blue while registering
            if ((millis() / 500) % 2 == 0) {
                digitalWrite(STATUS_LED_BLUE, LOW);
            }
            break;
        default:
            break;
    }
}

void blinkStatusLED(uint8_t ledPin, uint8_t count, uint16_t delayMs) {
    for (uint8_t i = 0; i < count; i++) {
        digitalWrite(ledPin, LOW);
        delay(delayMs);
        digitalWrite(ledPin, HIGH);
        delay(delayMs);
    }
}

// ============================================================================
// Registration Handler
// ============================================================================
void handleRegistration() {
    Serial.println("[Registration] Starting registration attempt...");

    RegistrationResponse* response = g_registration.registerNode(g_storage);

    if (response != nullptr && response->registered) {
        Serial.println("[Registration] SUCCESS!");

        // Update configuration
        g_telemetryIntervalMs = response->telemetryIntervalMs;
        g_thresholds = response->pressureThresholds;
        g_apiKey = g_storage.getApiKey();

        // Initialize offline fallback with new thresholds
        g_offlineFallback.begin(g_storage);

        // Transition to online
        logStateTransition(STATE_REGISTERING, STATE_ONLINE);
        g_lastTelemetryMs = millis();
    } else {
        Serial.println("[Registration] Failed, will retry...");

        // Check if we should retry
        uint32_t retryDelay = REGISTRATION_RETRY_BASE;
        if (g_registration.getRetryCount() > 0) {
            retryDelay = min(REGISTRATION_RETRY_BASE * (1 << (g_registration.getRetryCount() - 1)),
                           REGISTRATION_RETRY_MAX);
        }

        // Wait before retry
        delay(retryDelay);
    }
}

// ============================================================================
// Telemetry Loop (Online Mode)
// ============================================================================
void handleTelemetryLoop() {
    unsigned long now = millis();

    // Check if it's time to send telemetry
    if ((now - g_lastTelemetryMs) < g_telemetryIntervalMs) {
        return;  // Not yet time
    }

    g_lastTelemetryMs = now;

    // Read sensor data
    TelemetryData data;
    data.pressure = g_telemetry.readPressure();
    data.valvePosition = g_telemetry.readValvePosition();
    data.timestamp = now;

    Serial.printf("[Telemetry] Reading: pressure=%.2f BAR, valve=%d%%\n",
                  data.pressure, data.valvePosition);

    // Send telemetry
    TelemetryResponse response = g_telemetry.sendTelemetry(data, g_apiKey);

    if (!response.received) {
        // Telemetry failed - enter offline mode
        Serial.println("[Telemetry] Send failed, entering offline mode");
        logStateTransition(STATE_ONLINE, STATE_OFFLINE);
        g_offlineFallback.activate();

        // Buffer current reading
        g_offlineFallback.bufferReading(data.pressure, data.valvePosition);
        return;
    }

    // Check for piggybacked command
    if (response.command != nullptr) {
        Serial.printf("[Command] Executing: %s -> %d%%\n",
                      response.command->type, response.command->value);

        // Execute SET_VALVE command
        CommandResult cmdResult = g_valveCommand.executeSetValve(response.command->value);

        // Send ACK
        g_valveCommand.sendAck(response.command->commandId, cmdResult, g_apiKey);
    }

    // Apply offline rules if in offline mode
    if (g_offlineFallback.isActive()) {
        int newPosition = g_offlineFallback.applyFallbackRules(data.pressure, data.valvePosition);
        if (newPosition != data.valvePosition) {
            // Move valve to new position
            CommandResult result = g_valveCommand.executeSetValve(newPosition);
            Serial.printf("[OfflineFallback] Valve moved to %d%%\n", newPosition);
        }
        g_offlineFallback.deactivate();
    }
}

// ============================================================================
// Offline Mode Handler
// ============================================================================
void handleOfflineMode() {
    unsigned long now = millis();

    // Buffer telemetry readings
    TelemetryData data;
    data.pressure = g_telemetry.readPressure();
    data.valvePosition = g_telemetry.readValvePosition();
    data.timestamp = now;

    g_offlineFallback.bufferReading(data.pressure, data.valvePosition);

    // Apply offline fallback rules
    int newPosition = g_offlineFallback.applyFallbackRules(data.pressure, data.valvePosition);
    if (newPosition != data.valvePosition) {
        g_valveCommand.executeSetValve(newPosition);
    }

    // Attempt reconnection periodically
    if (g_offlineFallback.shouldAttemptReconnect()) {
        Serial.println("[Offline] Attempting reconnection...");
        g_offlineFallback.scheduleReconnectAttempt();

        if (attemptReconnect()) {
            Serial.println("[Offline] Reconnection successful!");

            // Sync buffered readings
            if (g_offlineFallback.getBufferCount() > 0) {
                BufferedReading readings[BUFFERED_READINGS_MAX];
                uint8_t count = g_offlineFallback.getBufferedReadings(readings, BUFFERED_READINGS_MAX);

                SyncResult syncResult = g_sync.syncBufferedReadings(readings, count, g_apiKey);

                if (syncResult.success) {
                    g_offlineFallback.clearBuffer();
                    Serial.printf("[Offline] Synced %d readings\n", syncResult.syncedCount);
                } else {
                    Serial.println("[Offline] Sync failed, keeping buffer");
                }
            }

            logStateTransition(STATE_OFFLINE, STATE_ONLINE);
            g_lastTelemetryMs = millis();
        } else {
            Serial.println("[Offline] Reconnection failed");
        }
    }
}

// ============================================================================
// Reconnection Attempt
// ============================================================================
bool attemptReconnect() {
    // Check WiFi status
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Reconnect] WiFi disconnected, reconnecting...");
        WiFi.disconnect();
        WiFi.reconnect();

        uint8_t attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(500);
            attempts++;
        }

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[Reconnect] WiFi reconnect failed");
            return false;
        }
    }

    // Test telemetry endpoint with a simple request
    TelemetryData testData;
    testData.pressure = 0.0f;
    testData.valvePosition = 0;
    testData.timestamp = millis();

    TelemetryResponse response = g_telemetry.sendTelemetry(testData, g_apiKey);

    return response.received;
}

// ============================================================================
// Error State Handler
// ============================================================================
void handleErrorState() {
    Serial.println("[ERROR] Fatal error state - system halted");
    blinkStatusLED(STATUS_LED_RED, 3, 1000);
    delay(5000);  // Long delay before blink again
}

// ============================================================================
// End of File
// ============================================================================
