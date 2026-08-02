'use strict';

/**
 * Turso (libSQL) Database Adapter
 * ================================
 * Provides the same callback-based API as the `sqlite3` npm package so
 * server.js and all route handlers work without ANY changes.
 *
 * Loaded automatically by db.js when TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * env vars are present (i.e. on Render production).
 * Falls back to local SQLite when those vars are absent (local dev).
 *
 * Free tier: 500 MB storage | 1B row reads/month | 25M row writes/month
 */

const { createClient } = require('@libsql/client');
const crypto = require('crypto');

// ─── Password helper (mirrors db.js) ──────────────────────────────────────────
function hashPassword(password, salt) {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 10000, 64, 'sha512').toString('hex');
  return `${finalSalt}:${hash}`;
}

// ─── Row converter ────────────────────────────────────────────────────────────
// Turso returns Row objects (not plain objects). Integer columns may be BigInt.
// Convert everything to a plain JS object so existing code works unchanged.
function toPlain(row) {
  if (!row) return null;
  const obj = {};
  for (const key of Object.keys(row)) {
    const val = row[key];
    obj[key] = typeof val === 'bigint' ? Number(val) : val;
  }
  return obj;
}

// ─── Adapter factory ──────────────────────────────────────────────────────────
function createTursoDb() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = {
    /**
     * db.run(sql, [params], [callback])
     * INSERT / UPDATE / DELETE / CREATE / PRAGMA statements.
     * `this` inside callback is bound to { lastID, changes }.
     */
    run(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = [];

      client.execute({ sql, args: params })
        .then(result => {
          if (typeof callback === 'function') {
            callback.call(
              {
                lastID:  result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : 0,
                changes: result.rowsAffected    !== undefined ? result.rowsAffected           : 0,
              },
              null   // no error
            );
          }
        })
        .catch(err => {
          if (typeof callback === 'function') callback(err);
          else console.error('[TursoDB] run error:', err.message, '| SQL:', sql.substring(0, 80));
        });
    },

    /**
     * db.get(sql, [params], callback)
     * Returns a single row. callback(err, row).
     */
    get(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = [];

      client.execute({ sql, args: params })
        .then(result => callback(null, toPlain(result.rows[0])))
        .catch(err  => callback(err, null));
    },

    /**
     * db.all(sql, [params], callback)
     * Returns all rows. callback(err, rows[]).
     */
    all(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = [];

      client.execute({ sql, args: params })
        .then(result => callback(null, result.rows.map(toPlain)))
        .catch(err  => callback(err, null));
    },

    /**
     * db.serialize(fn)
     * sqlite3 queues statements; with Turso the HTTP pipeline handles ordering.
     * Just run fn() — callbacks still fire in sequence.
     */
    serialize(fn) { fn(); },

    /**
     * db.prepare(sql)
     * Collects .run() calls in a batch, executes them atomically on .finalize().
     * Used only for the 24-row history seed — safe to batch.
     */
    prepare(sql) {
      const batch = [];
      return {
        run(...args) { batch.push({ sql, args }); },
        finalize() {
          if (batch.length === 0) return;
          client.batch(batch, 'write')
            .catch(err => console.error('[TursoDB] batch error:', err.message));
        },
      };
    },

    close(callback) {
      client.close();
      if (typeof callback === 'function') callback(null);
    },
  };

  // Initialise schema in the background.
  // Routes only receive traffic after Node.js finishes starting, so this
  // will complete long before the first HTTP request arrives.
  initSchema(client).then(() => {
    console.log('✅ Turso schema ready — database is persistent across Render restarts');
  }).catch(err => {
    console.error('❌ Turso schema init failed:', err);
  });

  return db;
}

