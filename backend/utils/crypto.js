'use strict';

/**
 * Centralized Cryptographic Utilities
 * ====================================
 * Shared hashing and session token verification functions across backend modules.
 */

const crypto = require('crypto');
const { SESSION_SECRET: secret } = require('../config');

/**
 * Hashes a password using PBKDF2 with SHA-512 and a random or provided salt.
 */
function hashPassword(password, salt) {
  if (!password) return '';
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 10000, 64, 'sha512').toString('hex');
  return `${finalSalt}:${hash}`;
}

/**
 * Generates an HMAC-SHA256 signed session token containing user and tenant information.
 */
function generateToken(userId, email, tenantId) {
  const payload = JSON.stringify({ userId, email, tenantId, expires: Date.now() + 24 * 3600 * 1000 });
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64');
}

/**
 * Verifies an HMAC-SHA256 session token and returns the parsed payload if valid.
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64').toString('ascii');
    const [payloadStr, signature] = raw.split('.');
    if (!payloadStr || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(payloadStr);
    if (Date.now() > payload.expires) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword,
  generateToken,
  verifyToken
};
