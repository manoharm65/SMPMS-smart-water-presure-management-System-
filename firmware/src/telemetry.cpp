/**
 * SMPMS ESP32 Firmware - Telemetry Module Implementation
 */

#include "telemetry.h"
#include <ArduinoJson.h>

Telemetry::Telemetry()
    : _lastSendSuccess(false)
    , _lastSendMs(0)
    , _lastPressure(0.0f)
{
    memset(&_piggybackCmd, 0, sizeof(_piggybackCmd));
}

Telemetry::TelemetryResponse Telemetry::sendTelemetry(const TelemetryData& data, const char* apiKey) {
    static TelemetryResponse response;
    response.command = nullptr;

    Serial.printf("[Telemetry] Sending: pressure=%.2f, valve=%d%%\n",
                  data.pressure, data.valvePosition);

    // Allocate response buffer
    static char responseBuffer[1024];
    memset(responseBuffer, 0, sizeof(responseBuffer));

    // Post telemetry
    if (!postTelemetry(data, apiKey, responseBuffer, sizeof(responseBuffer))) {
        Serial.println("[Telemetry] POST failed");
        _lastSendSuccess = false;
        response.received = false;
        return response;
    }

    // Parse response
    if (!parseResponse(responseBuffer, response)) {
        Serial.println("[Telemetry] Failed to parse response");
        _lastSendSuccess = false;
        response.received = false;
        return response;
    }

    if (!response.received) {
        Serial.println("[Telemetry] Server rejected telemetry");
        _lastSendSuccess = false;
        return response;
    }

    _lastSendSuccess = true;
    _lastSendMs = millis();
    _lastPressure = data.pressure;

    if (response.command != nullptr) {
        Serial.printf("[Telemetry] Received command: %s, value=%d%%\n",
                      response.command->type, response.command->value);
    } else {
        Serial.println("[Telemetry] No pending command");
    }

    return response;
}

bool Telemetry::postTelemetry(const TelemetryData& data, const char* apiKey,
                              char* responseBuffer, size_t bufferSize) {
    WiFiClientSecure client;
    client.setTimeout(HTTP_TIMEOUT_MS / 1000);

    if (!client.connect(BACKEND_HOST, BACKEND_PORT)) {
        Serial.println("[Telemetry] Connection failed");
        return false;
    }

    // Build JSON payload
    StaticJsonDocument<256> doc;
    doc["node_id"] = NODE_ID;
    doc["pressure"] = roundf(data.pressure * 100.0f) / 100.0f;  // 2dp
    doc["valve_position"] = data.valvePosition;
    doc["timestamp"] = String(data.timestamp);

    char payload[256];
    serializeJson(doc, payload);

    // Build HTTP request with Bearer token
    char request[512];
    snprintf(request, sizeof(request),
             "POST %s HTTP/1.1\r\n"
             "Host: %s\r\n"
             "Content-Type: application/json\r\n"
             "Authorization: Bearer %s\r\n"
             "Content-Length: %d\r\n"
             "Connection: close\r\n"
             "\r\n"
             "%s",
             ENDPOINT_TELEMETRY, BACKEND_HOST, apiKey, strlen(payload), payload);

    if (client.print(request) == 0) {
        Serial.println("[Telemetry] Failed to send request");
        client.stop();
        return false;
    }

    // Read response
    unsigned long startTime = millis();
    size_t totalRead = 0;

    while (client.connected() && (millis() - startTime) < HTTP_TIMEOUT_MS) {
        if (client.available()) {
            size_t bytesRead = client.readBytes(
                responseBuffer + totalRead,
                bufferSize - totalRead - 1
            );
            if (bytesRead > 0) {
                totalRead += bytesRead;
                responseBuffer[totalRead] = '\0';
            }
        }
        delay(10);
    }

    client.stop();

    if (totalRead == 0) {
        return false;
    }

    // Find JSON body
    char* jsonStart = strstr(responseBuffer, "\r\n\r\n");
    if (jsonStart == nullptr) {
        return false;
    }
    jsonStart += 4;

    memmove(responseBuffer, jsonStart, strlen(jsonStart) + 1);
    return true;
}

bool Telemetry::parseResponse(const char* json, TelemetryResponse& response) {
    StaticJsonDocument<512> doc;

    DeserializationError error = deserializeJson(doc, json);
    if (error) {
        Serial.printf("[Telemetry] JSON parse error: %s\n", error.c_str());
        return false;
    }

    response.received = doc["received"] | false;

    // Check for piggybacked command - use member variable to avoid static buffer issues
    if (doc["command"].is<JsonObject>()) {
        // Clear previous command data
        memset(&_piggybackCmd, 0, sizeof(_piggybackCmd));

        strncpy(_piggybackCmd.commandId, doc["command"]["command_id"] | "", sizeof(_piggybackCmd.commandId) - 1);
        _piggybackCmd.commandId[sizeof(_piggybackCmd.commandId) - 1] = '\0';

        strncpy(_piggybackCmd.type, doc["command"]["type"] | "SET_VALVE", sizeof(_piggybackCmd.type) - 1);
        _piggybackCmd.type[sizeof(_piggybackCmd.type) - 1] = '\0';

        _piggybackCmd.value = doc["command"]["value"] | 0;
        response.command = &_piggybackCmd;
    } else {
        response.command = nullptr;
    }

    return true;
}

unsigned long Telemetry::getTimeSinceLastSend() const {
    return millis() - _lastSendMs;
}

float Telemetry::readPressure() {
    // Read ADC (10-bit on ESP32, 0-4095 for 0-3.3V)
    int adcValue = analogRead(PRESSURE_SENSOR_PIN);

    // Map to pressure
    return adcToPressure(adcValue);
}

int Telemetry::readValvePosition() {
    // Read servo feedback voltage (analog)
    int adcValue = analogRead(SERVO_FEEDBACK_PIN);

    return adcToServoPosition(adcValue);
}

float Telemetry::adcToPressure(int adcValue) {
    // Using user's existing formula:
    // Convert ADC (0-4095 for ESP32 12-bit) to voltage (0-5V for sensor)
    // Note: sensor outputs 0.5V-4.5V for 0-16 bar (with 0.5V offset)
    float voltage = (adcValue / 4095.0f) * 5.0f;

    // Apply offset and scale to pressure
    float correctedVoltage = voltage - 0.5f;
    if (correctedVoltage < 0) correctedVoltage = 0;

    // Sensor range: 0.5V = 0 bar, 4.5V = 16 bar
    // So corrected range is 0-4V for 0-16 bar = 4 bar/V
    float pressureBar = correctedVoltage * 4.0f;

    return constrain(pressureBar, 0.0f, 20.0f);
}

int Telemetry::adcToServoPosition(int adcValue) {
    // Map ADC value (0-4095) to servo position (0-100%)
    int position = map(adcValue, 0, 4095, SERVO_POSITION_MIN, SERVO_POSITION_MAX);
    return constrain(position, SERVO_POSITION_MIN, SERVO_POSITION_MAX);
}
