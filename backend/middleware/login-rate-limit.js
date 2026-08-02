/**
 * Login-Specific Rate Limiter Middleware
 * =======================================
 * 
 * Stricter rate limiter dedicated to authentication endpoints
 * (login + registration) to prevent credential brute-forcing.
 * 
 * Allows max 10 requests per IP within a 60-second window.
 * 
 * SECURITY FIX: Finding H-04 (Severity: High)
 */

const WINDOW_MS = 60000; // 1 minute
const MAX_ATTEMPTS = parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10;

// Map: IP → array of timestamps
const loginAttemptMap = new Map();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of loginAttemptMap.entries()) {
    const active = timestamps.filter(t => t > now - WINDOW_MS);
    if (active.length === 0) {
      loginAttemptMap.delete(ip);
    } else {
      loginAttemptMap.set(ip, active);
    }
  }
}, 300000);

function loginRateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();

  if (!loginAttemptMap.has(ip)) {
    loginAttemptMap.set(ip, []);
  }

  const timestamps = loginAttemptMap.get(ip);
  const recent = timestamps.filter(t => t > now - WINDOW_MS);

  if (recent.length >= MAX_ATTEMPTS) {
    console.warn(`🚫 Login rate limit exceeded: ${recent.length} attempts from IP ${ip} on ${req.method} ${req.path}`);
    return res.status(429).json({
      detail: `Too many login attempts. Please wait ${Math.ceil(WINDOW_MS / 1000)} seconds and try again.`
    });
  }

  recent.push(now);
  loginAttemptMap.set(ip, recent);

  next();
}

module.exports = { loginRateLimiter };
