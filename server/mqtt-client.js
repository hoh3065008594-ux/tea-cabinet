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
        try {
          insertReading(data);
        } catch (e) {
          console.error('[MQTT] DB insert error:', e.message);
        }
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
  return { ...deviceStatus };
}

module.exports = { connect, sendCommand, getStatus };
