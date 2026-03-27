/**
 * SMPMS ESP32 Firmware - Buffered Sync Module
 *
 * Handles synchronization of buffered telemetry readings
 * when reconnecting after offline mode.
 */

#ifndef SYNC_H
#define SYNC_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include "config.h"
#include "offline_fallback.h"

/**
 * Sync result
 */
struct SyncResult {
    bool success;         // true if sync completed successfully
    uint8_t syncedCount;  // Number of readings synced
    uint8_t attemptedCount; // Number of readings attempted
};

class BufferedSync {
public:
    BufferedSync();

    /**
     * Sync buffered readings to backend
     * @param readings Array of buffered readings
     * @param count Number of readings to sync
     * @param apiKey Bearer token for authentication
     * @return SyncResult with sync status
     */
    SyncResult syncBufferedReadings(const BufferedReading* readings, uint8_t count, const char* apiKey);

    /**
     * Check if sync is in progress
     */
    bool isSyncing() const { return _isSyncing; }

private:
    bool _isSyncing;

    /**
     * Post sync request to backend
     */
    bool postSync(const char* jsonPayload, char* responseBuffer, size_t bufferSize, const char* apiKey);

    /**
     * Parse sync response
     */
    uint8_t parseSyncResponse(const char* json);
};

#endif // SYNC_H
