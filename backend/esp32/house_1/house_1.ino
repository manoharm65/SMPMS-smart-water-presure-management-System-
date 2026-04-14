#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <ctype.h>

// 🔹 LoRa Pins (ESP32)
#define SS 5
#define RST 14
#define DIO0 4

// 🔹 Node Config
#define NODE_ID "house_1"
#define FIRMWARE_VERSION "1.0.0"

// 🔹 EEPROM
#define EEPROM_SIZE        256
#define EEPROM_MAGIC_ADDR    0
#define EEPROM_API_KEY_ADDR 32
#define EEPROM_MAGIC_STR "SMPMS_HOUSE1_v1"

const char* WIFI_SSID = "Datta";
const char* WIFI_PASSWORD = "Manikya@107";
const char* TELEMETRY_URL = "http://10.24.24.212:3000/api/v1/esp/telemetry";
const char* REGISTER_URL = "http://10.24.24.212:3000/api/v1/nodes/register";

const float DEFAULT_PRESSURE_BAR = 0.0f;
const int DEFAULT_VALVE_POSITION = 0;

float latestFlow = 0;
char apiKeyBuf[65] = {0};

// 🔹 Logging
#define LOG(x) Serial.println(String("[LOG] ") + x)

bool loadStoredApiKey() {
  char magic[32] = {0};
  for (int i = 0; i < 32; i++) {
    magic[i] = EEPROM.read(EEPROM_MAGIC_ADDR + i);
  }

  if (strncmp(magic, EEPROM_MAGIC_STR, strlen(EEPROM_MAGIC_STR)) != 0) {
    return false;
  }

  for (int i = 0; i < 64; i++) {
    apiKeyBuf[i] = EEPROM.read(EEPROM_API_KEY_ADDR + i);
  }
  apiKeyBuf[64] = '\0';

  return apiKeyBuf[0] != '\0';
}

void saveApiKey(const char* apiKey) {
  for (int i = 0; i < 32; i++) {
    char ch = (i < (int)strlen(EEPROM_MAGIC_STR)) ? EEPROM_MAGIC_STR[i] : '\0';
    EEPROM.write(EEPROM_MAGIC_ADDR + i, ch);
  }

  int keyLen = strlen(apiKey);
  for (int i = 0; i < 64; i++) {
    char ch = (i < keyLen) ? apiKey[i] : '\0';
    EEPROM.write(EEPROM_API_KEY_ADDR + i, ch);
  }

  EEPROM.commit();
}

bool registerNode() {
  if (WiFi.status() != WL_CONNECTED) {
    LOG("Register skipped: WiFi not connected");
    return false;
  }

  HTTPClient http;
  http.begin(REGISTER_URL);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["nodeId"] = NODE_ID;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["ipAddress"] = WiFi.localIP().toString();

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);
  if (code != 200 && code != 201) {
    LOG("Register failed HTTP: " + String(code) + " (" + HTTPClient::errorToString(code) + ")");
    String body = http.getString();
    if (body.length() > 0) {
      LOG("Register error body: " + body);
    }
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  StaticJsonDocument<512> response;
  DeserializationError err = deserializeJson(response, body);
  if (err) {
    LOG("Register JSON parse failed");
    return false;
  }

  const char* key = response["api_key"] | "";
  if (strlen(key) == 0) {
    LOG("Register response missing api_key");
    return false;
  }

  strncpy(apiKeyBuf, key, 64);
  apiKeyBuf[64] = '\0';
  saveApiKey(apiKeyBuf);

  LOG("Node registered. API key saved");
  return true;
}

bool parseFlowPacket(const String& packet, float& flowOut) {
  if (!packet.startsWith("Flow:")) {
    return false;
  }

  String value = packet.substring(5);
  value.trim();
  if (value.length() == 0) {
    return false;
  }

  char numBuf[24] = {0};
  value.toCharArray(numBuf, sizeof(numBuf));
  char* endPtr = nullptr;
  float parsed = strtof(numBuf, &endPtr);
  if (endPtr == numBuf || *endPtr != '\0') {
    return false;
  }

  flowOut = parsed;
  return true;
}

