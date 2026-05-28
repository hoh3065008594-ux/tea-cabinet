# 储茶柜湿度检测系统

基于 ESP32 + DHT22 + OLED 的物联网温湿度监测系统，MQTT 上报数据至 EMQX Cloud，React Dashboard 实时展示。

## 架构

```
ESP32 + DHT22 + OLED ──MQTT──▶ EMQX Cloud ──MQTT──▶ Express + SQLite
                           (TLS 8883)                    │
                                                    React Dashboard
```

## 项目结构

```
├── firmware/          # ESP32 Arduino 固件
│   └── tea-cabinet/
│       └── tea-cabinet.ino
├── server/            # Express 后端 + MQTT 客户端 + SQLite
│   ├── index.js
│   ├── db.js
│   ├── mqtt-client.js
│   ├── routes/api.js
│   ├── public/        # Dashboard 构建产物
│   └── .env.example
└── dashboard/         # React/TS 前端 (Vite + Tailwind + Recharts)
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── types.ts
        └── components/
```

## 快速开始

### 1. EMQX Cloud 配置

1. 注册 [EMQX Cloud](https://cloud.emqx.com) 并创建部署
2. 访问控制 → 认证 → 创建 MQTT 用户
3. 访问控制 → 授权 → 添加规则（主题 `tea/#`，允许发布+订阅）

### 2. 后端部署

```bash
cd server
cp .env.example .env
# 编辑 .env 填入你的 MQTT 凭据
npm install
node index.js
```

### 3. ESP32 固件

1. 用 Arduino IDE 打开 `firmware/tea-cabinet/tea-cabinet.ino`
2. 修改 MQTT 配置（文件顶部 4 个常量）
3. 安装依赖库：WiFiManager、PubSubClient、Adafruit SSD1306、Adafruit GFX、DHT sensor library、ArduinoJson
4. 编译烧录到 ESP32

硬件接线：

| ESP32 | DHT22 | OLED |
|-------|-------|------|
| GPIO 15 | DATA | - |
| GPIO 21 | - | SDA |
| GPIO 22 | - | SCL |
| 3.3V | VCC | VCC |
| GND | GND | GND |

### 4. Dashboard

```bash
cd dashboard
npm install
npm run dev        # 开发模式
npm run build      # 构建 → server/public/
```

## 技术栈

- **硬件**：ESP32 + DHT22 + OLED SSD1306 (I2C)
- **协议**：MQTT (TLS 8883, QoS 1)
- **后端**：Express + SQLite + mqtt.js
- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Recharts
- **设计**：Apple DESIGN.md 风格

## License

MIT
