#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <SPIFFS.h> // หรือ <LittleFS.h> ถ้าใช้ LittleFS

// ข้อมูล Wi-Fi (ถ้า ESP32 เป็น Station Mode)
const char* ssid = "YOUR_WIFI_SSID";         // เปลี่ยนเป็นชื่อ Wi-Fi ของคุณ
const char* password = "YOUR_WIFI_PASSWORD"; // เปลี่ยนเป็นรหัสผ่าน Wi-Fi ของคุณ

// หรือถ้าจะให้ ESP32 เป็น Access Point (AP) ให้สมาร์ทโฟนเชื่อมต่อตรง
const char* ap_ssid = "ESP32_DOOR_CONTROL";
const char* ap_password = "password123"; // รหัสผ่านสำหรับเชื่อมต่อ AP ของ ESP32

// กำหนดขา GPIO สำหรับควบคุม Relay (ตัวอย่างใช้ GPIO 2)
// แนะนำให้ใช้ขา GPIO ที่เหมาะสมกับ Relay ของคุณ
const int RELAY_PIN = 2; // เปลี่ยนตามขา GPIO ที่คุณใช้
const int RELAY_ON = LOW; // หรือ HIGH ขึ้นอยู่กับ Relay ของคุณว่าเป็น Active-LOW หรือ Active-HIGH
const int RELAY_OFF = HIGH; // ค่าตรงข้ามกับ RELAY_ON

AsyncWebServer server(80); // สร้าง Web Server บนพอร์ต 80

void setup() {
  Serial.begin(115200);
  delay(1000);

  // ตั้งค่าขา GPIO สำหรับ Relay
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF); // ตั้งค่าเริ่มต้นให้ประตู "ปิด" (Relay ปิด)

  // เริ่มต้นระบบไฟล์ SPIFFS/LittleFS
  // ตรวจสอบว่าใช้ SPIFFS หรือ LittleFS แล้วเปลี่ยนฟังก์ชันให้ถูกต้อง
  if (!SPIFFS.begin(true)) { // ใช้ true เพื่อฟอร์แมตหากเริ่มต้นไม่สำเร็จ
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }
  Serial.println("SPIFFS mounted successfully");

  // ----- โหมดการเชื่อมต่อ Wi-Fi -----
  // เลือกเพียง 1 โหมด: Station Mode หรือ Access Point Mode

  // 1. โหมด Station (ESP32 เชื่อมต่อ Wi-Fi บ้านของคุณ)
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  /*
  // 2. โหมด Access Point (ESP32 สร้าง Wi-Fi Hotspot ให้สมาร์ทโฟนเชื่อมต่อตรง)
  // ให้ uncomment โค้ดส่วนนี้และคอมเมนต์ส่วน Station Mode ด้านบน
  Serial.print("Setting up AP mode. SSID: ");
  Serial.println(ap_ssid);
  WiFi.softAP(ap_ssid, ap_password);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  */

  // ----- ตั้งค่า Web Server Routes -----

  // Route สำหรับหน้าหลัก (index.html)
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(SPIFFS, "/index.html", "text/html");
  });

  // Route สำหรับ CSS
  server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(SPIFFS, "/style.css", "text/css");
  });

  // Route สำหรับ JavaScript
  server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(SPIFFS, "/script.js", "application/javascript");
  });

  // Route สำหรับสั่ง "เปิด" ประตู
  server.on("/open", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("Received command: OPEN");
    digitalWrite(RELAY_PIN, RELAY_ON); // สั่ง Relay ให้เปิดประตู
    request->send(200, "text/plain", "Door is OPENING!");
  });

  // Route สำหรับสั่ง "ปิด" ประตู
  server.on("/close", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("Received command: CLOSE");
    digitalWrite(RELAY_PIN, RELAY_OFF); // สั่ง Relay ให้ปิดประตู
    request->send(200, "text/plain", "Door is CLOSING!");
  });

  // Route สำหรับสั่ง "หยุด" การทำงาน (ถ้ามี)
  // ในตัวอย่างนี้ เราจะให้หยุดการทำงานคือกลับไปสถานะ Relay OFF หรือ อาจจะเขียน Logic ที่ซับซ้อนกว่านี้
  server.on("/stop", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("Received command: STOP");
    // สำหรับประตูมอเตอร์ อาจจะต้องส่งสัญญาณ pulse สั้นๆ หรืออีกแบบ
    // ในตัวอย่างนี้ ถ้าประตูค้างอยู่ ก็จะสั่งให้ Relay กลับไปสถานะปิด (หยุดการทำงานของมอเตอร์)
    digitalWrite(RELAY_PIN, RELAY_OFF);
    request->send(200, "text/plain", "Door action STOPPED!");
  });

  // จัดการ 404 Not Found
  server.onNotFound([](AsyncWebServerRequest *request){
    request->send(404, "text/plain", "Not Found");
  });

  server.begin(); // เริ่มต้น Web Server
  Serial.println("HTTP server started");
}

void loop() {
  // ไม่ต้องใส่โค้ดอะไรมากใน loop() สำหรับ AsyncWebServer
  // Server จะจัดการ Request แบบ Async ให้เอง
}
