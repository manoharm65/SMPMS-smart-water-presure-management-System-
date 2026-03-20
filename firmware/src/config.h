/**
 * SMPMS ESP32 Firmware - Configuration
 *
 * Smart Pressure Management System - Edge Node Configuration
 *
 * IMPORTANT: All sensitive values (API key, WiFi credentials) are stored
 * in EEPROM after registration and loaded at boot. No hardcoded credentials.
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ============================================================================
// Node Identity (Hardcoded per device - set at factory)
// ============================================================================
#define NODE_ID "DMA-01"  // Change per device: DMA-01 through DMA-08
#define FIRMWARE_VERSION "1.0.0"

// ============================================================================
// Hardware Pin Definitions
// ============================================================================
// Using user's existing wiring:
//   A0 (GPIO 36)  = Pressure sensor analog output
//   GPIO 9         = Servo PWM control
//   GPIO 2         = Flow sensor interrupt (optional)
//   GPIO 2         = Blue LED (status)
//   GPIO 4         = Red LED (error)
//   GPIO 33        = Amber LED (offline)

#define PRESSURE_SENSOR_PIN    36    // A0 - Analog input for pressure sensor
#define SERVO_CONTROL_PIN      9     // PWM output for servo control
#define SERVO_FEEDBACK_PIN     35    // Analog input for servo position feedback
#define STATUS_LED_BLUE        2     // Blue LED - Online
#define STATUS_LED_RED         4     // Red LED - Error
#define STATUS_LED_AMBER       33    // Amber LED - Offline/Fallback

// ============================================================================
// Sensor Calibration Constants
// ============================================================================
#define PRESSURE_SENSOR_MIN_VOLTAGE   0.0f    // 0V = 0 BAR
#define PRESSURE_SENSOR_MAX_VOLTAGE   5.0f    // 5V = 20 BAR
#define PRESSURE_SENSOR_MIN_BAR       0.0f    // Minimum pressure (BAR)
#define PRESSURE_SENSOR_MAX_BAR        20.0f   // Maximum pressure (BAR)
#define SERVO_POSITION_MIN            0       // Servo fully closed (0%)
#define SERVO_POSITION_MAX            100     // Servo fully open (100%)

// ============================================================================
// Timing Constants (milliseconds)
// ============================================================================
#define TELEMETRY_INTERVAL_DEFAULT     10000   // 10 seconds (set by backend)
#define TELEMETRY_INTERVAL_MIN         5000    // 5 seconds minimum
#define TELEMETRY_INTERVAL_MAX         60000   // 60 seconds maximum

#define COMMAND_EXECUTION_TIMEOUT      5000    // 5 seconds max for servo movement
#define REGISTRATION_RETRY_BASE        1000    // 1 second base retry delay
#define REGISTRATION_RETRY_MAX         30000   // 30 seconds max retry delay
#define OFFLINE_RECONNECT_INTERVAL     30000   // 30 seconds between reconnect attempts
#define WATCHDOG_TIMEOUT_MS            8000    // Hardware WDT timeout

#define BUFFERED_READINGS_MAX          50      // Max readings to buffer offline
#define EEPROM_SIZE                    512     // EEPROM size for ESP32

// ============================================================================
// Pressure Thresholds (loaded from backend after registration)
// ============================================================================
struct PressureThresholds {
    float critical_high;
    float warning_high;
    float normal_low;
    float critical_low;
};

// Default thresholds (used before registration)
#define DEFAULT_CRITICAL_HIGH  15.0f   // BAR - Critical high threshold
#define DEFAULT_WARNING_HIGH   12.0f  // BAR - Warning high threshold
#define DEFAULT_NORMAL_LOW     3.0f    // BAR - Normal low threshold
#define DEFAULT_CRITICAL_LOW   1.5f    // BAR - Critical low threshold

// ============================================================================
// Offline Fallback Rules
// ============================================================================
#define OFFLINE_VALVE_ADJUST_PERCENT   20      // % to adjust valve in offline mode

// ============================================================================
// API Endpoints (Backend Server)
// ============================================================================
#define BACKEND_HOST       "smpms-backend.example.com"  // Configured at compile or runtime
#define BACKEND_PORT       443
#define API_BASE_URL       "/api/v1"

// Registration
#define ENDPOINT_REGISTER      API_BASE_URL "/nodes/register"

// Telemetry
#define ENDPOINT_TELEMETRY     API_BASE_URL "/telemetry"
#define ENDPOINT_TELEMETRY_SYNC API_BASE_URL "/telemetry/sync"

// Commands
#define ENDPOINT_COMMAND_ACK   API_BASE_URL "/commands/"  // + commandId + "/ack"

// ============================================================================
// HTTP/HTTPS Settings
// ============================================================================
#define HTTP_TIMEOUT_MS         10000   // 10 seconds HTTP timeout
#define HTTPS_BUFFER_SIZE      4096     // Response buffer size

// ============================================================================
// State Machine States
// ============================================================================
enum NodeState {
    STATE_BOOT,           // Initial boot
    STATE_REGISTERING,    // Attempting registration
    STATE_ONLINE,         // Connected, normal operation
    STATE_OFFLINE,        // Lost connection, using fallback
    STATE_ERROR           // Fatal error, halted
};

// ============================================================================
// Configuration Validation
// ============================================================================
static inline bool isValidPressure(float pressure) {
    return pressure >= 0.0f && pressure <= PRESSURE_SENSOR_MAX_BAR;
}

static inline bool isValidValvePosition(int position) {
    return position >= SERVO_POSITION_MIN && position <= SERVO_POSITION_MAX;
}

static inline bool isValidTelemetryInterval(uint32_t interval) {
    return interval >= TELEMETRY_INTERVAL_MIN && interval <= TELEMETRY_INTERVAL_MAX;
}

#endif // CONFIG_H
