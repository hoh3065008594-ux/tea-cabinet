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
  try {
    const stmt = getDb().prepare(`
      INSERT INTO readings (device, temperature, humidity, rssi, timestamp)
      VALUES (@device, @temperature, @humidity, @rssi, @timestamp)
    `);
    return stmt.run(data);
  } catch (e) {
    console.error('DB insert error:', e);
    throw new Error('Failed to insert reading');
  }
}

function getLatest() {
  try {
    return getDb().prepare('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1').get();
  } catch (e) {
    console.error('DB getLatest error:', e);
    throw new Error('Failed to get latest reading');
  }
}

function getHistory(limit = 100, hours = 24) {
  try {
    const since = Math.floor(Date.now() / 1000) - hours * 3600;
    return getDb().prepare(
      'SELECT * FROM readings WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?'
    ).all(since, limit);
  } catch (e) {
    console.error('DB getHistory error:', e);
    throw new Error('Failed to get history');
  }
}

function getDailySummary(days = 7) {
  try {
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const rows = getDb().prepare(
      'SELECT temperature, humidity, timestamp FROM readings WHERE timestamp >= ? ORDER BY timestamp ASC'
    ).all(since);

    const daysMap = {};
    for (const row of rows) {
      const date = new Date(row.timestamp * 1000);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!daysMap[key]) {
        daysMap[key] = { maxT: row.temperature, maxH: row.humidity, minT: row.temperature, minH: row.humidity };
      } else {
        if (row.temperature > daysMap[key].maxT) { daysMap[key].maxT = row.temperature; daysMap[key].maxH = row.humidity; }
        if (row.temperature < daysMap[key].minT) { daysMap[key].minT = row.temperature; daysMap[key].minH = row.humidity; }
      }
    }

    return Object.entries(daysMap).map(([day, v]) => ({
      day,
      temp_max: v.maxT,
      hum_at_max: v.maxH,
      temp_min: v.minT,
      hum_at_min: v.minH,
    }));
  } catch (e) {
    console.error('DB getDailySummary error:', e);
    throw new Error('Failed to get daily summary');
  }
}

module.exports = { getDb, insertReading, getLatest, getHistory, getDailySummary };
