/**
 * Zero-Dependency Sliding Window Rate Limiter Middleware
 * ======================================================
 * 
 * Protects ingestion and query endpoints from denial-of-service,
 * brute-force, or runaway loop conditions in edge device firmware.
 * 
 * Configurable via:
 *   - RATE_LIMIT_WINDOW_MS: Window size in ms (default: 1 minute)
 *   - RATE_LIMIT_MAX_REQUESTS: Max requests per IP within the window (default: 120)
 * 
 * AUDIT FIX: Finding 4.4 (Severity: High)
 */

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000; // 1 minute
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 120; // 2 requests per second average

// Map to store requests: IP address -> Array of timestamps
const requestMap = new Map();

// Periodic cleanup of inactive IPs from memory to prevent memory leaks (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestMap.entries()) {
    const activeTimestamps = timestamps.filter(t => t > now - WINDOW_MS);
    if (activeTimestamps.length === 0) {
      requestMap.delete(ip);
    } else {
      requestMap.set(ip, activeTimestamps);
    }
  }
}, 600000);

function rateLimiter(req, res, next) {
  // SECURITY FIX (H-08): Use req.ip (respects app.set('trust proxy', 1)) instead of
  // raw X-Forwarded-For which can be spoofed by clients.
  const ip = req.ip;
  const now = Date.now();

  if (!requestMap.has(ip)) {
    requestMap.set(ip, []);
  }

  const timestamps = requestMap.get(ip);

  // Filter out timestamps that lie outside the sliding window
  const recentTimestamps = timestamps.filter(t => t > now - WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_REQUESTS) {
    console.warn(`🚫 Rate limit exceeded: ${recentTimestamps.length} requests in last window from IP ${ip} on ${req.method} ${req.path}`);
    return res.status(429).json({
      error: 'Too many requests.',
      message: `Rate limit of ${MAX_REQUESTS} requests per minute exceeded. Please slow down.`
    });
  }

  // Record current request timestamp
  recentTimestamps.push(now);
  requestMap.set(ip, recentTimestamps);

  next();
}

module.exports = rateLimiter;
