#include <WiFiManager.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- Pins ---
#define DHTPIN 15
#define DHTTYPE DHT22
#define OLED_ADDR 0x3C
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// --- Parameters ---
unsigned long readInterval = 30000;
unsigned long heartbeatInterval = 60000;
unsigned long lastRead = 0, lastHeartbeat = 0, startTime = 0;
const int historySize = 60;
float tempHistory[60] = {0};
float humHistory[60] = {0};
int historyIdx = 0;

// --- MQTT (fill in your EMQX Cloud credentials) ---
const char* mqttBroker = "YOUR_MQTT_BROKER";
const int mqttPort = 8883;
const char* mqttUser = "YOUR_MQTT_USERNAME";
const char* mqttPass = "YOUR_MQTT_PASSWORD";
const char* deviceId = "tea-cabinet-01";

WiFiClientSecure espClient;
PubSubClient mqtt(espClient);
DHT dht(DHTPIN, DHTTYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void callback(char* topic, byte* payload, unsigned int length) {
  char buf[256];
  memcpy(buf, payload, min(length, (unsigned int)255));
  buf[length] = 0;

  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, buf)) return;

  const char* cmd = doc["cmd"];
  if (strcmp(cmd, "set_interval") == 0) {
    int v = doc["value"];
    if (v >= 5) {
      readInterval = v * 1000;
      Serial.printf("[CMD] Interval set to %ds\n", v);
    }
  }
}

void connectMQTT() {
  espClient.setInsecure();
  mqtt.setServer(mqttBroker, mqttPort);
  mqtt.setCallback(callback);
  mqtt.setKeepAlive(60);

  while (!mqtt.connected()) {
    String clientId = "esp32-" + String(random(0xFFFF), HEX);
    if (mqtt.connect(clientId.c_str(), mqttUser, mqttPass)) {
      mqtt.subscribe("tea/command", 1);
      Serial.println("[MQTT] Connected and subscribed");
    } else {
      Serial.print("[MQTT] Failed, rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

void publishJSON(const char* topic, const JsonDocument& doc) {
  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(topic, buf, true);
}

void drawOLED(float t, float h, bool wifiOk, bool mqttOk) {
  display.clearDisplay();

  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.printf("%.1fC %.0f%%", t, h);

  display.setTextSize(1);
  display.setCursor(0, 20);
  display.print(wifiOk ? "WiFi OK" : "WiFi --");
  display.setCursor(70, 20);
  display.print(mqttOk ? "MQTT OK" : "MQTT --");

  int chartH = 32, chartY = 28, chartW = 128;
  float tMin = 100, tMax = -100;
  for (int i = 0; i < historySize; i++) {
    if (tempHistory[i] == 0) continue;
    if (tempHistory[i] < tMin) tMin = tempHistory[i];
    if (tempHistory[i] > tMax) tMax = tempHistory[i];
  }
  if (tMax - tMin < 1) { tMin -= 0.5; tMax += 0.5; }

  for (int i = 0; i < historySize - 1; i++) {
    if (tempHistory[i] == 0 || tempHistory[i+1] == 0) continue;
    int x1 = i * chartW / historySize;
    int x2 = (i + 1) * chartW / historySize;
    int y1 = chartY + chartH - (int)((tempHistory[i] - tMin) / (tMax - tMin) * chartH);
    int y2 = chartY + chartH - (int)((tempHistory[i+1] - tMin) / (tMax - tMin) * chartH);
    display.drawLine(x1, y1, x2, y2, SSD1306_WHITE);
  }

  display.display();
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  startTime = millis();

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect("TeaCabinet-Setup")) {
    Serial.println("[WiFi] Failed to connect, restarting...");
    ESP.restart();
  }
  Serial.print("[WiFi] Connected: ");
  Serial.println(WiFi.SSID());

  configTime(8 * 3600, 0, "ntp.aliyun.com", "cn.ntp.org.cn");
  Serial.println("[NTP] Time synced");

  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("[OLED] Init failed");
  }
  display.display();
  delay(1000);

  connectMQTT();
  lastRead = millis();
  lastHeartbeat = millis();
}

void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  unsigned long now = millis();

  if (now - lastRead >= readInterval) {
    lastRead = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();

    if (isnan(t) || isnan(h)) return;

    tempHistory[historyIdx % historySize] = t;
    humHistory[historyIdx % historySize] = h;
    historyIdx++;

    StaticJsonDocument<256> doc;
    doc["device"] = deviceId;
    doc["temperature"] = round(t * 10) / 10.0;
    doc["humidity"] = round(h * 10) / 10.0;
    doc["rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["timestamp"] = time(nullptr);
    publishJSON("tea/readings", doc);

    drawOLED(t, h, WiFi.isConnected(), mqtt.connected());
  }

  if (now - lastHeartbeat >= heartbeatInterval) {
    lastHeartbeat = now;
    StaticJsonDocument<128> doc;
    doc["device"] = deviceId;
    doc["online"] = true;
    doc["wifi_ssid"] = WiFi.SSID();
    doc["rssi"] = WiFi.RSSI();
    doc["interval"] = readInterval / 1000;
    doc["uptime"] = (now - startTime) / 1000;
    doc["timestamp"] = time(nullptr);
    publishJSON("tea/status", doc);
  }
}
