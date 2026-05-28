const express = require('express');
const router = express.Router();
const { getLatest, getHistory, getDailySummary } = require('../db');
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

router.get('/readings/daily', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const rows = getDailySummary(days);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/status', (req, res) => {
  const status = getStatus();
  res.json({ success: true, data: status });
});

const ALLOWED_COMMANDS = ['set_interval'];

router.post('/command', (req, res) => {
  try {
    const { cmd, value } = req.body;
    if (!cmd || value === undefined) {
      return res.status(400).json({ success: false, error: 'Missing cmd or value' });
    }
    if (!ALLOWED_COMMANDS.includes(cmd)) {
      return res.status(403).json({ success: false, error: 'Command not permitted' });
    }
    const result = sendCommand(cmd, value);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
