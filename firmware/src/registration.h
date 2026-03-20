/**
 * SMPMS ESP32 Firmware - Registration Module
 *
 * Handles boot registration with the backend server.
 * On successful registration, receives API key and configuration.
 */

#ifndef REGISTRATION_H
#define REGISTRATION_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include "config.h"
#include "storage.h"

/**
 * Registration response from backend
 */
struct RegistrationResponse {
    bool registered;
    char nodeId[32];
    uint32_t telemetryIntervalMs;
    PressureThresholds pressureThresholds;
};

/**
 * Registration state
 */
enum RegistrationState {
    REG_NOT_STARTED,
    REG_IN_PROGRESS,
    REG_SUCCESS,
    REG_FAILED
};

class Registration {
public:
    Registration();

    /**
     * Attempt registration with exponential backoff
     * @param storage Storage instance for saving config
     * @return RegistrationResponse if successful, nullptr otherwise
     */
    RegistrationResponse* registerNode(Storage& storage);

    /**
     * Check if we have valid stored credentials
     * @param storage Storage instance
     * @return true if API key exists in storage
     */
    bool hasStoredCredentials(Storage& storage);

    /**
     * Get current registration state
     */
    RegistrationState getState() const { return _state; }

    /**
     * Get current retry count
     */
    uint8_t getRetryCount() const { return _retryCount; }

    /**
     * Reset registration state for retry
     */
    void reset();

private:
    RegistrationState _state;
    uint8_t _retryCount;
    uint32_t _nextRetryDelay;
    unsigned long _lastAttemptMs;

    /**
     * Perform HTTP POST to registration endpoint
     */
    bool postRegistration(const char* host, char* responseBuffer, size_t bufferSize);

    /**
     * Parse registration response JSON
     */
    bool parseResponse(const char* json, RegistrationResponse& response);

    /**
     * Calculate next retry delay with exponential backoff
     */
    uint32_t getNextRetryDelay();

    /**
     * Convert IPAddress to string
     */
    void ipToString(IPAddress ip, char* buffer, size_t size);
};

#endif // REGISTRATION_H
