# 储茶柜湿度检测系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建完整的储茶柜温湿度监测系统——ESP32 固件采集数据通过 MQTT 上报，Express 后端存储并提供 API，React 前端展示 Apple 风格 Dashboard。

**Architecture:** 四阶段顺序执行：先建后端（Express+SQLite+MQTT 客户端），再写 ESP32 固件（WiFiManager+DHT22+OLED+MQTT），然后做前端（React+Vite+Tailwind+Recharts），最后集成部署。后端必须先于固件和前端完成，因为两者都依赖后端提供的 MQTT 订阅和 REST API。

**Tech Stack:** Arduino (ESP32), Express, SQLite (better-sqlite3), MQTT (mqtt.js), React 18 + TypeScript, Vite, Tailwind CSS, Recharts

---

## 文件结构总览

```
tea-cabinet/
├── DESIGN.md                     # Apple 设计规范 (已存在)
├── server/
│   ├── package.json
│   ├── index.js                  # Express 入口: 启动 HTTP + MQTT
│   ├── db.js                     # SQLite 初始化 + 查询函数
│   ├── mqtt-client.js            # MQTT 连接 + 消息处理
│   ├── routes/
│   │   └── api.js                # REST API 路由
│   └── public/                   # 前端 build 产物 (Phase 3 生成)
│       └── .gitkeep
├── firmware/
│   └── tea-cabinet/
│       └── tea-cabinet.ino       # ESP32 固件
└── dashboard/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── api.ts                # API 请求封装
        ├── types.ts              # 类型定义
        └── components/
            ├── Hero.tsx
            ├── StatusCards.tsx
            ├── MiniChart.tsx
            ├── InfoBar.tsx
            ├── HistoryChart.tsx
            └── CommandRow.tsx
```

---

## Phase 1: 后端 (Express + SQLite + MQTT)

### Task 1: 初始化 Node.js 项目并安装依赖

**Files:**
- Create: `server/package.json`

- [ ] **Step 1: 创建 server 目录和 package.json**

```bash
mkdir -p server/routes server/public
```

```bash
cd server && npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
cd server && npm install express better-sqlite3 mqtt cors
```

- [ ] **Step 3: 验证安装**

```bash
cd server && node -e "require('express'); require('better-sqlite3'); require('mqtt'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd tea-cabinet && git add server/package.json server/package-lock.json && git commit -m "chore: init server project with express, better-sqlite3, mqtt"
```

### Task 2: SQLite 数据库模块

**Files:**
- Create: `server/db.js`

- [ ] **Step 1: 编写 db.js**

```js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'readings.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      device      TEXT    NOT NULL,
      temperature REAL   NOT NULL,
      humidity    REAL   NOT NULL,
      rssi        INTEGER,
      timestamp   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_timestamp ON readings(timestamp DESC);
  `);
}

function insertReading(data) {
  const stmt = db.prepare(`
    INSERT INTO readings (device, temperature, humidity, rssi, timestamp)
    VALUES (@device, @temperature, @humidity, @rssi, @timestamp)
  `);
  return stmt.run(data);
}

function getLatest() {
  return db.prepare('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1').get();
}

function getHistory(limit = 100, hours = 24) {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  return db.prepare(
    'SELECT * FROM readings WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?'
  ).all(since, limit);
}

module.exports = { getDb, insertReading, getLatest, getHistory };
```

- [ ] **Step 2: 验证模块可加载**

```bash
cd server && node -e "const db = require('./db'); db.getDb(); console.log('DB OK')"
```

Expected: `DB OK`，同时生成 `server/readings.db` 文件

- [ ] **Step 3: Commit**

```bash
cd tea-cabinet && git add server/db.js && git commit -m "feat: add SQLite database module"
```

### Task 3: MQTT 客户端模块

**Files:**
- Create: `server/mqtt-client.js`

- [ ] **Step 1: 编写 mqtt-client.js**

```js
const mqtt = require('mqtt');
const { insertReading } = require('./db');