String isoTimestamp() {
  unsigned long secs = millis() / 1000;
  char buf[32];
  snprintf(buf, sizeof(buf), "2026-01-01T%02lu:%02lu:%02luZ",
           (secs / 3600) % 24,
           (secs / 60) % 60,
           secs % 60);
  return String(buf);
}

// -------------------- WIFI --------------------
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  LOG("Connecting WiFi...");

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    
    if (millis() - start > 15000) {
      LOG("WiFi timeout");
      return;
    }
  }

  LOG("WiFi Connected");
  LOG("IP: " + WiFi.localIP().toString());
}

// -------------------- SEND TELEMETRY --------------------
void sendTelemetry(float flow) {
  if (WiFi.status() != WL_CONNECTED) {
    LOG("WiFi disconnected. Reconnecting...");
    WiFi.reconnect();
    delay(500);
    if (WiFi.status() != WL_CONNECTED) {
      LOG("Telemetry skipped: WiFi not connected");
      return;
    }
  }
  if (apiKeyBuf[0] == '\0' && !registerNode()) {
    LOG("No API key; telemetry skipped");
    return;
  }

  HTTPClient http;
  http.begin(TELEMETRY_URL);
  http.setTimeout(3000);  // ✅ prevent long blocking
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(apiKeyBuf));

  StaticJsonDocument<200> doc;
  doc["nodeId"] = NODE_ID;
  doc["pressure"] = DEFAULT_PRESSURE_BAR;
  doc["valvePosition"] = DEFAULT_VALVE_POSITION;
  doc["timestamp"] = isoTimestamp();
  doc["flowSensor"] = flow;

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);

  if (code < 0) {
    LOG("Sent -> Flow: " + String(flow) + " | HTTP: " + String(code) + " (" + HTTPClient::errorToString(code) + ")");
    LOG("Telemetry URL: " + String(TELEMETRY_URL));
    LOG("WiFi IP: " + WiFi.localIP().toString() + " | RSSI: " + String(WiFi.RSSI()));
  } else {
    LOG("Sent -> Flow: " + String(flow) + " | HTTP: " + String(code));
    if (code == 401) {
      LOG("401 Unauthorized. Trying fresh registration...");
      apiKeyBuf[0] = '\0';
      registerNode();
    }
  }

  http.end();

  // ✅ IMPORTANT: Re-enable continuous RX
  LoRa.receive();
}

// -------------------- SETUP --------------------
void setup() {
  Serial.begin(115200);
  EEPROM.begin(EEPROM_SIZE);
  if (loadStoredApiKey()) {
    LOG("Loaded API key from EEPROM");
  }

  // 🔥 1. INIT LORA FIRST (NON-BLOCKING)
  LoRa.setPins(SS, RST, DIO0);

  if (!LoRa.begin(433E6)) {
    LOG("LoRa FAIL");
    while (1);
  }

  // 🔥 2. FORCE SAME SETTINGS AS TRANSMITTER
  LoRa.setSyncWord(0xF3);
  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);

  // 🔥 3. ENTER CONTINUOUS RECEIVE MODE
  LoRa.receive();

  LOG("LoRa Receiver Ready");

  // 🔥 4. WIFI AFTER LORA
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    registerNode();
  }
}

// -------------------- LOOP --------------------
void loop() {

  int packetSize = LoRa.parsePacket();

  if (packetSize) {
    String received = "";

    while (LoRa.available()) {
      char ch = (char)LoRa.read();
      if (isprint((unsigned char)ch)) {
        received += ch;
      }
    }

    int rssi = LoRa.packetRssi();

    float flow = 0.0f;
    if (parseFlowPacket(received, flow)) {
      LOG("RX Flow: " + String(flow, 2) + " | RSSI: " + String(rssi));
      latestFlow = flow;
      sendTelemetry(flow);
    } else {
      LOG("Ignored noisy LoRa packet");
    }
  }
}
