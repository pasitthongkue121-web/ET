/*
  =============================================================================
  ⚡ ENERGY TWINS AI — ESP32 Smart Energy Meter Firmware
  =============================================================================
  Target Hardware: ESP32 Dev Module (ESP-WROOM-32 / NodeMCU-32S)
  Supported Sensors:
    1. PZEM-004T v3.0 (AC Voltage, Current, Power, Energy via UART Serial2)
    2. DHT11 / DHT22 (Ambient Temperature & Humidity via GPIO4)
    3. Built-in Virtual Sensor Mode (จำลองการทำงานได้ทันทีโดยไม่ต้องต่อเซนเซอร์ภายนอก!)

  Destination Modes (เลือกช่องทางการส่งข้อมูลได้ตามต้องการ):
    - MODE 1: ENERGY TWIN Cloud Backend API (แนะนำที่สุด — ข้อมูลขึ้นเว็บทันที)
    - MODE 2: Google Apps Script Web App (ส่งตรงเข้า Google Sheets)
    - MODE 3: Dual Mode (ส่งทั้ง Backend และ Google Sheets พร้อมกัน)
  =============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

// -----------------------------------------------------------------------------
// 1. CONFIGURATION (ตั้งค่าการเชื่อมต่อ Wi-Fi และเซิร์ฟเวอร์)
// -----------------------------------------------------------------------------

// ใส่ชื่อและรหัสผ่าน Wi-Fi ของคุณ (รองรับ 2.4 GHz)
const char* WIFI_SSID     = "YOUR_WIFI_NAME";        // << ชื่อ Wi-Fi
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";    // << รหัสผ่าน Wi-Fi

// เลือกโหมดการส่งข้อมูล (Destination):
//   1 = ส่งเข้า ENERGY TWIN Cloud Backend (แนะนำ - แสดงผลบน Dashboard ทันที)
//   2 = ส่งตรงเข้า Google Sheets Web App (Apps Script)
//   3 = ส่งทั้งสองที่ (Dual Mode: ทั้ง Backend และ Google Sheets)
#define TARGET_MODE 1

// URL ปลายทางของ ENERGY TWIN Backend API
const char* BACKEND_API_URL = "https://energy-twins-ai.onrender.com/api/energy";

// URL ของ Google Apps Script Web App (กรณีเลือกโหมด 2 หรือ 3)
const char* GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwx0nIl9fswC9mtNivXEv4gzeKh0O07bImCEAe6XV2VEQZT7ObKdSP5L4CHg4UaneSf/exec";

// รหัสประจำอุปกรณ์ (Device ID):
// แนะนำให้ตรงกับวงจรในระบบ ENERGY TWINS:
// - "circuit_heavy_load"  (โหลดหนัก: แอร์, เครื่องทำน้ำอุ่น)
// - "circuit_receptacle"  (เต้ารับปลั๊กไฟทั่วไป)
// - "circuit_lighting"    (วงจรแสงสว่าง)
// - "circuit_ev"          (แท่นชาร์จรถยนต์ไฟฟ้า)
// - "circuit_solar"       (แผงโซลาร์เซลล์)
const char* DEVICE_ID = "circuit_heavy_load";

// ความถี่ในการส่งข้อมูล (มิลลิวินาที) — ค่าเริ่มต้น 15 วินาที
const unsigned long SEND_INTERVAL_MS = 15000;

// -----------------------------------------------------------------------------
// 2. HARDWARE & SENSOR CONFIGURATION
// -----------------------------------------------------------------------------

// ตั้งเป็น true เพื่อใช้โหมดจำลอง (ไม่ต้องต่อเซนเซอร์จริง)
// ตั้งเป็น false หากต่อเซนเซอร์ PZEM-004T หรือ DHT จริง
#define USE_VIRTUAL_SENSOR true

#define LED_PIN 2  // ขาไฟ LED สีน้ำเงินบนบอร์ด ESP32 (แสดงสถานะ)

// การต่อสายฮาร์ดแวร์จริง (กรณี USE_VIRTUAL_SENSOR = false):
// PZEM-004T v3.0:
//   - RX Pin (ESP32) -> GPIO 16 (RX2)
//   - TX Pin (ESP32) -> GPIO 17 (TX2)
// DHT11 / DHT22:
//   - Data Pin       -> GPIO 4
#if !USE_VIRTUAL_SENSOR
  #include <PZEM004Tv30.h>
  #include <DHT.h>
  #define PZEM_RX_PIN 16
  #define PZEM_TX_PIN 17
  #define DHT_PIN     4
  #define DHT_TYPE    DHT11
  
  PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);
  DHT dht(DHT_PIN, DHT_TYPE);
#endif

// NTP Server Settings สำหรับซิงค์เวลาจริง (UTC+7 ประเทศไทย)
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600;
const int   daylightOffset_sec = 0;

unsigned long lastSendTime = 0;
float cumulativeKwh = 0.50; // หน่วยพลังงานสะสมเริ่มต้น (kWh)

// -----------------------------------------------------------------------------
// 3. DATA STRUCTURE
// -----------------------------------------------------------------------------
struct EnergyReading {
  float voltage;      // แรงดันไฟฟ้า (V)
  float current;      // กระแสไฟฟ้า (A)
  float power;        // กำลังไฟฟ้า (W)
  float energy;       // พลังงานสะสม (kWh)
  float temperature;  // อุณหภูมิ (°C)
  float humidity;     // ความชื้นสัมพัทธ์ (%RH)
  bool  occupancy;    // สถานะมีผู้อยู่อาศัย (true/false)
};

// -----------------------------------------------------------------------------
// 4. HELPER FUNCTIONS
// -----------------------------------------------------------------------------
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

  Serial.println();
  Serial.print("[WiFi] กำลังเชื่อมต่อกับ: ");
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
    Serial.println("\n[WiFi] เชื่อมต่อสำเร็จ! ✅");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("\n[WiFi] ไม่สามารถเชื่อมต่อได้ จะลองใหม่ในรอบถัดไป ❌");
    digitalWrite(LED_PIN, LOW);
  }
}

// -----------------------------------------------------------------------------
// 5. SENSOR READING ENGINE
// -----------------------------------------------------------------------------
EnergyReading readSensors() {
  EnergyReading r;

#if USE_VIRTUAL_SENSOR
  // โหมดจำลองโหลดเครื่องใช้ไฟฟ้าอัจฉริยะ (เช่น เครื่องปรับอากาศ Inverter)
  static unsigned long cycle = 0;
  cycle++;

  // แรงดันไฟฟ้าไทยทั่วไป ~220-230V
  r.voltage = 225.0 + (random(-30, 30) / 10.0);

  // วงจรการทำงานของคอมเพรสเซอร์แอร์
  int phase = (cycle % 12);
  if (phase < 3) {
    r.power = 1350.0 + random(-50, 50); // เร่งความเย็น
  } else if (phase < 8) {
    r.power = 820.0 + random(-30, 30);  // ประคองอุณหภูมิ Inverter
  } else {
    r.power = 65.0 + random(-10, 10);   // สแตนด์บาย/พัดลม
  }

  r.current = r.power / r.voltage;

  // คำนวณพลังงานสะสม (kWh) = Power(W) * Hours / 1000
  float kwhDelta = (r.power * (SEND_INTERVAL_MS / 1000.0)) / 3600000.0;
  cumulativeKwh += kwhDelta;
  r.energy = cumulativeKwh;

  r.temperature = 26.5 + (random(-15, 15) / 10.0);
  r.humidity = 60.0 + (random(-20, 20) / 10.0);
  r.occupancy = true;

#else
  // โหมดอ่านจากเซนเซอร์จริง
  float v = pzem.voltage();
  float i = pzem.current();
  float p = pzem.power();
  float e = pzem.energy();

  r.voltage = (!isnan(v)) ? v : 220.0;
  r.current = (!isnan(i)) ? i : 0.0;
  r.power   = (!isnan(p)) ? p : 0.0;
  r.energy  = (!isnan(e)) ? e : cumulativeKwh;

  float t = dht.readTemperature();
  float h = dht.readHumidity();
  r.temperature = (!isnan(t)) ? t : 27.0;
  r.humidity    = (!isnan(h)) ? h : 60.0;
  r.occupancy   = true;
#endif

  return r;
}

// -----------------------------------------------------------------------------
// 6. TRANSMISSION FUNCTIONS (ส่งข้อมูลสู่เซิร์ฟเวอร์)
// -----------------------------------------------------------------------------

// สร้าง JSON Payload ตามสเปกของ ENERGY TWINS AI
String buildJsonPayload(const EnergyReading& r, const String& timeStr) {
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"voltage\":" + String(r.voltage, 1) + ",";
  json += "\"current\":" + String(r.current, 2) + ",";
  json += "\"power\":" + String(r.power, 1) + ",";
  json += "\"energy\":" + String(r.energy, 4) + ",";
  json += "\"temperature\":" + String(r.temperature, 1) + ",";
  json += "\"humidity\":" + String(r.humidity, 1) + ",";
  json += "\"occupancy\":" + String(r.occupancy ? "true" : "false");
  if (timeStr != "") {
    json += ",\"timestamp\":\"" + timeStr + "\"";
  }
  json += "}";
  return json;
}

// ฟังก์ชันส่งข้อมูลเข้า ENERGY TWIN Cloud Backend (Render.com)
bool postToEnergyTwinBackend(const String& payload) {
  WiFiClientSecure client;
  client.setInsecure(); // ไม่ตรวจสอบ SSL cert เพื่อความเสถียรบน ESP32

  HTTPClient http;
  http.setTimeout(12000);

  if (!http.begin(client, BACKEND_API_URL)) {
    Serial.println("[HTTP] ไม่สามารถเปิดการเชื่อมต่อไปยัง Backend ได้");
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  Serial.println("[HTTP] กำลังส่งข้อมูลไปยัง ENERGY TWIN Backend API...");
  int httpCode = http.POST(payload);
  bool success = false;

  if (httpCode > 0) {
    Serial.printf("[HTTP-Backend] ตอบกลับ Status: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
      String resp = http.getString();
      Serial.println("[HTTP-Backend] ข้อมูลเข้าสู่ระบบสำเร็จ! ✅");
      Serial.println(resp);
      success = true;
    }
  } else {
    Serial.printf("[HTTP-Backend] ส่งไม่สำเร็จ Error: %s ❌\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}

// ฟังก์ชันส่งข้อมูลเข้า Google Sheets Web App (Apps Script)
bool postToGoogleSheets(const String& payload) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); // ต้องตาม HTTP 302 Redirect ของ Google
  http.setTimeout(15000);

  if (!http.begin(client, GOOGLE_SCRIPT_URL)) {
    Serial.println("[HTTP] ไม่สามารถเปิดการเชื่อมต่อไปยัง Google Apps Script ได้");
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  Serial.println("[HTTP] กำลังส่งข้อมูลไปยัง Google Sheets Web App...");
  int httpCode = http.POST(payload);
  bool success = false;

  if (httpCode > 0) {
    Serial.printf("[HTTP-GSheet] ตอบกลับ Status: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK || httpCode == 302) {
      Serial.println("[HTTP-GSheet] ส่งเข้า Google Sheets สำเร็จ! ✅");
      success = true;
    }
  } else {
    Serial.printf("[HTTP-GSheet] ส่งไม่สำเร็จ Error: %s ❌\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}

// ฟังก์ชันรวมตามโหมด TARGET_MODE
void sendTelemetry(const EnergyReading& r) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  String timeStr = getCurrentTimeString();
  String payload = buildJsonPayload(r, timeStr);

  Serial.println("\n--------------------------------------------------");
  Serial.print("📦 Telemetry Payload [");
  Serial.print(DEVICE_ID);
  Serial.println("]:");
  Serial.println(payload);
  Serial.printf("⚡ Power: %.1f W | Energy: %.4f kWh | V: %.1f V | I: %.2f A\n", 
                r.power, r.energy, r.voltage, r.current);

  bool ok = false;

  #if TARGET_MODE == 1
    // โหมด 1: ส่งเข้า ENERGY TWIN Backend API โดยตรง (แนะนำ)
    ok = postToEnergyTwinBackend(payload);
  #elif TARGET_MODE == 2
    // โหมด 2: ส่งเข้า Google Sheets Web App
    ok = postToGoogleSheets(payload);
  #elif TARGET_MODE == 3
    // โหมด 3: ส่งทั้ง Backend และ Google Sheets
    bool ok1 = postToEnergyTwinBackend(payload);
    bool ok2 = postToGoogleSheets(payload);
    ok = ok1 || ok2;
  #endif

  // กะพริบไฟ LED สีน้ำเงิน แสดงว่าส่งสำเร็จ
  if (ok) {
    digitalWrite(LED_PIN, LOW);
    delay(120);
    digitalWrite(LED_PIN, HIGH);
  }
}

// -----------------------------------------------------------------------------
// 7. SETUP & MAIN LOOP
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n==================================================");
  Serial.println("   ⚡ ENERGY TWINS AI — ESP32 Smart Energy Meter   ");
  Serial.println("==================================================");

  #if TARGET_MODE == 1
    Serial.println("🎯 โหมดปลายทาง: 1. ENERGY TWIN Backend API (Render)");
  #elif TARGET_MODE == 2
    Serial.println("🎯 โหมดปลายทาง: 2. Google Sheets Web App");
  #elif TARGET_MODE == 3
    Serial.println("🎯 โหมดปลายทาง: 3. Dual Mode (ทั้ง Backend และ Google Sheets)");
  #endif

  #if USE_VIRTUAL_SENSOR
    Serial.println("🔧 เซนเซอร์: Virtual Sensor Mode (จำลองการทำงาน)");
  #else
    Serial.println("🔧 เซนเซอร์: ฮาร์ดแวร์จริง (PZEM-004T + DHT)");
    pzem.resetEnergy();
    dht.begin();
  #endif

  connectWiFi();

  // ซิงค์เวลาจากอินเทอร์เน็ต
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("[NTP] กำลังซิงค์เวลาจาก NTP Server...");
}

void loop() {
  unsigned long now = millis();

  // ตรวจสอบและส่งข้อมูลตามรอบเวลาที่กำหนด
  if (now - lastSendTime >= SEND_INTERVAL_MS || lastSendTime == 0) {
    lastSendTime = now;

    EnergyReading reading = readSensors();
    sendTelemetry(reading);
  }

  delay(50);
}
