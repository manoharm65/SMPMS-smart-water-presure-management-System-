#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define SS    5
#define RST   14
#define DIO0  4
#define FLOW_PIN 13

#define I2C_SDA 32
#define I2C_SCL 33

LiquidCrystal_I2C lcd(0x27, 16, 2);

volatile int pulseCount = 0;
float flowRate = 0;
unsigned long lastTime = 0;

// 🔹 Logging Macros
#define LOG_INFO(msg)  Serial.println("[INFO] " + String(millis()) + " | " + msg)
#define LOG_WARN(msg)  Serial.println("[WARN] " + String(millis()) + " | " + msg)
#define LOG_ERROR(msg) Serial.println("[ERROR] " + String(millis()) + " | " + msg)

void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

void setup() {
  Serial.begin(9600);
  delay(500);

  LOG_INFO("Booting system...");

  // I2C Init
  Wire.begin(I2C_SDA, I2C_SCL);
  LOG_INFO("I2C initialized");

  // LCD Init
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("LoRa Flow Meter");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  LOG_INFO("LCD initialized");

  // Flow Sensor Init
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, FALLING);
  LOG_INFO("Flow sensor interrupt attached");

  // LoRa Init
  LoRa.setPins(SS, RST, DIO0);
  if (!LoRa.begin(433E6)) {
    LOG_ERROR("LoRa initialization FAILED");
    lcd.clear();
    lcd.print("LoRa FAILED!");
    while (1);
  }

  LOG_INFO("LoRa initialized successfully");

  lcd.clear();
  lcd.print("Transmitter OK");
  delay(1000);
  lcd.clear();
}

void loop() {
  if (millis() - lastTime > 1000) {
    detachInterrupt(digitalPinToInterrupt(FLOW_PIN));

    // Calculate flow
    flowRate = pulseCount / 7.5;
    int pulses = pulseCount;

    pulseCount = 0;
    lastTime = millis();

    // 🔹 Log sensor data
    LOG_INFO("Pulses: " + String(pulses) + 
             " | Flow Rate: " + String(flowRate, 2) + " L/min");

    // LCD display
    lcd.setCursor(0, 0);
    lcd.print("Flow Rate:      ");
    lcd.setCursor(0, 1);
    lcd.print(flowRate, 2);
    lcd.print(" L/min      ");

    // Create payload
    String payload = "Flow:" + String(flowRate, 2);

    // 🔹 Log before sending
    LOG_INFO("Sending LoRa packet: " + payload);

    // LoRa transmit
    int result = LoRa.beginPacket();
    if (result == 0) {
      LOG_WARN("LoRa beginPacket failed");
    }

    LoRa.print(payload);
    int status = LoRa.endPacket();

    // 🔹 Transmission result
    if (status == 1) {
      LOG_INFO("LoRa packet sent successfully");
    } else {
      LOG_ERROR("LoRa transmission failed");
    }

    attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, FALLING);
  }
}