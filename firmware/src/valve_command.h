/**
 * SMPMS ESP32 Firmware - Command Execution Module
 *
 * Handles SET_VALVE command execution from backend.
 * Moves servo to target position and sends ACK.
 */

#ifndef VALVE_COMMAND_H
#define VALVE_COMMAND_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include "config.h"

/**
 * Command execution result
 */
struct CommandResult {
    bool executed;           // true if command succeeded
    int actualPosition;      // Actual position servo moved to
    unsigned long execTimeMs; // Time taken to execute
};

/**
 * ACK payload for command
 */
struct CommandAck {
    char commandId[64];
    bool executed;
    int actualPosition;
    unsigned long timestamp;
};

class ValveCommand {
public:
    ValveCommand();

    /**
     * Execute SET_VALVE command
     * @param targetPosition Target valve position (0-100%)
     * @return CommandResult with execution status
     */
    CommandResult executeSetValve(int targetPosition);

    /**
     * Send command acknowledgment to backend
     * @param commandId Command ID from piggyback response
     * @param result Execution result
     * @param apiKey Bearer token
     * @return true if ACK sent successfully
     */
    bool sendAck(const char* commandId, const CommandResult& result, const char* apiKey);

    /**
     * Move servo to position with feedback
     * @param targetPosition Target position (0-100%)
     * @return Actual position reached
     */
    int moveServoTo(int targetPosition);

    /**
     * Check if servo is currently moving
     */
    bool isMoving() const { return _isMoving; }

private:
    bool _isMoving;
    int _currentPosition;

    /**
     * Set servo PWM output
     * @param position Target position (0-100%)
     */
    void setServoPosition(int position);

    /**
     * Wait for servo to reach target or timeout
     * @param targetPosition Target position
     * @param timeoutMs Maximum wait time
     * @return Actual position reached
     */
    int waitForServoPosition(int targetPosition, unsigned long timeoutMs);

    /**
     * Post ACK to backend
     */
    bool postAck(const char* commandId, bool executed, int actualPosition, const char* apiKey);
};

#endif // VALVE_COMMAND_H
