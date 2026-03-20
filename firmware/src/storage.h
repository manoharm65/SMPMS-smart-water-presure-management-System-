/**
 * SMPMS ESP32 Firmware - Storage Module
 *
 * Handles persistent storage of configuration and credentials in EEPROM/FLASH.
 * All sensitive data (API keys, thresholds) are stored here after registration.
 */

#ifndef STORAGE_H
#define STORAGE_H

#include <Arduino.h>
#include <EEPROM.h>
#include "config.h"

/**
 * Stored configuration structure
 * Layout in EEPROM:
 * [0-31]     : magic header (validation)
 * [32-95]    : API key (64 chars)
 * [96-99]    : telemetry_interval_ms (uint32_t)
 * [100-103]  : pressure_thresholds.critical_high (float)
 * [104-107]  : pressure_thresholds.warning_high (float)
 * [108-111]  : pressure_thresholds.normal_low (float)
 * [112-115]  : pressure_thresholds.critical_low (float)
 * [116-117]  : reserved
 * Total: 128 bytes
 */
struct StoredConfig {
    char magic[32];           // Validation marker
    char apiKey[64];          // API key from registration
    uint32_t telemetryIntervalMs;
    float criticalHigh;
    float warningHigh;
    float normalLow;
    float criticalLow;
};

class Storage {
public:
    static const uint16_t MAGIC_SIZE = 32;
    static const uint16_t CONFIG_SIZE = 128;
    static const uint16_t EEPROM_SIZE = 512;

    // Magic header for validation
    static const char* MAGIC_HEADER;

    Storage();

    /**
     * Initialize EEPROM
     * @return true if EEPROM is ready
     */
    bool begin();

    /**
     * Check if configuration exists
     * @return true if valid configuration is stored
     */
    bool hasConfig();

    /**
     * Save complete configuration after registration
     * @param apiKey API key from backend
     * @param intervalMs Telemetry interval in milliseconds
     * @param thresholds Pressure thresholds from backend
     */
    void saveConfig(const char* apiKey, uint32_t intervalMs,
                    const PressureThresholds& thresholds);

    /**
     * Load stored configuration
     * @param config Output structure to fill
     * @return true if valid config was loaded
     */
    bool loadConfig(StoredConfig& config);

    /**
     * Get stored API key
     * @return API key string or nullptr if not set
     */
    const char* getApiKey();

    /**
     * Get telemetry interval
     * @return Interval in ms or default if not set
     */
    uint32_t getTelemetryInterval();

    /**
     * Get pressure thresholds
     * @param thresholds Output structure to fill
     * @return true if valid thresholds loaded
     */
    bool getPressureThresholds(PressureThresholds& thresholds);

    /**
     * Clear all stored configuration
     */
    void clearConfig();

    /**
     * Print configuration to serial (for debugging)
     * @param showApiKey If true, show API key (be careful!)
     */
    void debugPrintConfig(bool showApiKey = false);

private:
    bool isValidMagic();
    void writeMagic();
};

#endif // STORAGE_H
