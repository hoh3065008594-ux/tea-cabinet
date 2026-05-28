# 储茶柜湿度检测系统 — 设计文档

## 概述

基于 ESP32 + DHT22 + OLED 的茶柜温湿度监测系统，MQTT 上报数据至 EMQX Cloud，后端部署在阿里云香港 ECS，前端为 Apple 风格 Dashboard。

## 架构

```
ESP32 + DHT22 + OLED         阿里云香港 ECS (无需备案)
┌──────────────────┐         ┌──────────────────────────┐
│  DHT22 传感器      │         │  Express Server (端口 3000)│
│        ↓          │  MQTT   │   ├── /api/readings  API  │
│  ESP32 采集+显示   │──TLS──▶│   ├── /api/status    状态 │
│        ↓          │  8883   │   └── /*           前端页面│
│  OLED 曲线+状态    │         │         ↓                  │
│        ↓          │◀─订阅───│   MQTT Client (订阅+发布)  │
│  MQTT 上报+收指令  │ command │         ↓                  │
└──────────────────┘         │   SQLite (readings.db)     │
                             └──────────────────────────┘
                                      │
                                      ▼ http://<香港IP>:3000
                                 📱 国内直连, 无需备案, 无需VPN
```

## MQTT Topic 设计

| Topic | 方向 | QoS | 内容 |
|-------|------|-----|------|
| `tea/readings` | ESP32 → 后端 | 1 | 温湿度 JSON |
| `tea/command` | 后端 → ESP32 | 1 | 指令 JSON |
| `tea/status` | ESP32 → 后端 | 1 | 心跳/设备状态 |

### 上报格式 (`tea/readings`)
```json
{
  "device": "tea-cabinet-01",
  "temperature": 23.5,
  "humidity": 65.2,
  "rssi": -45,
  "free_heap": 120456,
  "timestamp": 1716883200
}
```

### 状态格式 (`tea/status`)
```json
{
  "device": "tea-cabinet-01",
  "online": true,
  "wifi_ssid": "my-wifi",
  "rssi": -45,
  "interval": 30,
  "uptime": 3600,
  "timestamp": 1716883200
}
```

### 指令格式 (`tea/command`)
```json
{
  "cmd": "set_interval",
  "value": 10
}
```

支持指令: `set_interval` — 修改上报间隔(秒, 最小5秒)

## ESP32 固件

### 硬件引脚
| ESP32 | 外设 |
|-------|------|
| GPIO 21 (SDA) | OLED SSD1306 (I2C) |
| GPIO 22 (SCL) | OLED SSD1306 (I2C) |
| GPIO 15 | DHT22 DATA |

### 关键参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 上报间隔 | 30 秒 | 可通过 MQTT `set_interval` 指令动态修改 (最小 5 秒) |
| 心跳间隔 | 60 秒 | `tea/status` 上报频率 |
| OLED 曲线点数 | 60 点 | 存储最近 60 条数据绘制迷你折线 (30 分钟 @ 30 秒间隔) |

### 依赖库
- WiFiManager (tzapu) — 热点配网
- PubSubClient — MQTT 客户端
- Adafruit SSD1306 + GFX — OLED 显示
- DHT sensor library (Adafruit) — DHT22 读取
- ArduinoJson — JSON 序列化/反序列化

### 程序流程
```
启动
 ├─ WiFiManager.autoConnect("TeaCabinet-Setup")
 ├─ DHT22 初始化
 ├─ OLED 初始化 (128x64 I2C)
 ├─ MQTT TLS 连接 (EMQX Cloud:8883)
 └─ 主循环:
     ├─ 按 interval 读 DHT22
     ├─ 发布 JSON → tea/readings (QoS 1)
     ├─ 发布心跳 → tea/status
     ├─ 更新 OLED: 温湿度数值 + WiFi/MQTT状态 + 迷你折线图
     └─ mqttClient.loop() 检查 tea/command 指令
```

### OLED 显示布局 (128x64)
```
第一行:  🌡23.5°C  💧65%
第二行:  WiFi ✓  MQTT ✓
下半屏:  ╱╲╱╲╱╲  (30分钟迷你折线)
```

