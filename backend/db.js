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
const { hashPassword } = require('./utils/crypto');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'environment.db');
const db = new sqlite3.Database(dbPath);

// AUDIT FIX (Finding 7.2 — High): Enable WAL mode for better concurrent read/write.
// WAL allows readers and writers to operate simultaneously, preventing SQLITE_BUSY errors
// when sensor ingestion and dashboard queries overlap.
db.run('PRAGMA journal_mode=WAL', (err) => {
  if (err) console.warn('⚠️  Could not enable WAL mode:', err.message);
  else console.log('✅ SQLite WAL mode enabled');
});

// Initialize tables and run migrations
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'", (err, row) => {
  if (!row) {
    console.log("🔄 Performing Multi-Tenancy database migration (dropping single-tenant tables)...");
    db.serialize(() => {
      db.run("DROP TABLE IF EXISTS users");
      db.run("DROP TABLE IF EXISTS borewell_state");
      db.run("DROP TABLE IF EXISTS readings_history");
      db.run("DROP TABLE IF EXISTS aqi_history");
      initTables();
    });
  } else {
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    // 0. Tenants table
    db.run(`CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      latitude REAL,
      longitude REAL,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 1. User profiles table (unique username per tenant)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      password TEXT,
      full_name TEXT,
      tenant_id TEXT REFERENCES tenants(id),
      UNIQUE(email, tenant_id)
    )`);

    // 2. Live state for borewells (composite primary key of id + tenant_id)
    db.run(`CREATE TABLE IF NOT EXISTS borewell_state (
      id TEXT,
      tenant_id TEXT REFERENCES tenants(id),
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
      total_liters REAL DEFAULT 0,
      current_status TEXT,
      water_status TEXT,
      turbidity_status TEXT,
      tds_status TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id, tenant_id)
    )`);

    // 3. Historical readings
    db.run(`CREATE TABLE IF NOT EXISTS readings_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borewell_id TEXT,
      tenant_id TEXT REFERENCES tenants(id),
      flow_rate REAL,
      water_level REAL,
      efficiency REAL,
      voltage REAL,
      current REAL,
      ph REAL,
      tds REAL,
      turbidity REAL,
      total_liters REAL,
      current_status TEXT,
      water_status TEXT,
      turbidity_status TEXT,
      tds_status TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 4. AQI History
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
      tenant_id TEXT REFERENCES tenants(id),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ensure columns exist (for existing tables if structure was modified without dropping)
    const aqiCols = ['pm25', 'pm10', 'co2', 'tvoc', 'hcho', 'temp', 'humidity', 'aqi', 'tenant_id'];
    aqiCols.forEach(col => {
      const type = col === 'tenant_id' ? 'TEXT' : 'REAL';
      db.run(`ALTER TABLE aqi_history ADD COLUMN ${col} ${type}`, (err) => { /* Ignore */ });
    });

    const waterCols = ['ph', 'tds', 'turbidity', 'tenant_id'];
    waterCols.forEach(col => {
      const type = col === 'tenant_id' ? 'TEXT' : 'REAL';
      db.run(`ALTER TABLE borewell_state ADD COLUMN ${col} ${type}`, (err) => { /* Ignore */ });
      db.run(`ALTER TABLE readings_history ADD COLUMN ${col} ${type}`, (err) => { /* Ignore */ });
    });

    const statusCols = ['total_liters', 'current_status', 'water_status', 'turbidity_status', 'tds_status'];
    statusCols.forEach(col => {
      const colType = col.endsWith('_status') ? 'TEXT' : 'REAL';
      db.run(`ALTER TABLE borewell_state ADD COLUMN ${col} ${colType}`, (err) => { /* Ignore */ });
      db.run(`ALTER TABLE readings_history ADD COLUMN ${col} ${colType}`, (err) => { /* Ignore */ });
    });

    // Time-series Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_readings_tenant_borewell_time 
      ON readings_history(tenant_id, borewell_id, timestamp DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_aqi_tenant_time 
      ON aqi_history(tenant_id, timestamp DESC)`);

    // Seed default tenants
    db.get("SELECT COUNT(*) as count FROM tenants", (err, row) => {
      if (row && row.count === 0) {
        db.run("INSERT INTO tenants (id, name, logo_url, primary_color, secondary_color, latitude, longitude, address) VALUES ('fern', 'Fern Insights', '/logo.png', '#10b981', '#06b6d4', 17.177306, 78.470667, 'Sy 438,439, Fern Villas, Srisailam Hwy, Maheshwaram, Malikdanguda, Maheshwaram, Telangana 501359')");
        db.run("INSERT INTO tenants (id, name, logo_url, primary_color, secondary_color, latitude, longitude, address) VALUES ('trifecta', 'Trifecta Insights', '/logo.png', '#3b82f6', '#1d4ed8', 12.9716, 77.5946, 'Trifecta Offices, Outer Ring Road, Bangalore, Karnataka 560103')");
        console.log('✅ Seeded default tenants (fern, trifecta)');
      }
    });

    // Seed admin users
    db.get("SELECT COUNT(*) as count FROM users WHERE email = 'fern' OR email = 'trifecta'", (err, row) => {
      if (row && row.count === 0) {
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD
          || (() => {
              const rand = crypto.randomBytes(12).toString('base64url');
              console.log('🔑 ══════════════════════════════════════════════════');
              console.log('🔑  FIRST-BOOT ADMIN CREDENTIALS (save these now!)');
              console.log(`🔑  Default Password : ${rand}`);
              console.log('🔑  To keep this password across restarts, set:');
              console.log('🔑  DEFAULT_ADMIN_PASSWORD env var in Render Dashboard');
              console.log('🔑 ══════════════════════════════════════════════════');
              return rand;
            })();
        const hashedPassword = hashPassword(adminPassword);
        db.run("INSERT INTO users (email, password, full_name, tenant_id) VALUES ('fern', ?, 'Fern Admin', 'fern')", [hashedPassword]);
        db.run("INSERT INTO users (email, password, full_name, tenant_id) VALUES ('trifecta', ?, 'Trifecta Admin', 'trifecta')", [hashedPassword]);
        console.log('✅ Seeded admin accounts: fern / trifecta');
      }
    });

    // Seed borewell live state
    db.get("SELECT COUNT(*) as count FROM borewell_state", (err, row) => {
      if (row && row.count === 0) {
        db.run(`INSERT INTO borewell_state (id, tenant_id, name, water_level) VALUES ('BW-01', 'fern', 'Borewell 1', 45.5)`);
        db.run(`INSERT INTO borewell_state (id, tenant_id, name, water_level) VALUES ('BW-02', 'fern', 'Borewell 2', 12.2)`);
        db.run(`INSERT INTO borewell_state (id, tenant_id, name, water_level) VALUES ('BW-03', 'fern', 'Borewell 3', 78.9)`);

        db.run(`INSERT INTO borewell_state (id, tenant_id, name, water_level) VALUES ('BW-01', 'trifecta', 'Borewell 1', 35.5)`);
        db.run(`INSERT INTO borewell_state (id, tenant_id, name, water_level) VALUES ('BW-02', 'trifecta', 'Borewell 2', 22.2)`);
        db.run(`INSERT INTO borewell_state (id, tenant_id, name, water_level) VALUES ('BW-03', 'trifecta', 'Borewell 3', 58.9)`);
        console.log('✅ Seeded borewell state table');
      }
    });

    // Seed readings history
    db.get("SELECT COUNT(*) as count FROM readings_history", (err, row) => {
      if (row && row.count === 0) {
        const stmt = db.prepare(`INSERT INTO readings_history 
          (borewell_id, tenant_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity, timestamp) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        const now = Date.now();
        ['fern', 'trifecta'].forEach(tenant => {
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

            stmt.run('BW-01', tenant, flow, lvl, eff, v, a, ph, tds, turb, timeStr);
          }
        });
        stmt.finalize();
        console.log('✅ Seeded initial readings history');
      }
    });
  });
}

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
