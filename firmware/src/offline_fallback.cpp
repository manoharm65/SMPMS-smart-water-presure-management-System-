/**
 * SMPMS ESP32 Firmware - Offline Fallback Module Implementation
 */

#include "offline_fallback.h"

OfflineFallback::OfflineFallback()
    : _state(OFFLINE_INACTIVE)
    , _offlineStartMs(0)
    , _lastReconnectAttemptMs(0)
    , _bufferHead(0)
    , _bufferCount(0)
{
    // Initialize with default thresholds
    _thresholds.critical_high = DEFAULT_CRITICAL_HIGH;
    _thresholds.warning_high = DEFAULT_WARNING_HIGH;
    _thresholds.normal_low = DEFAULT_NORMAL_LOW;
    _thresholds.critical_low = DEFAULT_CRITICAL_LOW;
}

void OfflineFallback::begin(Storage& storage) {
    // Load thresholds from storage
    storage.getPressureThresholds(_thresholds);

    Serial.println("[OfflineFallback] Initialized with thresholds:");
    Serial.printf("  Critical High: %.2f BAR\n", _thresholds.critical_high);
    Serial.printf("  Warning High:  %.2f BAR\n", _thresholds.warning_high);
    Serial.printf("  Normal Low:    %.2f BAR\n", _thresholds.normal_low);
    Serial.printf("  Critical Low:  %.2f BAR\n", _thresholds.critical_low);
}

bool OfflineFallback::shouldActivate(unsigned long lastSuccessfulSendMs, uint32_t telemetryIntervalMs) {
    // Activate if no successful send in 2x the telemetry interval
    unsigned long threshold = telemetryIntervalMs * 2;
    return (millis() - lastSuccessfulSendMs) > threshold;
}

void OfflineFallback::activate() {
    if (_state == OFFLINE_ACTIVE) return;

    _state = OFFLINE_ACTIVE;
    _offlineStartMs = millis();
    _lastReconnectAttemptMs = millis();

    Serial.println("[OfflineFallback] === OFFLINE MODE ACTIVATED ===");
    Serial.println("[OfflineFallback] Using local threshold rules");
    Serial.printf("  Critical High: %.2f BAR -> close valve %d%%\n",
                  _thresholds.critical_high, OFFLINE_VALVE_ADJUST_PERCENT);
    Serial.printf("  Critical Low:  %.2f BAR -> open valve %d%%\n",
                  _thresholds.critical_low, OFFLINE_VALVE_ADJUST_PERCENT);
    Serial.println("[OfflineFallback] Buffering readings for later sync");
}

void OfflineFallback::deactivate() {
    if (_state == OFFLINE_INACTIVE) return;

    unsigned long offlineDuration = getOfflineTimeMs();
    Serial.printf("[OfflineFallback] === BACK ONLINE (offline for %lu ms) ===\n",
                  offlineDuration);

    _state = OFFLINE_INACTIVE;
}

int OfflineFallback::applyFallbackRules(float currentPressure, int currentValvePosition) {
    if (_state != OFFLINE_ACTIVE) {
        return currentValvePosition;
    }

    int newPosition = currentValvePosition;

    if (currentPressure > _thresholds.critical_high) {
        // Critical high: close valve by OFFLINE_VALVE_ADJUST_PERCENT
        newPosition = max(SERVO_POSITION_MIN, currentValvePosition - OFFLINE_VALVE_ADJUST_PERCENT);
        Serial.printf("[OfflineFallback] CRITICAL HIGH: %.2f BAR -> reducing valve %d%%\n",
                      currentPressure, OFFLINE_VALVE_ADJUST_PERCENT);
    }
    else if (currentPressure < _thresholds.critical_low) {
        // Critical low: open valve by OFFLINE_VALVE_ADJUST_PERCENT
        newPosition = min(SERVO_POSITION_MAX, currentValvePosition + OFFLINE_VALVE_ADJUST_PERCENT);
        Serial.printf("[OfflineFallback] CRITICAL LOW: %.2f BAR -> increasing valve %d%%\n",
                      currentPressure, OFFLINE_VALVE_ADJUST_PERCENT);
    }
    else {
        // Normal range: hold position
        Serial.printf("[OfflineFallback] Pressure OK: %.2f BAR -> holding valve at %d%%\n",
                      currentPressure, currentValvePosition);
    }

    return newPosition;
}

bool OfflineFallback::bufferReading(float pressure, int valvePosition) {
    if (_bufferCount >= BUFFER_SIZE) {
        // Buffer full - oldest reading is overwritten (FIFO)
        Serial.println("[OfflineFallback] Buffer full, dropping oldest reading");
        _bufferHead = (_bufferHead + 1) % BUFFER_SIZE;
        _bufferCount--;
    }

    // Add new reading at tail
    uint8_t tail = (_bufferHead + _bufferCount) % BUFFER_SIZE;
    _readings[tail].pressure = pressure;
    _readings[tail].valvePosition = valvePosition;
    _readings[tail].timestamp = millis();

    _bufferCount++;

    Serial.printf("[OfflineFallback] Buffered reading %d/%d: p=%.2f, v=%d%%\n",
                  _bufferCount, BUFFER_SIZE, pressure, valvePosition);

    return true;
}

uint8_t OfflineFallback::getBufferedReadings(BufferedReading* readings, uint8_t maxReadings) {
    if (_bufferCount == 0 || maxReadings == 0) {
        return 0;
    }

    uint8_t count = min(_bufferCount, maxReadings);

    // Copy readings in order (oldest first)
    for (uint8_t i = 0; i < count; i++) {
        uint8_t index = (_bufferHead + i) % BUFFER_SIZE;
        readings[i] = _readings[index];
    }

    Serial.printf("[OfflineFallback] Retrieved %d buffered readings\n", count);
    return count;
}

void OfflineFallback::clearBuffer() {
    _bufferCount = 0;
    _bufferHead = 0;
    Serial.println("[OfflineFallback] Buffer cleared");
}

unsigned long OfflineFallback::getOfflineTimeMs() const {
    if (_state != OFFLINE_ACTIVE) return 0;
    return millis() - _offlineStartMs;
}

bool OfflineFallback::shouldAttemptReconnect() {
    if (_state != OFFLINE_ACTIVE) return false;

    return (millis() - _lastReconnectAttemptMs) >= OFFLINE_RECONNECT_INTERVAL;
}

void OfflineFallback::scheduleReconnectAttempt() {
    _lastReconnectAttemptMs = millis();
    Serial.printf("[OfflineFallback] Next reconnect attempt in %lu ms\n",
                  OFFLINE_RECONNECT_INTERVAL);
}
