/**
 * SMPMS ESP32 Firmware - Command Execution Module Implementation
 */

#include "valve_command.h"
#include <ArduinoJson.h>
#include <driver/ledc.h>

// LEDC configuration for servo control
#define LEDC_CHANNEL            LEDC_CHANNEL_0
#define LEDC_TIMER             LEDC_TIMER_0
#define LEDC_MODE             LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES         LEDC_TIMER_13_BIT  // 8192 steps
#define LEDC_FREQUENCY         50                  // 50Hz for servo (20ms period)
#define LEDC_SERVO_MIN_PULSE   5000               // 0.5ms = 0% (5% of 20ms)
#define LEDC_SERVO_MAX_PULSE   25000              // 2.5ms = 100% (12.5% of 20ms)

ValveCommand::ValveCommand()
    : _isMoving(false)
    , _currentPosition(0)
{
    // Initialize LEDC for servo control
    ledcSetup(LEDC_CHANNEL, LEDC_FREQUENCY, LEDC_DUTY_RES);
    ledcAttachPin(SERVO_CONTROL_PIN, LEDC_CHANNEL);
    // Start with 0 duty
    ledcWrite(LEDC_CHANNEL, 0);

    Serial.println("[ValveCommand] LEDC servo control initialized");
}

ValveCommand::CommandResult ValveCommand::executeSetValve(int targetPosition) {
    CommandResult result;
    result.executed = false;
    result.actualPosition = _currentPosition;
    result.execTimeMs = 0;

    // Validate target position
    if (!isValidValvePosition(targetPosition)) {
        Serial.printf("[ValveCommand] Invalid target position: %d\n", targetPosition);
        return result;
    }

    Serial.printf("[ValveCommand] Executing SET_VALVE to %d%%\n", targetPosition);

    unsigned long startTime = millis();
    _isMoving = true;

    // Move servo to target position
    result.actualPosition = moveServoTo(targetPosition);

    result.execTimeMs = millis() - startTime;
    _isMoving = false;

    // Check if we reached target (within tolerance)
    int tolerance = 5;  // 5% tolerance
    if (abs(result.actualPosition - targetPosition) <= tolerance) {
        result.executed = true;
        Serial.printf("[ValveCommand] Success: reached %d%% in %lu ms\n",
                      result.actualPosition, result.execTimeMs);
    } else {
        Serial.printf("[ValveCommand] Partial: got %d%% (target %d%%) in %lu ms\n",
                      result.actualPosition, targetPosition, result.execTimeMs);
    }

    return result;
}

bool ValveCommand::sendAck(const char* commandId, const CommandResult& result, const char* apiKey) {
    Serial.printf("[ValveCommand] Sending ACK for command %s: executed=%s, pos=%d\n",
                  commandId, result.executed ? "true" : "false", result.actualPosition);

    bool success = postAck(commandId, result.executed, result.actualPosition, apiKey);

    if (success) {
        Serial.println("[ValveCommand] ACK sent successfully");
    } else {
        Serial.println("[ValveCommand] ACK failed");
    }

    return success;
}

int ValveCommand::moveServoTo(int targetPosition) {
    // Clamp target to valid range
    targetPosition = constrain(targetPosition, SERVO_POSITION_MIN, SERVO_POSITION_MAX);

    // Set servo PWM
    setServoPosition(targetPosition);

    // Wait for servo feedback
    return waitForServoPosition(targetPosition, COMMAND_EXECUTION_TIMEOUT);
}

void ValveCommand::setServoPosition(int position) {
    // Convert 0-100% to LEDC duty cycle
    // Using 13-bit resolution (8192 steps), we calculate duty from pulse width
    // duty = (pulse_width_us * 2^13) / (1,000,000 / frequency)
    // At 50Hz, period = 20,000 us, so duty = pulse_width * 8192 / 20000

    uint32_t pulseWidthUs = map(position, 0, 100, LEDC_SERVO_MIN_PULSE, LEDC_SERVO_MAX_PULSE);
    uint32_t duty = (pulseWidthUs * (1 << LEDC_DUTY_RES)) / (1000000 / LEDC_FREQUENCY);

    // Write to LEDC channel
    ledcWrite(LEDC_CHANNEL, duty);
    _currentPosition = position;

    Serial.printf("[ValveCommand] Set servo to %d%% (pulse=%lu us, duty=%lu)\n",
                  position, pulseWidthUs, duty);
}

int ValveCommand::waitForServoPosition(int targetPosition, unsigned long timeoutMs) {
    unsigned long startTime = millis();
    int tolerance = 3;  // 3% tolerance
    int stableCount = 0;
    const int stableThreshold = 3;  // Need 3 consecutive stable readings

    while ((millis() - startTime) < timeoutMs) {
        // Read actual position from servo feedback ADC
        int feedbackAdc = analogRead(SERVO_FEEDBACK_PIN);
        // Map ADC to position (assuming 0-3.3V maps to 0-100%)
        int actualPosition = map(feedbackAdc, 0, 4095, 0, 100);
        actualPosition = constrain(actualPosition, 0, 100);

        // Check if within tolerance
        if (abs(actualPosition - targetPosition) <= tolerance) {
            stableCount++;
            if (stableCount >= stableThreshold) {
                // Position reached and stable
                _currentPosition = actualPosition;
                return actualPosition;
            }
        } else {
            stableCount = 0;  // Reset if moved away
        }

        delay(50);  // Poll every 50ms
    }

    // Timeout - return last read position
    int feedbackAdc = analogRead(SERVO_FEEDBACK_PIN);
    int finalPosition = map(feedbackAdc, 0, 4095, 0, 100);
    finalPosition = constrain(finalPosition, 0, 100);
    _currentPosition = finalPosition;

    Serial.printf("[ValveCommand] Servo timeout (target=%d, final=%d)\n",
                  targetPosition, finalPosition);
    return finalPosition;
}

bool ValveCommand::postAck(const char* commandId, bool executed, int actualPosition, const char* apiKey) {
    WiFiClientSecure client;
    client.setTimeout(HTTP_TIMEOUT_MS / 1000);

    if (!client.connect(BACKEND_HOST, BACKEND_PORT)) {
        return false;
    }

    // Build ACK endpoint URL
    char ackUrl[128];
    snprintf(ackUrl, sizeof(ackUrl), "%s%s/ack", ENDPOINT_COMMAND_ACK, commandId);

    // Build JSON payload
    StaticJsonDocument<256> doc;
    doc["node_id"] = NODE_ID;
    doc["executed"] = executed;
    doc["actual_position"] = actualPosition;
    doc["timestamp"] = String(millis());

    char payload[256];
    serializeJson(doc, payload);

    // Build HTTP request
    char request[512];
    snprintf(request, sizeof(request),
             "POST %s HTTP/1.1\r\n"
             "Host: %s\r\n"
             "Content-Type: application/json\r\n"
             "Authorization: Bearer %s\r\n"
             "Content-Length: %d\r\n"
             "Connection: close\r\n"
             "\r\n"
             "%s",
             ackUrl, BACKEND_HOST, apiKey, strlen(payload), payload);

    if (client.print(request) == 0) {
        client.stop();
        return false;
    }

    // Read response (just check for 200 OK)
    unsigned long startTime = millis();
    bool success = false;

    while (client.connected() && (millis() - startTime) < HTTP_TIMEOUT_MS) {
        if (client.available()) {
            String line = client.readStringUntil('\n');
            if (line.startsWith("HTTP/1.1 200")) {
                success = true;
            }
        }
    }

    client.stop();
    return success;
}