const MQTT_BROKER = 'mqtts://v429722e.ala.cn-hangzhou.emqxsl.cn:8883';
const MQTT_OPTIONS = {
  username: 'z8e10cc3',
  password: 'VJ9rA_e9ue_0fRyI',
  clientId: 'tea-cabinet-server-' + Math.random().toString(16).slice(2, 8),
};

let client = null;
let deviceStatus = {
  online: false,
  lastHeartbeat: null,
  rssi: null,
  interval: 30,
  uptime: 0,
};

function connect(onMessage) {
  client = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

  client.on('connect', () => {
    console.log('[MQTT] Connected to EMQX Cloud');
    client.subscribe(['tea/readings', 'tea/status'], { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err);
      else console.log('[MQTT] Subscribed to tea/readings, tea/status');
    });
  });

  client.on('message', (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      if (topic === 'tea/readings') {
        console.log('[MQTT] Reading:', data.temperature + '°C', data.humidity + '%');
        insertReading(data);
      } else if (topic === 'tea/status') {
        deviceStatus = {
          online: data.online,
          lastHeartbeat: data.timestamp,
          rssi: data.rssi,
          interval: data.interval,
          uptime: data.uptime,
        };
      }
      if (onMessage) onMessage(topic, data);
    } catch (e) {
      console.error('[MQTT] Parse error:', e.message);
    }
  });

  client.on('error', (err) => console.error('[MQTT] Error:', err.message));
  client.on('close', () => console.log('[MQTT] Disconnected'));

  return client;
}

function sendCommand(cmd, value) {
  if (!client || !client.connected) {
    throw new Error('MQTT not connected');
  }
  const payload = JSON.stringify({ cmd, value });
  client.publish('tea/command', payload, { qos: 1 });
  console.log('[MQTT] Command sent:', payload);
  return { success: true, cmd, value };
}

function getStatus() {
  return deviceStatus;
}

module.exports = { connect, sendCommand, getStatus };
```

- [ ] **Step 2: 验证模块可加载**

```bash
cd server && node -e "const mqtt = require('./mqtt-client'); console.log('MQTT module OK')"
```

Expected: `MQTT module OK`

- [ ] **Step 3: Commit**

```bash
cd tea-cabinet && git add server/mqtt-client.js && git commit -m "feat: add MQTT client module"
```

### Task 4: REST API 路由

**Files:**
- Create: `server/routes/api.js`

- [ ] **Step 1: 编写 api.js**

```js
const express = require('express');
const router = express.Router();
const { getLatest, getHistory } = require('../db');
const { sendCommand, getStatus } = require('../mqtt-client');

