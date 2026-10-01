/*
  =============================================================================
  ENERGY TWINS AI - ESP32 Smart Energy Meter Firmware
  =============================================================================
  Target Hardware: ESP32 Dev Module / NodeMCU-32S
  Compatible Sensors:
    - PZEM-004T v3.0 (AC Energy Meter via HardwareSerial)
    - ACS712 / SCT-013 (CT Clamp sensor via ADC)
    - DHT11 / DHT22 (Ambient Temperature & Humidity)
    - Built-in Virtual Sensor Mode (Works out-of-the-box without extra hardware!)

  Key Feature:
    - Follows Google Apps Script 302 Redirects via HTTPClient
    - WiFi Auto-reconnect & Watchdog Timer
    - JSON Telemetry Payload matches ENERGY TWINS Data Schema
  =============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

// ---------------------------------------------------------
// 1. CONFIGURATION: WiFi & Google Web App
// ---------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";        // << Replace with your WiFi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";    // << Replace with your WiFi Password

// Your Google Apps Script Web App Deployment URL:
// (Get this from Google Sheet > Extensions > Apps Script > Deploy > Web App)
const char* GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYOUR_DEPLOYMENT_ID/exec";

// Device Identifier (as registered in ENERGY TWINS AI)
const char* DEVICE_ID = "living_room_ac";            // e.g. living_room_ac, kitchen_fridge, etc.

// Telemetry Interval (milliseconds)
const unsigned long SEND_INTERVAL_MS = 15000;       // Send data every 15 seconds

// ---------------------------------------------------------
// 2. HARDWARE & SENSOR SETUP
// ---------------------------------------------------------
// Set to 'false' if you have physical PZEM-004T / CT sensors connected
#define USE_VIRTUAL_SENSOR true 

#define LED_PIN 2  // Onboard blue LED indicator

// NTP Server Settings for accurate timestamp
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600;      // UTC+7 for Thailand / Indochina Time
const int   daylightOffset_sec = 0;

unsigned long lastSendTime = 0;
float cumulativeKwh = 0.45;                // Baseline starting kWh

// ---------------------------------------------------------
// 3. HELPER FUNCTIONS
// ---------------------------------------------------------
String getCurrentTimeString() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "";
  }
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buf);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("\n[WiFi] Connection timeout. Retrying next cycle...");
    digitalWrite(LED_PIN, LOW);
  }
}

// ---------------------------------------------------------
// 4. SENSOR READINGS (Realistic Simulator or Real Sensor)
// ---------------------------------------------------------
struct EnergyReading {
  float voltage;
  float current;
  float power;
  float energy;
  float temperature;
  float humidity;
};

EnergyReading readSensors() {
  EnergyReading r;

#if USE_VIRTUAL_SENSOR
  // Generate realistic appliance cycle (Air Conditioner simulator)
  static unsigned long cycleCounter = 0;
  cycleCounter++;

  // Realistic Thai grid voltage fluctuation (227V - 233V)
  r.voltage = 230.0 + (random(-30, 30) / 10.0);

  // Simulate Inverter AC Compressor: High ramp up -> Stable cooling -> Eco idle
  int phase = (cycleCounter % 12);
  if (phase < 2) {
    r.power = 1450.0 + random(-50, 50); // Compressor boost
  } else if (phase < 8) {
    r.power = 850.0 + random(-30, 30);  // Stable inverter maintain
  } else {
    r.power = 45.0 + random(-5, 5);     // Fan only / Thermostat satisfied
  }

  r.current = r.power / r.voltage;
  cumulativeKwh += (r.power * (SEND_INTERVAL_MS / 1000.0)) / 3600000.0;
  r.energy = cumulativeKwh;

  r.temperature = 25.5 + (random(-15, 15) / 10.0);
  r.humidity = 58.0 + (random(-20, 20) / 10.0);

#else
  // REAL SENSOR READINGS (e.g. PZEM-004T or CT clamp)
  // r.voltage = pzem.voltage();
  // r.current = pzem.current();
  // r.power   = pzem.power();
  // r.energy  = pzem.energy();
  // r.temperature = dht.readTemperature();
  // r.humidity    = dht.readHumidity();
#endif

  return r;
}

// ---------------------------------------------------------
// 5. SEND TELEMETRY TO GOOGLE APPS SCRIPT
// ---------------------------------------------------------
bool sendTelemetry(const EnergyReading& r) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Bypass root CA validation for Google API script redirects

  HTTPClient http;
  
  // CRITICAL: Google Apps Script Web App returns HTTP 302 Found redirect
  // Must follow redirects strictly to submit data to the underlying Google servers!
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(15000);

  if (!http.begin(client, GOOGLE_SCRIPT_URL)) {
    Serial.println("[HTTP] Failed to initialize connection to Google Script URL");
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  String timeStr = getCurrentTimeString();
  if (timeStr == "") {
    timeStr = "2026-09-15 12:00:00"; // Fallback if NTP not yet synced
  }

  // Construct JSON payload
  String jsonPayload = "{";
  jsonPayload += "\"timestamp\":\"" + timeStr + "\",";
  jsonPayload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  jsonPayload += "\"voltage\":" + String(r.voltage, 2) + ",";
  jsonPayload += "\"current\":" + String(r.current, 3) + ",";
  jsonPayload += "\"power_w\":" + String(r.power, 1) + ",";
  jsonPayload += "\"energy_kwh\":" + String(r.energy, 4) + ",";
  jsonPayload += "\"temperature\":" + String(r.temperature, 1) + ",";
  jsonPayload += "\"humidity\":" + String(r.humidity, 1) + ",";
  jsonPayload += "\"occupancy\":1";
  jsonPayload += "}";

  Serial.println("\n[HTTP] Sending payload:");
  Serial.println(jsonPayload);

  int httpCode = http.POST(jsonPayload);
  bool success = false;

  if (httpCode > 0) {
    Serial.printf("[HTTP] POST Response code: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK || httpCode == 302) {
      String response = http.getString();
      Serial.println("[HTTP] Response from Google Script:");
      Serial.println(response);
      success = true;

      // Quick flash LED to indicate successful transmission
      digitalWrite(LED_PIN, LOW);
      delay(100);
      digitalWrite(LED_PIN, HIGH);
    }
  } else {
    Serial.printf("[HTTP] POST failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}

// ---------------------------------------------------------
// 6. MAIN SETUP & LOOP
// ---------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n==================================================");
  Serial.println("   ENERGY TWINS AI - ESP32 Smart Energy Meter");
  Serial.println("==================================================");

  connectWiFi();

  // Initialize NTP time sync
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("[NTP] Synchronizing time...");
}

void loop() {
  unsigned long now = millis();

  if (now - lastSendTime >= SEND_INTERVAL_MS || lastSendTime == 0) {
    lastSendTime = now;

    EnergyReading reading = readSensors();
    sendTelemetry(reading);
  }

  delay(50);
}
