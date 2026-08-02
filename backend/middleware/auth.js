/**
 * Authentication Middleware
 * =========================
 * 
 * Two authentication modes:
 * 
 * 1. API Key — for edge devices (ESP32, Heltec LoRa Receiver)
 *    Provide via:  X-API-Key header  OR  ?key= query parameter
 *    Configured via:  DEVICE_API_KEY environment variable
 *
 * 2. Dashboard Token — for browser clients (Next.js dashboard)
 *    Provide via:  Authorization: Bearer <token> header
 *    Configured via:  DASHBOARD_TOKEN environment variable
 *
 * BACKWARDS COMPATIBILITY:
 *   If the corresponding env var is NOT set, auth is BYPASSED with a
 *   console warning. This ensures existing deployments keep working
 *   while new/production deployments can enforce auth by setting env vars.
 */

const DEVICE_API_KEY = process.env.DEVICE_API_KEY || null;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || null;

// Track whether we've already logged the warning (avoid console spam)
let deviceAuthWarned = false;
let dashboardAuthWarned = false;

/**
 * Middleware: Require a valid API key for device ingestion endpoints.
 * Used on: POST /api/push, POST /api/aqi
 */
function requireApiKey(req, res, next) {
    if (!DEVICE_API_KEY) {
        if (!deviceAuthWarned) {
            console.warn('⚠️  DEVICE_API_KEY not set — device authentication DISABLED. Set this env var in production!');
            deviceAuthWarned = true;
        }
        return next();
    }

    const key = req.headers['x-api-key'] || req.query.key;

    if (!key) {
        console.warn(`🚫 Auth rejected: Missing API key from ${req.ip} on ${req.method} ${req.path}`);
        return res.status(401).json({ error: 'Missing API key. Provide X-API-Key header or ?key= query parameter.' });
    }

    if (key !== DEVICE_API_KEY) {
        console.warn(`🚫 Auth rejected: Invalid API key from ${req.ip} on ${req.method} ${req.path}`);
        return res.status(403).json({ error: 'Invalid API key.' });
    }

    next();
}

const db = require('../db');
const crypto = require('crypto');

const { SESSION_SECRET: secret } = require('../config');

function verifyToken(token) {
  try {
    const raw = Buffer.from(token, 'base64').toString('ascii');
    const [payloadStr, signature] = raw.split('.');
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(payloadStr);
    if (Date.now() > payload.expires) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Middleware: Require a valid bearer token for dashboard endpoints.
 * Used on: GET /api/borewells, GET /api/history/:id, POST /api/control, etc.
 */
function requireDashboardAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (!DASHBOARD_TOKEN) {
            if (!dashboardAuthWarned) {
                console.warn('⚠️  DASHBOARD_TOKEN not set — dashboard authentication DISABLED. Set this env var in production!');
                dashboardAuthWarned = true;
            }
            return next();
        }
        return res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <token>' });
    }

    const token = authHeader.split(' ')[1];

    // 1. Direct environment variable token match (fallback/automated requests)
    if (DASHBOARD_TOKEN && token === DASHBOARD_TOKEN) {
        return next();
    }

    // 2. Cryptographic session token verification
    const session = verifyToken(token);
    if (session) {
        db.get('SELECT id, email, full_name FROM users WHERE id = ?', [session.userId], (err, user) => {
            if (err || !user) {
                return res.status(403).json({ error: 'Access denied: User account not found.' });
            }
            req.user = user;
            next();
        });
        return;
    }

    // SECURITY FIX (H-02): Legacy base64 auth path preserved for backward compat but
    // logged as deprecated. Will be removed in a future release.
    try {
        const decoded = Buffer.from(token, 'base64').toString('ascii').split(':');
        const email = decoded[0];
        const password = decoded[1];

        if (email && password) {
            db.get('SELECT id, email, password, full_name FROM users WHERE email = ?', [email], (err, user) => {
                if (err || !user) {
                    return res.status(403).json({ error: 'Access denied: Invalid credentials.' });
                }
                
                console.warn('⚠️  DEPRECATED: Legacy base64 token used by', email, '— migrate to HMAC session tokens.');
                const storedPassword = user.password;
                let passwordMatched = false;
                if (storedPassword.includes(':')) {
                    const [salt, hash] = storedPassword.split(':');
                    const checkHashBuf = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
                    const storedHashBuf = Buffer.from(hash, 'hex');
                    passwordMatched = checkHashBuf.length === storedHashBuf.length &&
                        crypto.timingSafeEqual(checkHashBuf, storedHashBuf);
                } else {
                    passwordMatched = storedPassword.length === password.length &&
                        crypto.timingSafeEqual(Buffer.from(storedPassword), Buffer.from(password));
                }

                if (!passwordMatched) {
                    return res.status(403).json({ error: 'Access denied: Incorrect password.' });
                }
                
                req.user = { id: user.id, email: user.email, full_name: user.full_name };
                next();
            });
            return;
        }
    } catch (e) {
        // Ignore fallback parsing errors
    }

    return res.status(403).json({ error: 'Malformed or expired access token.' });
}

module.exports = { requireApiKey, requireDashboardAuth, verifyToken };
