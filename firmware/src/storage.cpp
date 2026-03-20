/**
 * SMPMS ESP32 Firmware - Storage Module Implementation
 */

#include "storage.h"
#include <string.h>

const char* Storage::MAGIC_HEADER = "SMPMS_ESP32_CONFIG_v1_";

Storage::Storage() {}

bool Storage::begin() {
    if (!EEPROM.begin(EEPROM_SIZE)) {
        Serial.println("[Storage] ERROR: EEPROM begin failed");
        return false;
    }
    Serial.println("[Storage] EEPROM initialized");
    return true;
}

bool Storage::hasConfig() {
    return isValidMagic();
}

bool Storage::isValidMagic() {
    char magic[MAGIC_SIZE];
    for (uint16_t i = 0; i < MAGIC_SIZE; i++) {
        magic[i] = EEPROM.read(i);
    }
    return strncmp(magic, MAGIC_HEADER, strlen(MAGIC_HEADER)) == 0;
}

void Storage::writeMagic() {
    for (uint16_t i = 0; i < MAGIC_SIZE; i++) {
        EEPROM.write(i, MAGIC_HEADER[i]);
    }
}

void Storage::saveConfig(const char* apiKey, uint32_t intervalMs,
                         const PressureThresholds& thresholds) {
    // Write magic header
    writeMagic();

    // Write API key (offset 32)
    uint16_t apiKeyOffset = 32;
    uint16_t apiKeyLen = strlen(apiKey);
    for (uint16_t i = 0; i < 64; i++) {
        EEPROM.write(apiKeyOffset + i, (i < apiKeyLen) ? apiKey[i] : 0);
    }

    // Write telemetry interval (offset 96)
    uint16_t intervalOffset = 96;
    EEPROM.writeUInt32(intervalOffset, intervalMs);

    // Write pressure thresholds (offset 100)
    uint16_t thresholdOffset = 100;
    EEPROM.writeFloat(thresholdOffset, thresholds.critical_high);
    EEPROM.writeFloat(thresholdOffset + 4, thresholds.warning_high);
    EEPROM.writeFloat(thresholdOffset + 8, thresholds.normal_low);
    EEPROM.writeFloat(thresholdOffset + 12, thresholds.critical_low);

    // Commit to flash
    if (EEPROM.commit()) {
        Serial.println("[Storage] Configuration saved successfully");
    } else {
        Serial.println("[Storage] ERROR: Failed to commit configuration");
    }
}

bool Storage::loadConfig(StoredConfig& config) {
    if (!hasConfig()) {
        Serial.println("[Storage] No valid configuration found");
        return false;
    }

    // Read API key
    uint16_t apiKeyOffset = 32;
    for (uint16_t i = 0; i < 64; i++) {
        config.apiKey[i] = EEPROM.read(apiKeyOffset + i);
    }
    config.apiKey[63] = '\0';

    // Read telemetry interval
    uint16_t intervalOffset = 96;
    config.telemetryIntervalMs = EEPROM.readUInt32(intervalOffset);

    // Read pressure thresholds
    uint16_t thresholdOffset = 100;
    config.criticalHigh = EEPROM.readFloat(thresholdOffset);
    config.warningHigh = EEPROM.readFloat(thresholdOffset + 4);
    config.normalLow = EEPROM.readFloat(thresholdOffset + 8);
    config.criticalLow = EEPROM.readFloat(thresholdOffset + 12);

    Serial.println("[Storage] Configuration loaded successfully");
    return true;
}

const char* Storage::getApiKey() {
    static char apiKey[64];
    uint16_t apiKeyOffset = 32;

    for (uint16_t i = 0; i < 64; i++) {
        apiKey[i] = EEPROM.read(apiKeyOffset + i);
    }
    apiKey[63] = '\0';

    // Check if API key is empty
    if (apiKey[0] == '\0') {
        return nullptr;
    }

    return apiKey;
}

uint32_t Storage::getTelemetryInterval() {
    uint16_t intervalOffset = 96;
    uint32_t interval = EEPROM.readUInt32(intervalOffset);

    // Validate range
    if (!isValidTelemetryInterval(interval)) {
        Serial.println("[Storage] Invalid interval in EEPROM, using default");
        return TELEMETRY_INTERVAL_DEFAULT;
    }

    return interval;
}

bool Storage::getPressureThresholds(PressureThresholds& thresholds) {
    if (!hasConfig()) {
        // Return defaults if no config
        thresholds.critical_high = DEFAULT_CRITICAL_HIGH;
        thresholds.warning_high = DEFAULT_WARNING_HIGH;
        thresholds.normal_low = DEFAULT_NORMAL_LOW;
        thresholds.critical_low = DEFAULT_CRITICAL_LOW;
        return false;
    }

    uint16_t thresholdOffset = 100;
    thresholds.critical_high = EEPROM.readFloat(thresholdOffset);
    thresholds.warning_high = EEPROM.readFloat(thresholdOffset + 4);
    thresholds.normal_low = EEPROM.readFloat(thresholdOffset + 8);
    thresholds.critical_low = EEPROM.readFloat(thresholdOffset + 12);

    return true;
}

void Storage::clearConfig() {
    Serial.println("[Storage] Clearing configuration...");
    for (uint16_t i = 0; i < CONFIG_SIZE; i++) {
        EEPROM.write(i, 0xFF);
    }
    EEPROM.commit();
    Serial.println("[Storage] Configuration cleared");
}

void Storage::debugPrintConfig(bool showApiKey) {
    StoredConfig config;
    if (!loadConfig(config)) {
        Serial.println("[Storage] Debug: No config to print");
        return;
    }

    Serial.println("[Storage] === Configuration Debug ===");
    Serial.printf("  API Key: %s\n", showApiKey ? config.apiKey : "***REDACTED***");
    Serial.printf("  Telemetry Interval: %lu ms\n", config.telemetryIntervalMs);
    Serial.printf("  Pressure Thresholds:\n");
    Serial.printf("    Critical High: %.2f BAR\n", config.criticalHigh);
    Serial.printf("    Warning High:  %.2f BAR\n", config.warningHigh);
    Serial.printf("    Normal Low:    %.2f BAR\n", config.normalLow);
    Serial.printf("    Critical Low:  %.2f BAR\n", config.criticalLow);
    Serial.println("================================");
}
