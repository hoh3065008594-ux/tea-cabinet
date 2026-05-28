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
    throw new Error(`Failed to insert reading: ${e.message}`);
  }
}

function getLatest() {
  try {
    return getDb().prepare('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1').get();
  } catch (e) {
    throw new Error(`Failed to get latest reading: ${e.message}`);
  }
}

function getHistory(limit = 100, hours = 24) {
  try {
    const since = Math.floor(Date.now() / 1000) - hours * 3600;
    return getDb().prepare(
      'SELECT * FROM readings WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?'
    ).all(since, limit);
  } catch (e) {
    throw new Error(`Failed to get history: ${e.message}`);
  }
}

module.exports = { getDb, insertReading, getLatest, getHistory };
