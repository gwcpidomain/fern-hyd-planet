#!/usr/bin/env node
/**
 * Developer CLI: Set or clear the per-site access password for a tenant.
 *
 * Usage:
 *   node backend/scripts/set-site-password.js <tenant_id> <password>
 *   node backend/scripts/set-site-password.js <tenant_id> --clear
 *
 * Examples:
 *   node backend/scripts/set-site-password.js fern MyStr0ngP@ss
 *   node backend/scripts/set-site-password.js trifecta SecurePass123
 *   node backend/scripts/set-site-password.js fern --clear
 *
 * How it works:
 *   - Hashes the password using PBKDF2-SHA512 (same as user passwords).
 *   - Stores in tenants.site_password_hash.
 *   - At login, user password must match BOTH user-level AND site-level hash.
 *   - NULL site_password_hash = no gate (backwards compatible).
 *   - DEVELOPERS ONLY. Not exposed via any API.
 */

const path = require('path');
const crypto = require('crypto');

const tenantId = process.argv[2];
const rawPassword = process.argv[3];

if (!tenantId || !rawPassword) {
  console.error('Usage: node set-site-password.js <tenant_id> <password>');
  console.error('       node set-site-password.js <tenant_id> --clear');
  process.exit(1);
}

function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plaintext, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function getDb() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    const { createClient } = require('@libsql/client');
    return {
      type: 'turso',
      client: createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
    };
  }
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'environment.db');
  return { type: 'sqlite', client: new sqlite3.Database(dbPath) };
}

async function main() {
  const db = await getDb();
  const clearing = rawPassword === '--clear';
  const newHash = clearing ? null : hashPassword(rawPassword);
  const action = clearing ? 'Clearing' : 'Setting';
  console.log(`${action} site password for tenant: ${tenantId}`);

  if (db.type === 'turso') {
    try {
      const check = await db.client.execute({ sql: 'SELECT id FROM tenants WHERE id = ?', args: [tenantId] });
      if (!check.rows.length) { console.error(`Tenant "${tenantId}" not found.`); process.exit(1); }
      await db.client.execute({ sql: 'UPDATE tenants SET site_password_hash = ? WHERE id = ?', args: [newHash, tenantId] });
      console.log(clearing ? `Site password cleared for "${tenantId}".` : `Site password set for "${tenantId}". Hash stored, plaintext "${rawPassword}" discarded.`);
    } catch (e) { console.error('Error:', e.message); process.exit(1); }
  } else {
    const sql3 = db.client;
    sql3.get('SELECT id FROM tenants WHERE id = ?', [tenantId], (err, row) => {
      if (err || !row) { console.error(`Tenant "${tenantId}" not found.`); sql3.close(); process.exit(1); }
      sql3.run('UPDATE tenants SET site_password_hash = ? WHERE id = ?', [newHash, tenantId], (updateErr) => {
        sql3.close();
        if (updateErr) { console.error('Update failed:', updateErr.message); process.exit(1); }
        console.log(clearing ? `Site password cleared for "${tenantId}".` : `Site password set for "${tenantId}". Hash stored, plaintext "${rawPassword}" discarded.`);
      });
    });
  }
}

main();
