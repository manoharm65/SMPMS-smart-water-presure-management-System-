/**
 * SMPMS ESP32 Firmware - Offline Fallback Module
 *
 * Handles offline operation when backend is unreachable.
 * Applies local threshold rules and buffers telemetry readings.
 */

#ifndef OFFLINE_FALLBACK_H
#define OFFLINE_FALLBACK_H

#include <Arduino.h>
#include "config.h"
#include "storage.h"

/**
 * Buffered telemetry reading for later sync
 */
struct BufferedReading {
    float pressure;
    int valvePosition;
    unsigned long timestamp;
};

/**
 * Offline mode state
 */
enum OfflineState {
    OFFLINE_INACTIVE,    // Normal online operation
    OFFLINE_ACTIVE,      // Offline mode engaged
    OFFLINE_RECONNECTING // Attempting to reconnect
};

class OfflineFallback {
public:
    OfflineFallback();

    /**
     * Initialize with stored thresholds
     * @param storage Storage instance with thresholds
     */
    void begin(Storage& storage);

    /**
     * Check if offline mode should be activated
     * @param lastSuccessfulSendMs Time since last successful telemetry send
     * @param telemetryIntervalMs Current telemetry interval
     * @return true if offline mode should be active
     */
    bool shouldActivate(unsigned long lastSuccessfulSendMs, uint32_t telemetryIntervalMs);

    /**
     * Activate offline mode
     */
    void activate();

    /**
     * Deactivate offline mode (back online)
     */
    void deactivate();

    /**
     * Check if currently in offline mode
     */
    bool isActive() const { return _state == OFFLINE_ACTIVE; }

    /**
     * Apply offline fallback rules based on pressure
     * @param currentPressure Current pressure reading
     * @param currentValvePosition Current valve position
     * @return New valve position (may be same as current if no adjustment needed)
     */
    int applyFallbackRules(float currentPressure, int currentValvePosition);

    /**
     * Buffer a telemetry reading
     * @param pressure Pressure reading
     * @param valvePosition Valve position
     * @return true if buffered successfully
     */
    bool bufferReading(float pressure, int valvePosition);

    /**
     * Get number of buffered readings
     */
    uint8_t getBufferCount() const { return _bufferCount; }

    /**
     * Get buffered readings (for sync)
     * @param readings Output array
     * @param maxReadings Maximum readings to retrieve
     * @return Number of readings retrieved
     */
    uint8_t getBufferedReadings(BufferedReading* readings, uint8_t maxReadings);

    /**
     * Clear buffered readings (after successful sync)
     */
    void clearBuffer();

    /**
     * Get current offline state
     */
    OfflineState getState() const { return _state; }

    /**
     * Get time since entering offline mode
     */
    unsigned long getOfflineTimeMs() const;

    /**
     * Check if it's time to attempt reconnection
     */
    bool shouldAttemptReconnect();

private:
    OfflineState _state;
    unsigned long _offlineStartMs;
    unsigned long _lastReconnectAttemptMs;
    PressureThresholds _thresholds;

    // Circular buffer for readings
    static const uint8_t BUFFER_SIZE = BUFFERED_READINGS_MAX;
    BufferedReading _readings[BUFFER_SIZE];
    uint8_t _bufferHead;
    uint8_t _bufferCount;

    /**
     * Calculate next reconnection attempt
     */
    void scheduleReconnectAttempt();
};

#endif // OFFLINE_FALLBACK_H