## 后端 (Express + SQLite)

### 目录结构
```
server/
├── index.js          # Express + MQTT 启动
├── db.js             # SQLite 初始化与查询
├── mqtt-client.js    # MQTT 连接与消息处理
├── routes/
│   └── api.js        # REST API 路由
└── public/           # React build 产物
```

### SQLite 表结构
```sql
CREATE TABLE readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device      TEXT    NOT NULL,
  temperature REAL   NOT NULL,
  humidity    REAL   NOT NULL,
  rssi        INTEGER,
  timestamp   INTEGER NOT NULL
);

CREATE INDEX idx_timestamp ON readings(timestamp DESC);
```

### REST API
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/readings/latest` | GET | 最新一条温湿度 |
| `/api/readings?limit=100` | GET | 历史数据 (默认100条, 可选 `hours` 参数过滤) |
| `/api/status` | GET | 设备在线状态 (最近心跳时间, 在线/离线) |
| `/api/command` | POST | 下发指令给 ESP32 (body: `{"cmd":"set_interval","value":30}`) |

### API 响应格式

`GET /api/readings/latest`:
```json
{
  "success": true,
  "data": {
    "temperature": 23.5,
    "humidity": 65.2,
    "timestamp": 1716883200,
    "device": "tea-cabinet-01"
  }
}
```

`GET /api/status`:
```json
{
  "success": true,
  "data": {
    "online": true,
    "last_heartbeat": 1716883200,
    "rssi": -45,
    "interval": 30,
    "uptime": 3600
  }
}
```

## 前端 (React/TS + Vite)

### 技术栈
| 层 | 选型 |
|----|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 图表 | Recharts |
| 样式 | Tailwind CSS |
| 设计 | Apple DESIGN.md |

### 组件结构
```
App.tsx
├── Hero.tsx           # 标题 + 在线状态
├── StatusCards.tsx    # 温度卡片 + 湿度卡片
├── MiniChart.tsx      # 实时迷你趋势图
├── InfoBar.tsx        # WiFi/MQTT/间隔 信息栏
├── HistoryChart.tsx   # 24小时趋势图
└── CommandRow.tsx     # 修改上报间隔
```

### 设计风格 (Apple)
- 底色: `#f5f5f7`
- 卡片: `#ffffff` + 轻微阴影
- 主色: `#0066cc`
- 字体: SF Pro Display, system-ui
- 圆角: 18px (大卡), 12px (小元素)
- 数据轮询: 每 5 秒 `GET /api/readings/latest`

### 页面布局
```
┌──────────────────────────────────────┐
│  ● 设备在线 · tea-cabinet-01          │
│  储茶柜                               │
│  温湿度实时监测                        │
├──────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐         │
│  │ 温度      │  │ 湿度      │         │
│  │ 23.5°C   │  │  65%     │         │
│  │ 22~25°C  │  │ 58~68%   │         │
│  └──────────┘  └──────────┘         │
├──────────────────────────────────────┤
│  实时趋势 ╱╲╱╲╱╲                      │
├──────────────────────────────────────┤
│  WiFi -45dBm | MQTT 已连接 | 30秒     │
├──────────────────────────────────────┤
│  24小时趋势                           │
│  ┌──────────────────────────────────┐│
│  │  温度(蓝) + 湿度(绿) 折线图       ││
│  └──────────────────────────────────┘│
│  修改间隔: [30] 秒 [下发指令]         │
└──────────────────────────────────────┘
```

## MQTT 连接信息

| 参数 | 值 |
|------|-----|
| Broker | v429722e.ala.cn-hangzhou.emqxsl.cn |
| 端口 | 8883 (TLS) |
| 用户名 | z8e10cc3 |
| 密码 | VJ9rA_e9ue_0fRyI |

## 部署

- 后端 + 前端: 同一 Express 进程，端口 3000
- 部署目标: 阿里云香港 ECS
- 启动: `node index.js` (生产环境用 PM2)
- 前端构建: `npm run build` → 产物放入 `server/public/`
- 访问: `http://<香港ECS公网IP>:3000`
