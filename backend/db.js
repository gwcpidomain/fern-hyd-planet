// ─── Cloud DB: Auto-detect Turso for Render free tier ────────────────────────
// Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN on Render → persistent cloud SQLite.
// Leave them unset locally → uses the local environment.db file as before.
if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
  console.log('☁️  Turso detected — using persistent cloud SQLite (survives Render restarts)');
  const { createTursoDb } = require('./db-turso');
  module.exports = createTursoDb();
  return; // Skip all local SQLite code below
}
console.log('💾 Using local SQLite (ephemeral on Render free tier — set TURSO_* env vars to persist)');
// ─────────────────────────────────────────────────────────────────────────────

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

function hashPassword(password, salt) {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 10000, 64, 'sha512').toString('hex');
  return `${finalSalt}:${hash}`;
}

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'environment.db');
const db = new sqlite3.Database(dbPath);

// AUDIT FIX (Finding 7.2 — High): Enable WAL mode for better concurrent read/write.
// WAL allows readers and writers to operate simultaneously, preventing SQLITE_BUSY errors
// when sensor ingestion and dashboard queries overlap.
db.run('PRAGMA journal_mode=WAL', (err) => {
  if (err) console.warn('⚠️  Could not enable WAL mode:', err.message);
  else console.log('✅ SQLite WAL mode enabled');
});

// Initialize tables
db.serialize(() => {
  // 0. User profiles table for dashboard logins
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    full_name TEXT
  )`);

  // SECURITY FIX (H-06): Migrated default admin username from 'trifecta' to 'fern'
  db.get("SELECT COUNT(*) as count FROM users WHERE email = 'fern'", (err, row) => {
    if (row && row.count === 0) {
      // Use configured password from env var, or generate a secure random one
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD
        || (() => {
            const rand = crypto.randomBytes(12).toString('base64url');
            console.log('🔑 ══════════════════════════════════════════════════');
            console.log('🔑  FIRST-BOOT ADMIN CREDENTIALS (save these now!)');
            console.log(`🔑  Username : fern`);
            console.log(`🔑  Password : ${rand}`);
            console.log('🔑  To keep this password across restarts, set:');
            console.log('🔑  DEFAULT_ADMIN_PASSWORD env var in Render Dashboard');
            console.log('🔑 ══════════════════════════════════════════════════');
            return rand;
          })();
      const hashedPassword = hashPassword(adminPassword);
      db.run("INSERT INTO users (email, password, full_name) VALUES ('fern', ?, 'Fern Admin')", [hashedPassword]);
    }
  });

  // 1. Live state for all 3 borewells
  db.run(`CREATE TABLE IF NOT EXISTS borewell_state (
    id TEXT PRIMARY KEY,
    name TEXT,
    is_motor_on BOOLEAN DEFAULT 0,
    flow_rate REAL DEFAULT 0,
    efficiency REAL DEFAULT 0,
    voltage REAL DEFAULT 0,
    current REAL DEFAULT 0,
    run_time_total REAL DEFAULT 0,
    water_level REAL DEFAULT 0,
    ph REAL DEFAULT 7.2,
    tds REAL DEFAULT 250,
    turbidity REAL DEFAULT 1.2,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. Historical readings for trends
  db.run(`CREATE TABLE IF NOT EXISTS readings_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    borewell_id TEXT,
    flow_rate REAL,
    water_level REAL,
    efficiency REAL,
    voltage REAL,
    current REAL,
    ph REAL,
    tds REAL,
    turbidity REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 3. AQI History (Environmental Data - CPCB Compliant)
  db.run(`CREATE TABLE IF NOT EXISTS aqi_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pm25 REAL,
    pm10 REAL,
    co2 REAL,
    tvoc REAL,
    hcho REAL,
    temp REAL,
    humidity REAL,
    aqi REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ensure new columns exist for existing databases
  const aqiCols = ['pm25', 'pm10', 'co2', 'tvoc', 'hcho', 'temp', 'humidity', 'aqi'];
  aqiCols.forEach(col => {
    db.run(`ALTER TABLE aqi_history ADD COLUMN ${col} REAL`, (err) => { /* Ignore errors if col exists */ });
  });

  const waterCols = ['ph', 'tds', 'turbidity'];
  waterCols.forEach(col => {
    db.run(`ALTER TABLE borewell_state ADD COLUMN ${col} REAL`, (err) => { /* Ignore */ });
    db.run(`ALTER TABLE readings_history ADD COLUMN ${col} REAL`, (err) => { /* Ignore */ });
  });

  const statusCols = ['total_liters', 'current_status', 'water_status', 'turbidity_status', 'tds_status'];
  statusCols.forEach(col => {
    const colType = col.endsWith('_status') ? 'TEXT' : 'REAL';
    db.run(`ALTER TABLE borewell_state ADD COLUMN ${col} ${colType}`, (err) => { /* Ignore */ });
    db.run(`ALTER TABLE readings_history ADD COLUMN ${col} ${colType}`, (err) => { /* Ignore */ });
  });

  // AUDIT FIX (Finding 3.2 — High): Add indexes for time-series query performance.
  // Without these, ORDER BY timestamp DESC requires a full table scan.
  db.run(`CREATE INDEX IF NOT EXISTS idx_readings_borewell_time 
    ON readings_history(borewell_id, timestamp DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_aqi_time 
    ON aqi_history(timestamp DESC)`);

  // Seed initial data if empty
  db.get("SELECT COUNT(*) as count FROM borewell_state", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-01', 'Borewell 1', 45.5)`);
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-02', 'Borewell 2', 12.2)`);
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-03', 'Borewell 3', 78.9)`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM readings_history", (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare(`INSERT INTO readings_history 
        (borewell_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      const now = Date.now();
      for (let i = 24; i >= 0; i--) {
        const timeOffset = now - i * 3600 * 1000;
        const timeStr = new Date(timeOffset).toISOString().replace('T', ' ').substring(0, 19);

        const t = (24 - i) / 24;
        const lvl = parseFloat((5.2 + Math.sin(t * Math.PI * 2) * 0.4 + Math.random() * 0.1).toFixed(2));
        const ph = parseFloat((7.35 + Math.sin(t * Math.PI * 4) * 0.15 + Math.random() * 0.05).toFixed(2));
        const tds = parseFloat((215 + Math.sin(t * Math.PI * 2) * 15 + Math.random() * 4).toFixed(1));
        const turb = parseFloat((1.4 + Math.cos(t * Math.PI * 2) * 0.3 + Math.random() * 0.08).toFixed(2));
        const flow = 0.0;
        const eff = 0.0;
        const v = 230.0;
        const a = 0.0;

        stmt.run('BW-01', flow, lvl, eff, v, a, ph, tds, turb, timeStr);
      }
      stmt.finalize();
    }
  });
});

// Automatically prune readings older than 30 days to prevent unbounded SQLite file growth.
// Runs every 6 hours.
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  console.log('🧹 Running database cleanup job...');
  db.run("DELETE FROM readings_history WHERE timestamp < datetime('now', '-30 days')", (err) => {
    if (err) console.error('⚠️  Failed to prune readings_history:', err.message);
    else console.log('✅ readings_history pruned successfully.');
  });
  db.run("DELETE FROM aqi_history WHERE timestamp < datetime('now', '-30 days')", (err) => {
    if (err) console.error('⚠️  Failed to prune aqi_history:', err.message);
    else console.log('✅ aqi_history pruned successfully.');
  });
}, PRUNE_INTERVAL_MS);

module.exports = db;