// ─── Schema initialisation ────────────────────────────────────────────────────
async function initSchema(client) {
  // Step 1: Create all tables in one atomic batch (guaranteed ordering)
  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      email     TEXT UNIQUE,
      password  TEXT,
      full_name TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS borewell_state (
      id               TEXT PRIMARY KEY,
      name             TEXT,
      is_motor_on      INTEGER DEFAULT 0,
      flow_rate        REAL    DEFAULT 0,
      efficiency       REAL    DEFAULT 0,
      voltage          REAL    DEFAULT 0,
      current          REAL    DEFAULT 0,
      run_time_total   REAL    DEFAULT 0,
      water_level      REAL    DEFAULT 0,
      ph               REAL    DEFAULT 7.2,
      tds              REAL    DEFAULT 250,
      turbidity        REAL    DEFAULT 1.2,
      total_liters     REAL    DEFAULT 0,
      current_status   TEXT,
      water_status     TEXT,
      turbidity_status TEXT,
      tds_status       TEXT,
      last_updated     TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS readings_history (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      borewell_id      TEXT,
      flow_rate        REAL,
      water_level      REAL,
      efficiency       REAL,
      voltage          REAL,
      current          REAL,
      ph               REAL,
      tds              REAL,
      turbidity        REAL,
      total_liters     REAL,
      current_status   TEXT,
      water_status     TEXT,
      turbidity_status TEXT,
      tds_status       TEXT,
      timestamp        TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS aqi_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      pm25      REAL,
      pm10      REAL,
      co2       REAL,
      tvoc      REAL,
      hcho      REAL,
      temp      REAL,
      humidity  REAL,
      aqi       REAL,
      timestamp TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_readings_borewell_time
          ON readings_history(borewell_id, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_aqi_time
          ON aqi_history(timestamp)`
  ], 'write');

  // SECURITY FIX (H-06): Migrated default admin username from 'trifecta' to 'fern'
  const userRow = await client.execute(
    "SELECT COUNT(*) as cnt FROM users WHERE email = 'fern'"
  );
  if (Number(userRow.rows[0].cnt) === 0) {
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD
      || (() => {
          const rand = crypto.randomBytes(12).toString('base64url');
          console.log('🔑 ══════════════════════════════════════════════════');
          console.log('🔑  FIRST-BOOT ADMIN CREDENTIALS FOR TURSO (save these now!)');
          console.log(`🔑  Username : fern`);
          console.log(`🔑  Password : ${rand}`);
          console.log('🔑  To keep this password across restarts, set:');
          console.log('🔑  DEFAULT_ADMIN_PASSWORD env var in Render Dashboard');
          console.log('🔑 ══════════════════════════════════════════════════');
          return rand;
        })();
    const hashed = hashPassword(adminPassword);
    await client.execute({
      sql:  "INSERT INTO users (email, password, full_name) VALUES ('fern', ?, 'Fern Admin')",
      args: [hashed],
    });
    console.log("✅ Default user 'fern' seeded in Turso");
  }

  // Step 3: Seed borewell state rows — only if empty
  const bwRow = await client.execute('SELECT COUNT(*) as cnt FROM borewell_state');
  if (Number(bwRow.rows[0].cnt) === 0) {
    await client.batch([
      "INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-01', 'Borewell 1', 5.5)",
      "INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-02', 'Borewell 2', 3.2)",
      "INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-03', 'Borewell 3', 4.8)"
    ], 'write');
    console.log('✅ Borewell state seeded in Turso');
  }

  // Step 4: Seed 24 h of initial readings — only if empty
  const histRow = await client.execute('SELECT COUNT(*) as cnt FROM readings_history');
  if (Number(histRow.rows[0].cnt) === 0) {
    const now = Date.now();
    const seedBatch = [];
    for (let i = 24; i >= 0; i--) {
      const t       = (24 - i) / 24;
      const timeStr = new Date(now - i * 3_600_000).toISOString().replace('T', ' ').substring(0, 19);
      const lvl     = parseFloat((5.2  + Math.sin(t * Math.PI * 2) * 0.4  + Math.random() * 0.1).toFixed(2));
      const ph      = parseFloat((7.35 + Math.sin(t * Math.PI * 4) * 0.15 + Math.random() * 0.05).toFixed(2));
      const tds     = parseFloat((215  + Math.sin(t * Math.PI * 2) * 15   + Math.random() * 4).toFixed(1));
      const turb    = parseFloat((1.4  + Math.cos(t * Math.PI * 2) * 0.3  + Math.random() * 0.08).toFixed(2));
      seedBatch.push({
        sql:  `INSERT INTO readings_history
               (borewell_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ['BW-01', 0.0, lvl, 0.0, 230.0, 0.0, ph, tds, turb, timeStr],
      });
    }
    await client.batch(seedBatch, 'write');
    console.log('✅ Initial 24h readings history seeded in Turso');
  }
}

module.exports = { createTursoDb };
