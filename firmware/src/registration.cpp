/**
 * SMPMS ESP32 Firmware - Registration Module Implementation
 */

#include "registration.h"
#include <ArduinoJson.h>

Registration::Registration()
    : _state(REG_NOT_STARTED)
    , _retryCount(0)
    , _nextRetryDelay(REGISTRATION_RETRY_BASE)
    , _lastAttemptMs(0)
{}

bool Registration::hasStoredCredentials(Storage& storage) {
    return storage.hasConfig() && storage.getApiKey() != nullptr;
}

Registration::RegistrationResponse* Registration::registerNode(Storage& storage) {
    static RegistrationResponse response;
    _state = REG_IN_PROGRESS;

    Serial.println("[Registration] Starting node registration...");
    Serial.printf("[Registration] Node ID: %s, Firmware: %s\n", NODE_ID, FIRMWARE_VERSION);

    // Initialize WiFi if not connected
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Registration] ERROR: WiFi not connected");
        _state = REG_FAILED;
        return nullptr;
    }

    // Allocate response buffer on heap (large enough for JSON response)
    static char responseBuffer[1024];
    memset(responseBuffer, 0, sizeof(responseBuffer));

    // Attempt registration
    if (!postRegistration(BACKEND_HOST, responseBuffer, sizeof(responseBuffer))) {
        Serial.println("[Registration] HTTP request failed");
        _state = REG_FAILED;

        // Calculate next retry delay
        _nextRetryDelay = getNextRetryDelay();
        _retryCount++;
        _lastAttemptMs = millis();

        Serial.printf("[Registration] Next retry in %lu ms (attempt %u)\n",
                      _nextRetryDelay, _retryCount);
        return nullptr;
    }

    // Parse response
    if (!parseResponse(responseBuffer, response)) {
        Serial.println("[Registration] Failed to parse response");
        _state = REG_FAILED;
        _nextRetryDelay = getNextRetryDelay();
        _retryCount++;
        _lastAttemptMs = millis();
        return nullptr;
    }

    // Validate response
    if (!response.registered) {
        Serial.println("[Registration] Registration rejected by server");
        _state = REG_FAILED;
        return nullptr;
    }

    Serial.println("[Registration] Registration successful!");
    Serial.printf("[Registration] Telemetry interval: %lu ms\n",
                  response.telemetryIntervalMs);
    Serial.printf("[Registration] Pressure thresholds: CH=%.2f, WH=%.2f, NL=%.2f, CL=%.2f\n",
                  response.pressureThresholds.critical_high,
                  response.pressureThresholds.warning_high,
                  response.pressureThresholds.normal_low,
                  response.pressureThresholds.critical_low);

    // Save to EEPROM
    const char* apiKey = storage.getApiKey();  // Get from storage after registration
    if (apiKey == nullptr) {
        Serial.println("[Registration] ERROR: API key not in storage");
        _state = REG_FAILED;
        return nullptr;
    }

    storage.saveConfig(apiKey, response.telemetryIntervalMs, response.pressureThresholds);

    _state = REG_SUCCESS;
    return &response;
}

bool Registration::postRegistration(const char* host, char* responseBuffer, size_t bufferSize) {
    WiFiClientSecure client;
    client.setTimeout(HTTP_TIMEOUT_MS / 1000);

    Serial.printf("[Registration] Connecting to %s:%d...\n", host, BACKEND_PORT);

    if (!client.connect(host, BACKEND_PORT)) {
        Serial.println("[Registration] Connection failed");
        return false;
    }

    Serial.println("[Registration] Connected, sending request...");

    // Get IP address string
    char ipStr[16];
    ipToString(WiFi.localIP(), ipStr, sizeof(ipStr));

    // Build JSON payload
    StaticJsonDocument<256> doc;
    doc["node_id"] = NODE_ID;
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["ip_address"] = ipStr;

    char payload[256];
    serializeJson(doc, payload);

    // Build HTTP request
    char request[512];
    snprintf(request, sizeof(request),
             "POST %s HTTP/1.1\r\n"
             "Host: %s\r\n"
             "Content-Type: application/json\r\n"
             "Content-Length: %d\r\n"
             "Connection: close\r\n"
             "\r\n"
             "%s",
             ENDPOINT_REGISTER, host, strlen(payload), payload);

    // Send request
    if (client.print(request) == 0) {
        Serial.println("[Registration] Failed to send request");
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
        Serial.println("[Registration] No response received");
        return false;
    }

    Serial.printf("[Registration] Response received (%d bytes)\n", totalRead);

    // Find JSON body (skip HTTP headers)
    char* jsonStart = strstr(responseBuffer, "\r\n\r\n");
    if (jsonStart == nullptr) {
        Serial.println("[Registration] Malformed HTTP response");
        return false;
    }
    jsonStart += 4;

    // Copy JSON to beginning of buffer
    memmove(responseBuffer, jsonStart, strlen(jsonStart) + 1);

    Serial.printf("[Registration] JSON body: %s\n", responseBuffer);
    return true;
}

bool Registration::parseResponse(const char* json, RegistrationResponse& response) {
    StaticJsonDocument<512> doc;

    DeserializationError error = deserializeJson(doc, json);
    if (error) {
        Serial.printf("[Registration] JSON parse error: %s\n", error.c_str());
        return false;
    }

    // Parse response fields
    response.registered = doc["registered"] | false;

    if (doc["node_id"]) {
        strncpy(response.nodeId, doc["node_id"].as<const char*>(), sizeof(response.nodeId) - 1);
        response.nodeId[sizeof(response.nodeId) - 1] = '\0';
    }

    response.telemetryIntervalMs = doc["telemetry_interval_ms"] | TELEMETRY_INTERVAL_DEFAULT;

    // Parse pressure thresholds
    if (doc["pressure_thresholds"]) {
        response.pressureThresholds.critical_high = doc["pressure_thresholds"]["critical_high"] | DEFAULT_CRITICAL_HIGH;
        response.pressureThresholds.warning_high = doc["pressure_thresholds"]["warning_high"] | DEFAULT_WARNING_HIGH;
        response.pressureThresholds.normal_low = doc["pressure_thresholds"]["normal_low"] | DEFAULT_NORMAL_LOW;
        response.pressureThresholds.critical_low = doc["pressure_thresholds"]["critical_low"] | DEFAULT_CRITICAL_LOW;
    } else {
        response.pressureThresholds.critical_high = DEFAULT_CRITICAL_HIGH;
        response.pressureThresholds.warning_high = DEFAULT_WARNING_HIGH;
        response.pressureThresholds.normal_low = DEFAULT_NORMAL_LOW;
        response.pressureThresholds.critical_low = DEFAULT_CRITICAL_LOW;
    }

    return true;
}

uint32_t Registration::getNextRetryDelay() {
    // Exponential backoff: 1s, 2s, 4s, 8s... max 30s
    uint32_t delay = REGISTRATION_RETRY_BASE * (1 << _retryCount);
    return min(delay, REGISTRATION_RETRY_MAX);
}

void Registration::reset() {
    _state = REG_NOT_STARTED;
    _retryCount = 0;
    _nextRetryDelay = REGISTRATION_RETRY_BASE;
    _lastAttemptMs = 0;
}

void Registration::ipToString(IPAddress ip, char* buffer, size_t size) {
    snprintf(buffer, size, "%d.%d.%d.%d", ip[0], ip[1], ip[2], ip[3]);
}
