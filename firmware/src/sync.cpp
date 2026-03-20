/**
 * SMPMS ESP32 Firmware - Buffered Sync Module Implementation
 */

#include "sync.h"
#include <ArduinoJson.h>

BufferedSync::BufferedSync()
    : _isSyncing(false)
{}

BufferedSync::SyncResult BufferedSync::syncBufferedReadings(const BufferedReading* readings,
                                                            uint8_t count,
                                                            const char* apiKey) {
    SyncResult result = {false, 0, count};

    if (count == 0) {
        Serial.println("[Sync] No readings to sync");
        result.success = true;
        return result;
    }

    _isSyncing = true;

    Serial.printf("[Sync] Syncing %d buffered readings...\n", count);

    // Build JSON payload
    StaticJsonDocument<2048> doc;  // Large enough for 50 readings
    doc["node_id"] = NODE_ID;

    JsonArray readingsArray = doc.createNestedArray("readings");
    for (uint8_t i = 0; i < count; i++) {
        JsonObject reading = readingsArray.createNestedObject();
        reading["pressure"] = roundf(readings[i].pressure * 100.0f) / 100.0f;
        reading["valve_position"] = readings[i].valvePosition;
        reading["timestamp"] = String(readings[i].timestamp);
    }

    char payload[2048];
    serializeJson(doc, payload);

    Serial.printf("[Sync] Payload size: %d bytes\n", strlen(payload));

    // Allocate response buffer
    static char responseBuffer[512];
    memset(responseBuffer, 0, sizeof(responseBuffer));

    // Post sync request
    if (!postSync(payload, responseBuffer, sizeof(responseBuffer), apiKey)) {
        Serial.println("[Sync] POST failed");
        _isSyncing = false;
        return result;
    }

    // Parse response
    result.syncedCount = parseSyncResponse(responseBuffer);

    if (result.syncedCount > 0) {
        result.success = true;
        Serial.printf("[Sync] Successfully synced %d/%d readings\n",
                      result.syncedCount, count);
    } else {
        Serial.println("[Sync] Sync failed or no readings accepted");
    }

    _isSyncing = false;
    return result;
}

bool BufferedSync::postSync(const char* jsonPayload, char* responseBuffer,
                            size_t bufferSize, const char* apiKey) {
    WiFiClientSecure client;
    client.setTimeout(HTTP_TIMEOUT_MS / 1000);

    if (!client.connect(BACKEND_HOST, BACKEND_PORT)) {
        Serial.println("[Sync] Connection failed");
        return false;
    }

    // Build HTTP request
    char request[2048];
    snprintf(request, sizeof(request),
             "POST %s HTTP/1.1\r\n"
             "Host: %s\r\n"
             "Content-Type: application/json\r\n"
             "Authorization: Bearer %s\r\n"
             "Content-Length: %d\r\n"
             "Connection: close\r\n"
             "\r\n"
             "%s",
             ENDPOINT_TELEMETRY_SYNC, BACKEND_HOST, apiKey,
             strlen(jsonPayload), jsonPayload);

    if (client.print(request) == 0) {
        Serial.println("[Sync] Failed to send request");
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
        Serial.println("[Sync] No response received");
        return false;
    }

    // Find JSON body
    char* jsonStart = strstr(responseBuffer, "\r\n\r\n");
    if (jsonStart == nullptr) {
        Serial.println("[Sync] Malformed HTTP response");
        return false;
    }
    jsonStart += 4;

    memmove(responseBuffer, jsonStart, strlen(jsonStart) + 1);

    Serial.printf("[Sync] Response: %s\n", responseBuffer);
    return true;
}

uint8_t BufferedSync::parseSyncResponse(const char* json) {
    StaticJsonDocument<256> doc;

    DeserializationError error = deserializeJson(doc, json);
    if (error) {
        Serial.printf("[Sync] JSON parse error: %s\n", error.c_str());
        return 0;
    }

    uint8_t synced = doc["synced"] | 0;
    return synced;
}