router.get('/readings/latest', (req, res) => {
  try {
    const row = getLatest();
    if (!row) {
      return res.json({ success: true, data: null });
    }
    res.json({
      success: true,
      data: {
        temperature: row.temperature,
        humidity: row.humidity,
        timestamp: row.timestamp,
        device: row.device,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/readings', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const hours = parseInt(req.query.hours) || 24;
    const rows = getHistory(limit, hours);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/status', (req, res) => {
  const status = getStatus();
  res.json({ success: true, data: status });
});

router.post('/command', (req, res) => {
  try {
    const { cmd, value } = req.body;
    if (!cmd || value === undefined) {
      return res.status(400).json({ success: false, error: 'Missing cmd or value' });
    }
    const result = sendCommand(cmd, value);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: 验证路由模块可加载**

```bash
cd server && node -e "const router = require('./routes/api'); console.log('Routes OK')"
```

Expected: `Routes OK`

- [ ] **Step 3: Commit**

```bash
cd tea-cabinet && git add server/routes/api.js && git commit -m "feat: add REST API routes"
```

### Task 5: Express 入口文件

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: 编写 index.js**

```js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { connect } = require('./mqtt-client');
const apiRoutes = require('./routes/api');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

getDb();

connect((topic, data) => {
  console.log(`[MQTT] ${topic}:`, JSON.stringify(data).slice(0, 80));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: 启动后端验证**

```bash
cd server && node index.js
```

Expected: 输出 `Server running on http://localhost:3000` 和 `[MQTT] Connected to EMQX Cloud`

- [ ] **Step 3: 测试 API（另一个终端）**

```bash
curl http://localhost:3000/api/readings/latest
```

Expected: `{"success":true,"data":null}` (尚无数据)

- [ ] **Step 4: Commit**

```bash
cd tea-cabinet && git add server/index.js && git commit -m "feat: add Express entry point"
```

---

## Phase 2: ESP32 固件

### Task 6: ESP32 固件

**Files:**
- Create: `firmware/tea-cabinet/tea-cabinet.ino`

- [ ] **Step 1: 在 Arduino IDE 中安装依赖库**

打开 Arduino IDE → Library Manager，搜索并安装：

| 库名 | 搜索关键词 |
|------|-----------|
| WiFiManager | `wifimanager tzapu` |
| PubSubClient | `pubsubclient` |
| Adafruit SSD1306 | `adafruit ssd1306` |
| Adafruit GFX Library | `adafruit gfx` |
| DHT sensor library | `dht sensor library adafruit` |
| ArduinoJson | `arduinojson` |

- [ ] **Step 2: 编写 tea-cabinet.ino**

```cpp
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- 引脚 ---
#define DHTPIN 15
#define DHTTYPE DHT22
#define OLED_ADDR 0x3C

// --- 参数 ---
unsigned long readInterval = 30000;
unsigned long heartbeatInterval = 60000;
unsigned long lastRead = 0, lastHeartbeat = 0, startTime = 0;
const int historySize = 60;
float tempHistory[60] = {0};
float humHistory[60] = {0};
int historyIdx = 0;

// --- MQTT ---
const char* mqttBroker = "v429722e.ala.cn-hangzhou.emqxsl.cn";
const int mqttPort = 8883;
const char* mqttUser = "z8e10cc3";
const char* mqttPass = "VJ9rA_e9ue_0fRyI";
const char* deviceId = "tea-cabinet-01";

WiFiClientSecure espClient;
PubSubClient mqtt(espClient);
DHT dht(DHTPIN, DHTTYPE);
Adafruit_SSD1306 display(128, 64, &Wire, -1);

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
    } else {
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

  // mini chart
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
    ESP.restart();
  }

  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
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
```

- [ ] **Step 2: 编译验证**

Arduino IDE: 选择 ESP32 Dev Module → 点击 Verify (✓)

Expected: 编译通过

- [ ] **Step 3: 烧录并观察串口**

Arduino IDE: 点击 Upload → 打开 Serial Monitor (115200 baud)

Expected: WiFi 连接成功 → MQTT 连接成功 → 每隔 30 秒输出温湿度数据

- [ ] **Step 4: 验证后端收到数据**

```bash
curl http://localhost:3000/api/readings/latest
```

Expected: 返回 ESP32 上报的温湿度数据

- [ ] **Step 5: 验证指令下发**

```bash
curl -X POST http://localhost:3000/api/command -H "Content-Type: application/json" -d '{"cmd":"set_interval","value":5}'
```

Expected: 串口输出 `[CMD] Interval set to 5s`，ESP32 上报频率变为 5 秒

- [ ] **Step 6: Commit**

```bash
cd tea-cabinet && git add firmware/ && git commit -m "feat: add ESP32 firmware with DHT22, OLED, MQTT"
```

---

## Phase 3: 前端 Dashboard

### Task 7: 初始化 Vite + React 项目

**Files:**
- Create: `dashboard/package.json`, `dashboard/vite.config.ts`, `dashboard/tsconfig.json`, `dashboard/tailwind.config.js`, `dashboard/index.html`, `dashboard/src/main.tsx`, `dashboard/src/index.css`

- [ ] **Step 1: 创建 Vite 项目**

```bash
cd tea-cabinet && npm create vite@latest dashboard -- --template react-ts
cd dashboard && npm install && npm install recharts tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: 配置 vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
```

- [ ] **Step 3: 编写 index.css (Apple Design Tokens)**

```css
@import "tailwindcss";

:root {
  --color-primary: #0066cc;
  --color-primary-hover: #0071e3;
  --color-ink: #1d1d1f;
  --color-ink-muted: #7a7a7a;
  --color-canvas: #ffffff;
  --color-canvas-parchment: #f5f5f7;
  --color-hairline: #e0e0e0;
  --color-divider: #f0f0f0;
  --color-success: #34c759;
}

body {
  font-family: "SF Pro Display", "SF Pro Text", system-ui, -apple-system, sans-serif;
  background: var(--color-canvas-parchment);
  color: var(--color-ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 4: 验证开发服务器启动**

```bash
cd dashboard && npm run dev
```

Expected: `http://localhost:5173` 可访问，显示 Vite 默认页面

- [ ] **Step 5: Commit**

```bash
cd tea-cabinet && git add dashboard/ && git commit -m "chore: init Vite + React + Tailwind project"
```

### Task 8: 类型定义和 API 封装

**Files:**
- Create: `dashboard/src/types.ts`, `dashboard/src/api.ts`

- [ ] **Step 1: 编写 types.ts**

```ts
export interface Reading {
  temperature: number;
  humidity: number;
  timestamp: number;
  device: string;
}

export interface DeviceStatus {
  online: boolean;
  lastHeartbeat: number | null;
  rssi: number | null;
  interval: number;
  uptime: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
```

- [ ] **Step 2: 编写 api.ts**

```ts
import type { Reading, DeviceStatus, ApiResponse } from './types';

const BASE = '/api';

export async function fetchLatest(): Promise<Reading | null> {
  const res = await fetch(`${BASE}/readings/latest`);
  const json: ApiResponse<Reading | null> = await res.json();
  return json.data;
}

export async function fetchHistory(limit = 100, hours = 24): Promise<Reading[]> {
  const res = await fetch(`${BASE}/readings?limit=${limit}&hours=${hours}`);
  const json: ApiResponse<Reading[]> = await res.json();
  return json.data;
}

export async function fetchStatus(): Promise<DeviceStatus> {
  const res = await fetch(`${BASE}/status`);
  const json: ApiResponse<DeviceStatus> = await res.json();
  return json.data;
}

export async function sendCommand(cmd: string, value: number): Promise<void> {
  await fetch(`${BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, value }),
  });
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
cd tea-cabinet && git add dashboard/src/types.ts dashboard/src/api.ts && git commit -m "feat: add TypeScript types and API module"
```

### Task 9: App 组件和轮询逻辑

**Files:**
- Write: `dashboard/src/App.tsx` (overwrite template)
- Write: `dashboard/src/main.tsx` (overwrite template)

- [ ] **Step 1: 编写 main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 2: 编写 App.tsx (含 5 秒轮询)**

```tsx
import { useEffect, useState, useCallback } from 'react';
import type { Reading, DeviceStatus } from './types';
import { fetchLatest, fetchHistory, fetchStatus } from './api';
import Hero from './components/Hero';
import StatusCards from './components/StatusCards';
import MiniChart from './components/MiniChart';
import InfoBar from './components/InfoBar';
import HistoryChart from './components/HistoryChart';
import CommandRow from './components/CommandRow';

export default function App() {
  const [latest, setLatest] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [status, setStatus] = useState<DeviceStatus>({
    online: false, lastHeartbeat: null, rssi: null, interval: 30, uptime: 0,
  });

  const poll = useCallback(async () => {
    const [r, s] = await Promise.all([fetchLatest(), fetchStatus()]);
    if (r) setLatest(r);
    setStatus(s);
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    fetchHistory(288, 24).then(setHistory);
  }, []);

  return (
    <div className="min-h-screen">
      <Hero online={status.online} device="tea-cabinet-01" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-5 relative z-10">
        <StatusCards latest={latest} />
        <div className="bg-white rounded-[18px] p-6 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <p className="text-[13px] text-[#7a7a7a] font-medium mb-3">实时趋势</p>
          <MiniChart data={history.slice(0, 20)} />
        </div>
        <InfoBar status={status} />
        <div className="bg-white rounded-[18px] p-6 mb-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-[17px] font-medium mb-4">24 小时趋势</h3>
          <HistoryChart data={history} />
          <CommandRow currentInterval={status.interval} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 无类型错误（组件文件尚未创建，先忽略组件导入错误，等后续 task 创建后验证）

- [ ] **Step 4: Commit**

```bash
cd tea-cabinet && git add dashboard/src/main.tsx dashboard/src/App.tsx && git commit -m "feat: add App component with 5s polling"
```

### Task 10: UI 组件

**Files:**
- Create: `dashboard/src/components/Hero.tsx`, `StatusCards.tsx`, `MiniChart.tsx`, `InfoBar.tsx`, `HistoryChart.tsx`, `CommandRow.tsx`

- [ ] **Step 1: 编写 Hero.tsx**

```tsx
interface Props { online: boolean; device: string; }

export default function Hero({ online, device }: Props) {
  return (
    <div className="bg-white border-b border-[#e0e0e0] pt-12 pb-10 px-8 text-center">
      <div className="inline-flex items-center gap-1.5 bg-[#f0f0f0] rounded-full py-1 px-3.5 text-[13px] text-[#7a7a7a] mb-5">
        <span className={`w-[7px] h-[7px] rounded-full ${online ? 'bg-[#34c759]' : 'bg-[#e0e0e0]'}`} />
        {online ? '设备在线' : '设备离线'} · {device}
      </div>
      <h1 className="text-[48px] font-semibold tracking-[-0.5px] mb-1">储茶柜</h1>
      <p className="text-[19px] text-[#7a7a7a]">温湿度实时监测</p>
    </div>
  );
}
```

- [ ] **Step 2: 编写 StatusCards.tsx**

```tsx
import type { Reading } from '../types';

interface Props { latest: Reading | null; }

export default function StatusCards({ latest }: Props) {
  const temp = latest?.temperature ?? '--';
  const hum = latest?.humidity ?? '--';
  const updated = latest ? new Date(latest.timestamp * 1000).toLocaleTimeString('zh-CN') : '--';

  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="bg-white rounded-[18px] p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] text-[#7a7a7a] font-medium uppercase tracking-[0.5px] mb-1">温度</p>
        <p className="text-[56px] font-semibold tracking-[-1.5px] leading-none text-[#1d1d1f]">
          {temp}<span className="text-[22px] font-normal text-[#7a7a7a]">°C</span>
        </p>
        <p className="text-[13px] text-[#7a7a7a] mt-2">更新于 {updated}</p>
      </div>
      <div className="bg-white rounded-[18px] p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] text-[#7a7a7a] font-medium uppercase tracking-[0.5px] mb-1">湿度</p>
        <p className="text-[56px] font-semibold tracking-[-1.5px] leading-none text-[#1d1d1f]">
          {hum}<span className="text-[22px] font-normal text-[#7a7a7a]">%</span>
        </p>
        <p className="text-[13px] text-[#7a7a7a] mt-2">更新于 {updated}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 编写 MiniChart.tsx**

```tsx
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { Reading } from '../types';

interface Props { data: Reading[]; }

export default function MiniChart({ data }: Props) {
  const chartData = data.map(r => ({ t: r.temperature })).reverse();
  return (
    <div className="h-[72px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="t" stroke="#0066cc" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: 编写 InfoBar.tsx**

```tsx
import type { DeviceStatus } from '../types';

interface Props { status: DeviceStatus; }

export default function InfoBar({ status }: Props) {
  return (
    <div className="flex gap-3 mb-4 flex-wrap">
      <div className="bg-white rounded-xl py-2.5 px-4 text-[13px] text-[#7a7a7a] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        WiFi <strong className="text-[#1d1d1f] font-medium">{status.rssi ?? '--'} dBm</strong>
      </div>
      <div className="bg-white rounded-xl py-2.5 px-4 text-[13px] text-[#7a7a7a] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        MQTT <strong className="text-[#1d1d1f] font-medium">{status.online ? '已连接' : '断开'}</strong>
      </div>
      <div className="bg-white rounded-xl py-2.5 px-4 text-[13px] text-[#7a7a7a] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        上报间隔 <strong className="text-[#1d1d1f] font-medium">{status.interval} 秒</strong>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 编写 HistoryChart.tsx**

```tsx
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Reading } from '../types';

interface Props { data: Reading[]; }

export default function HistoryChart({ data }: Props) {
  const chartData = data
    .map(r => ({
      time: new Date(r.timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      temp: r.temperature,
      hum: r.humidity,
    }))
    .reverse();

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#7a7a7a' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#7a7a7a' }} width={36} />
          <Tooltip />
          <Line type="monotone" dataKey="temp" stroke="#0066cc" strokeWidth={2} dot={false} name="温度" />
          <Line type="monotone" dataKey="hum" stroke="#34c759" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="湿度" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: 编写 CommandRow.tsx**

```tsx
import { useState } from 'react';
import { sendCommand } from '../api';

interface Props { currentInterval: number; }

export default function CommandRow({ currentInterval }: Props) {
  const [value, setValue] = useState(currentInterval);

  const handleSubmit = async () => {
    try {
      await sendCommand('set_interval', value);
    } catch (e) {
      console.error('Command failed:', e);
    }
  };

  return (
    <div className="flex gap-2 items-center mt-5 pt-4 border-t border-[#f0f0f0]">
      <label className="text-[13px] text-[#7a7a7a]">修改上报间隔:</label>
      <input
        type="number"
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        min={5}
        max={3600}
        className="bg-[#f5f5f7] border border-[#e0e0e0] rounded-[10px] text-[#1d1d1f] py-2 px-3 text-sm w-14 text-center font-mono focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_3px_rgba(0,102,204,0.15)]"
      />
      <span className="text-[13px] text-[#7a7a7a]">秒</span>
      <button
        onClick={handleSubmit}
        className="bg-[#0066cc] text-white border-0 rounded-[20px] py-2 px-5 text-[13px] font-medium cursor-pointer hover:bg-[#0071e3] transition-colors"
      >
        下发指令
      </button>
    </div>
  );
}
```

- [ ] **Step 7: 验证完整 TypeScript 编译**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 8: 验证前端运行**

```bash
cd dashboard && npm run dev
```

Expected: `http://localhost:5173` 显示完整 Dashboard（需后端在 3000 端口运行）

- [ ] **Step 9: Commit**

```bash
cd tea-cabinet && git add dashboard/src/components/ && git commit -m "feat: add Dashboard UI components"
```

---

## Phase 4: 集成与部署

### Task 11: 构建前端并集成到后端

**Files:**
- Modify: `server/public/` (接收构建产物)
- Modify: `server/package.json` (添加构建脚本)

- [ ] **Step 1: 构建前端**

```bash
cd dashboard && npm run build
```

Expected: `dashboard/dist/` 目录生成

- [ ] **Step 2: 复制构建产物到后端**

```bash
cp -r dashboard/dist/* server/public/
```

- [ ] **Step 3: 添加 server/package.json 构建脚本**

在 `server/package.json` 的 `scripts` 中添加：

```json
"prestart": "cd ../dashboard && npm run build && rm -rf ../server/public/* && cp -r dist/* ../server/public/"
```

- [ ] **Step 4: 完整验证**

```bash
cd server && node index.js
```

浏览器访问 `http://localhost:3000`，确认 Dashboard 正常显示且 API 正常响应

- [ ] **Step 5: Commit**

```bash
cd tea-cabinet && git add server/public/ server/package.json && git commit -m "chore: integrate frontend build with server"
```

### Task 12: 部署到阿里云香港 ECS

- [ ] **Step 1: 登录 ECS**

```bash
ssh root@<香港ECS公网IP>
```

- [ ] **Step 2: 安装 Node.js (ECS 上)**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

- [ ] **Step 3: 上传项目**

```bash
# 本地执行
scp -r server/ root@<ECS_IP>:/opt/tea-cabinet/
```

- [ ] **Step 4: ECS 上安装依赖并启动**

```bash
cd /opt/tea-cabinet && npm install
node index.js
```

- [ ] **Step 5: 使用 PM2 守护进程**

```bash
npm install -g pm2
pm2 start index.js --name tea-cabinet
pm2 save
pm2 startup
```

- [ ] **Step 6: 验证**

浏览器访问 `http://<ECS公网IP>:3000`，确认 Dashboard 正常显示

Expected: 能看到完整 Dashboard，API 响应正常
