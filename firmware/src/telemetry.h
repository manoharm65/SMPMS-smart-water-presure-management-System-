/**
 * SMPMS ESP32 Firmware - Telemetry Module
 *
 * Handles periodic telemetry data transmission to backend.
 * Also handles piggybacked command responses.
 */

#ifndef TELEMETRY_H
#define TELEMETRY_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include "config.h"

/**
 * Telemetry data structure
 */
struct TelemetryData {
    float pressure;           // BAR, 2 decimal places
    int valvePosition;       // 0-100%
    unsigned long timestamp; // milliseconds since boot
};

/**
 * Command from backend piggyback response
 */
struct PiggybackCommand {
    char commandId[64];
    char type[32];           // Should be "SET_VALVE"
    int value;               // Target valve position 0-100
};

/**
 * Telemetry response from backend
 */
struct TelemetryResponse {
    bool received;
    PiggybackCommand* command;  // nullptr if no command pending
};

class Telemetry {
public:
    Telemetry();

    /**
     * Send telemetry data to backend
     * @param data Telemetry readings
     * @param apiKey Bearer token for authentication
     * @return TelemetryResponse with piggyback command if any
     */
    TelemetryResponse sendTelemetry(const TelemetryData& data, const char* apiKey);

    /**
     * Check if last transmission was successful
     */
    bool isConnected() const { return _lastSendSuccess; }

    /**
     * Get time since last successful send
     */
    unsigned long getTimeSinceLastSend() const;

    /**
     * Read current pressure from sensor
     * @return Pressure in BAR
     */
    float readPressure();

    /**
     * Read current valve position from servo feedback
     * @return Valve position 0-100%
     */
    int readValvePosition();

private:
    bool _lastSendSuccess;
    unsigned long _lastSendMs;
    float _lastPressure;
    PiggybackCommand _piggybackCmd;  // Member variable to avoid static buffer reuse

    /**
     * Perform HTTP POST to telemetry endpoint
     */
    bool postTelemetry(const TelemetryData& data, const char* apiKey,
                       char* responseBuffer, size_t bufferSize);

    /**
     * Parse telemetry response JSON
     */
    bool parseResponse(const char* json, TelemetryResponse& response);

    /**
     * Map ADC reading to pressure (0-20 BAR)
     */
    float adcToPressure(int adcValue);

    /**
     * Map ADC reading to servo position (0-100%)
     */
    int adcToServoPosition(int adcValue);
};

#endif // TELEMETRY_H
