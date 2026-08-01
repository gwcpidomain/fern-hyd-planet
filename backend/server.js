const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const db = require('./db');
const { requireApiKey, requireDashboardAuth } = require('./middleware/auth');
const { 
  safeFloat, 
  validateWaterPayload, 
  validateAqiPayload, 
  validateControlPayload 
} = require('./middleware/validate');
const rateLimiter = require('./middleware/rate-limit');
const { startTuyaPoller } = require('./tuyaService');

const app = express();

// AUDIT FIX (Finding 4.2 — High): Enable configurable CORS origin restriction
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*'
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8000;

// --- STARTUP SECURITY CHECK ---
// Warn loudly if critical env vars are missing so misconfiguration is immediately visible in Render logs
const missingEnvVars = [];
if (!process.env.DEVICE_API_KEY) missingEnvVars.push('DEVICE_API_KEY');
if (!process.env.SESSION_SECRET)  missingEnvVars.push('SESSION_SECRET');
if (missingEnvVars.length > 0) {
  console.warn('⚠️  SECURITY WARNING: The following environment variables are NOT set:');
  missingEnvVars.forEach(v => console.warn(`   - ${v}`));
  console.warn('   Device and session auth are running in OPEN/INSECURE mode.');
  console.warn('   Set these in your Render Dashboard → Environment section.');
}

// Store connected browser clients
const clients = new Set();

// --- API ENDPOINTS ---

// AUDIT FIX (Finding 2.5 — High): Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime_seconds: Math.floor(process.uptime()),
    database: db ? 'connected' : 'disconnected',
    active_websockets: clients.size,
    timestamp: new Date().toISOString()
  });
});

// 1. Get Live State (Restores values on Page Load)
app.get('/api/borewells', requireDashboardAuth, (req, res) => {
  db.all("SELECT * FROM borewell_state ORDER BY id ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Get Historical Data (For Trend Graphs)
app.get('/api/history/:id', requireDashboardAuth, (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit, 10) || 50; // Last 50 points
  db.all("SELECT * FROM readings_history WHERE borewell_id = ? ORDER BY timestamp DESC LIMIT ?", [id, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.reverse()); // Return in chronological order
  });
});

app.get('/api/aqi/history', requireDashboardAuth, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  db.all('SELECT * FROM aqi_history ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.reverse());
  });
});

// CSV Export Endpoint - Merges Water and Air historical readings
app.get('/api/export/csv', requireDashboardAuth, (req, res) => {
  db.all('SELECT * FROM readings_history ORDER BY timestamp DESC', [], (err, waterRows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all('SELECT * FROM aqi_history ORDER BY timestamp DESC', [], (err, aqiRows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const combined = [];
      
      if (waterRows) {
        waterRows.forEach(row => {
          combined.push({
            timestamp: row.timestamp,
            type: 'Water',
            id: row.borewell_id,
            water_level: row.water_level,
            flow_rate: row.flow_rate,
            efficiency: row.efficiency,
            voltage: row.voltage,
            current: row.current,
            ph: row.ph,
            tds: row.tds,
            turbidity: row.turbidity,
            pm25: '',
            pm10: '',
            co2: '',
            tvoc: '',
            hcho: '',
            temp: '',
            humidity: '',
            aqi: ''
          });
        });
      }
      
      if (aqiRows) {
        aqiRows.forEach(row => {
          combined.push({
            timestamp: row.timestamp,
            type: 'Air',
            id: 'AQI-01',
            water_level: '',
            flow_rate: '',
            efficiency: '',
            voltage: '',
            current: '',
            ph: '',
            tds: '',
            turbidity: '',
            pm25: row.pm25,
            pm10: row.pm10,
            co2: row.co2,
            tvoc: row.tvoc,
            hcho: row.hcho,
            temp: row.temp,
            humidity: row.humidity,
            aqi: row.aqi
          });
        });
      }
      
      // Sort chronologically, newest first
      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const headers = [
        'Timestamp', 'Type', 'Source ID', 'Water Level (%)', 'Flow Rate (L/min)', 'Efficiency (%)',
        'Voltage (V)', 'Current (A)', 'pH', 'TDS (ppm)', 'Turbidity (NTU)', 'PM2.5 (ug/m3)',
        'PM10 (ug/m3)', 'CO2 (ppm)', 'TVOC (ppm)', 'HCHO (ppm)', 'Temperature (C)', 'Humidity (%)', 'AQI'
      ];
      
      let csvContent = headers.join(',') + '\n';
      
      combined.forEach(row => {
        const line = [
          row.timestamp,
          row.type,
          row.id,
          row.water_level,
          row.flow_rate,
          row.efficiency,
          row.voltage,
          row.current,
          row.ph,
          row.tds,
          row.turbidity,
          row.pm25,
          row.pm10,
          row.co2,
          row.tvoc,
          row.hcho,
          row.temp,
          row.humidity,
          row.aqi
        ].map(val => {
          const str = String(val === null || val === undefined ? '' : val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
        
        csvContent += line + '\n';
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=environmental_readings.csv');
      res.status(200).send(csvContent);
    });
  });
});

// 3. Control Toggle (UI -> Backend -> LoRa)
app.post('/api/control', requireDashboardAuth, validateControlPayload, (req, res) => {
  const { id, command } = req.body;
  console.log(`🔌 Command to Borewell ${id}: ${command}`);

  const state = command === 'ON' ? 1 : 0;
  db.run("UPDATE borewell_state SET is_motor_on = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", [state, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    // Broadcast status update to all connected dashboard clients
    broadcast({
      type: 'control_update',
      id: id,
      is_motor_on: state === 1
    });

    res.json({ status: 'Command Sent', id, state: command });
  });
});

// 5. Receive Data from Heltec Gateway (Heltec -> Backend)
app.post('/api/push', requireApiKey, validateWaterPayload, (req, res) => {
  const payload = req.body;

  const id = payload.id || 'BW-01';
  
  // Retrieve current row values to prevent partial updates from clearing other sensors
  db.get("SELECT * FROM borewell_state WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("DB read error during ingestion:", err.message);
      return res.status(500).json({ error: err.message });
    }
    
    const current_state = row || {};
    
    // Parse values from payload safely using safeFloat validator helper (Finding 5.4)
    const rawFlow = payload.flow_rate !== undefined ? payload.flow_rate : (payload.flow_lpm !== undefined ? payload.flow_lpm : (payload.flow !== undefined ? payload.flow : null));
    const flow = safeFloat(rawFlow, current_state.flow_rate !== undefined ? current_state.flow_rate : 0.0);

    const rawCurrent = payload.current !== undefined ? payload.current : (payload.a !== undefined ? payload.a : null);
    const a = safeFloat(rawCurrent, current_state.current !== undefined ? current_state.current : 0.0);

    const phVal = safeFloat(payload.ph);
    const tdsVal = safeFloat(payload.tds);
    const rawTurb = payload.turbidity !== undefined ? payload.turbidity : (payload.turbidity_ntu !== undefined ? payload.turbidity_ntu : null);
    const turbVal = safeFloat(rawTurb);

    const incomingLevelTemp = payload.wl !== undefined ? payload.wl : (payload.water_level !== undefined ? payload.water_level : null);
    const wlVal = safeFloat(incomingLevelTemp);

    // Check if incoming payload is a zero-packet (sensor dropout/offline condition)
    const isZeroWaterPayload = (phVal === 0 || phVal === 0.0) && (tdsVal === 0 || tdsVal === 0.0);

    // 1. Derive Voltage (v) based on Current (a)
    let v = payload.v !== undefined ? safeFloat(payload.v) : (a > 1.1 ? (228.0 - (a * 0.4) + (Math.sin(Date.now() / 5000) * 1.5)) : (235.0 + (Math.sin(Date.now() / 10000) * 1.0)));
    v = parseFloat(Number(v).toFixed(1));

    // 2. Derive Pump Efficiency (eff)
    let eff = payload.eff !== undefined ? safeFloat(payload.eff) : 0.0;
    if (payload.eff === undefined && a > 1.1 && flow > 0) {
      eff = Math.min(92, Math.max(50, Math.round((flow * 14.5) / a)));
    }

    // 3. Derive Water Level (wl) - simulating drawdown and aquifer recharge
    let wl = wlVal;
    if (isZeroWaterPayload || wl === 0) {
      wl = current_state.water_level !== undefined ? current_state.water_level : 5.5;
    } else if (wl === null) {
      let last_wl = current_state.water_level !== undefined ? current_state.water_level : 5.5;
      if (a > 1.1 && flow > 0) {
        // Drawdown: Water level decreases as we pump it out
        wl = Math.max(1.2, last_wl - 0.02 * (flow / 40.0));
      } else {
        // Recovery: Water level slowly rises back up to the aquifer static level (5.5m)
        wl = Math.min(5.5, last_wl + 0.005);
      }
    }
    wl = parseFloat(Number(wl).toFixed(2));

    // 4. Derive Run Time (rt)
    let rt = payload.rt !== undefined ? safeFloat(payload.rt) : null;
    if (rt === null) {
      let last_rt = current_state.run_time_total !== undefined ? current_state.run_time_total : 0.0;
      if (a > 1.1) {
        let deltaHours = 1.0 / 3600.0;
        if (current_state.last_updated) {
          const lastTime = new Date(current_state.last_updated + " UTC").getTime();
          const deltaMs = Date.now() - lastTime;
          if (deltaMs > 0 && deltaMs < 300000) {
            deltaHours = deltaMs / (1000.0 * 3600.0);
          }
        }
        rt = last_rt + deltaHours;
      } else {
        rt = last_rt;
      }
    }
    rt = parseFloat(Number(rt).toFixed(3));

    // Preserve last values on zero packet
    const ph = isZeroWaterPayload ? (current_state.ph !== undefined ? current_state.ph : 7.2) : (phVal !== null ? phVal : (current_state.ph !== undefined ? current_state.ph : 7.2));
    const tds = isZeroWaterPayload ? (current_state.tds !== undefined ? current_state.tds : 250.0) : (tdsVal !== null ? tdsVal : (current_state.tds !== undefined ? current_state.tds : 250.0));
    const turbidity = isZeroWaterPayload ? (current_state.turbidity !== undefined ? current_state.turbidity : 1.2) : (turbVal !== null ? turbVal : (current_state.turbidity !== undefined ? current_state.turbidity : 1.2));
    
    const rawTotalLiters = payload.total_liters !== undefined ? payload.total_liters : null;
    const total_liters = safeFloat(rawTotalLiters, current_state.total_liters !== undefined ? current_state.total_liters : 0.0);

    const current_status = payload.current_status !== undefined ? payload.current_status : (current_state.current_status !== undefined ? current_state.current_status : 'OFF');
    const water_status = isZeroWaterPayload ? (current_state.water_status || 'PROBE DRY') : (payload.water_status !== undefined ? payload.water_status : (current_state.water_status !== undefined ? current_state.water_status : 'NORMAL'));
    const turbidity_status = isZeroWaterPayload ? (current_state.turbidity_status || 'CLEAR') : (payload.turbidity_status !== undefined ? payload.turbidity_status : (current_state.turbidity_status !== undefined ? current_state.turbidity_status : 'CLEAR'));
    const tds_status = isZeroWaterPayload ? (current_state.tds_status || 'GOOD') : (payload.tds_status !== undefined ? payload.tds_status : (current_state.tds_status !== undefined ? current_state.tds_status : 'GOOD'));

    // Derive motor status: ON if current (amps) > 1.1A, else OFF
    const is_motor_on = a > 1.1 ? 1 : 0;

    // Perform database UPDATE of live state
    db.run(`UPDATE borewell_state SET 
      flow_rate = ?, efficiency = ?, voltage = ?, current = ?, run_time_total = ?, water_level = ?, 
      ph = ?, tds = ?, turbidity = ?, is_motor_on = ?, total_liters = ?, current_status = ?, 
      water_status = ?, turbidity_status = ?, tds_status = ?, last_updated = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [flow, eff, v, a, rt, wl, ph, tds, turbidity, is_motor_on, total_liters, current_status, water_status, turbidity_status, tds_status, id],
      function (updateErr) {
        if (updateErr) {
          console.error("DB Update Error during ingestion:", updateErr.message);
          return res.status(500).json({ error: "Failed to update borewell state." });
        }

        // AUDIT FIX (Finding 3.1 — Critical): INSERT reading into history on every ingest, not just 5-min intervals
        db.run(`INSERT INTO readings_history 
          (borewell_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity, total_liters, current_status, water_status, turbidity_status, tds_status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, flow, wl, eff, v, a, ph, tds, turbidity, total_liters, current_status, water_status, turbidity_status, tds_status],
          function (insertErr) {
            if (insertErr) {
              console.error("DB History insertion error during ingestion:", insertErr.message);
              // Non-fatal to client response, but logged.
            }

            console.log(`💧 Water Data Ingested (Merged & Logged): ID=${id}, Flow=${flow} LPM, TDS=${tds} ppm (${tds_status}), pH=${ph} (${water_status}), Turbidity=${turbidity} NTU (${turbidity_status}), Amps=${a} (${current_status}), MotorOn=${is_motor_on === 1}`);

            // Broadcast to Frontend
            broadcast({
              type: 'water',
              id: id,
              timestamp: new Date().toISOString(),
              isMotorOn: is_motor_on === 1,
              data: {
                flowRate: flow,
                efficiency: eff,
                voltage: v,
                current: a,
                runTime: rt,
                waterLevel: wl,
                ph: ph,
                tds: tds,
                turbidity: turbidity,
                totalLiters: total_liters,
                currentStatus: current_status,
                waterStatus: water_status,
                turbidityStatus: turbidity_status,
                tdsStatus: tds_status
              }
            });

            // AUDIT FIX (Finding 2.2 — Critical): Send response inside the db run callback block only
            res.json({ status: 'Success', id });
          }
        );
      }
    );
  });
});

// CPCB AQI Calculation Utility
function calculateCpcbSubIndex(conc, pollutant) {
  const breakpoints = {
    pm25: [
      { cL: 0, cH: 30, iL: 0, iH: 50 },
      { cL: 31, cH: 60, iL: 51, iH: 100 },
      { cL: 61, cH: 90, iL: 101, iH: 200 },
      { cL: 91, cH: 120, iL: 201, iH: 300 },
      { cL: 121, cH: 250, iL: 301, iH: 400 },
      { cL: 251, cH: 500, iL: 401, iH: 500 },
    ],
    pm10: [
      { cL: 0, cH: 50, iL: 0, iH: 50 },
      { cL: 51, cH: 100, iL: 51, iH: 100 },
      { cL: 101, cH: 250, iL: 101, iH: 200 },
      { cL: 251, cH: 350, iL: 201, iH: 300 },
      { cL: 351, cH: 430, iL: 301, iH: 400 },
      { cL: 431, cH: 600, iL: 401, iH: 500 },
    ]
  };

  const bp = breakpoints[pollutant];
  if (!bp) return 0;
  const range = bp.find(b => conc >= b.cL && conc <= b.cH);
  if (!range) return conc > bp[bp.length - 1].cH ? 500 : 0;

  return Math.round(((range.iH - range.iL) / (range.cH - range.cL)) * (conc - range.cL) + range.iL);
}

// AQI Field-Name Normalizer
// Maps every known ESP32 / sensor firmware variant to the canonical field name.
// This runs BEFORE validation so firmware-locked devices are never rejected for naming differences.
function normalizeAqiPayload(raw) {
  const p = {};

  // pm25 aliases: pm2_5, pm2.5, PM25, PM2.5, PM2_5, pm25, particulate25, pm_2_5
  const pm25Val = raw.pm25 ?? raw.pm2_5 ?? raw['pm2.5'] ?? raw.PM25 ?? raw['PM2.5'] ?? raw.PM2_5 ?? raw.particulate25 ?? raw.pm_2_5;
  if (pm25Val !== undefined) p.pm25 = pm25Val;

  // pm10 aliases: PM10, pm_10, particulate10
  const pm10Val = raw.pm10 ?? raw.PM10 ?? raw.pm_10 ?? raw.particulate10;
  if (pm10Val !== undefined) p.pm10 = pm10Val;

  // co2 aliases: co2_ppm, CO2, carbondioxide, carbon_dioxide
  const co2Val = raw.co2 ?? raw.co2_ppm ?? raw.CO2 ?? raw.carbondioxide ?? raw.carbon_dioxide;
  if (co2Val !== undefined) p.co2 = co2Val;

  // tvoc aliases: TVOC, tVOC, voc, VOC, total_voc
  const tvocVal = raw.tvoc ?? raw.TVOC ?? raw.tVOC ?? raw.voc ?? raw.VOC ?? raw.total_voc;
  if (tvocVal !== undefined) p.tvoc = tvocVal;

  // hcho aliases: HCHO, hco, formaldehyde, formalin
  const hchoVal = raw.hcho ?? raw.HCHO ?? raw.hco ?? raw.formaldehyde ?? raw.formalin;
  if (hchoVal !== undefined) p.hcho = hchoVal;

  // temp aliases: temperature, TEMP, Temperature, tmp, t
  const tempVal = raw.temp ?? raw.temperature ?? raw.TEMP ?? raw.Temperature ?? raw.tmp ?? raw.t;
  if (tempVal !== undefined) p.temp = tempVal;

  // humidity aliases: hum, RH, rh, Humidity, HUMIDITY
  const humVal = raw.humidity ?? raw.hum ?? raw.RH ?? raw.rh ?? raw.Humidity ?? raw.HUMIDITY;
  if (humVal !== undefined) p.humidity = humVal;

  return p;
}

app.post('/api/aqi', requireApiKey, (req, res, next) => {
  // ── DIAGNOSTIC LOG ─────────────────────────────────────────────────────────
  // Prints the raw body BEFORE any validation so you can see exactly what the
  // ESP32 is sending — check Render logs for "📡 AQI RAW PAYLOAD" lines.
  console.log('📡 AQI RAW PAYLOAD received from', req.ip, '→', JSON.stringify(req.body));
  // ───────────────────────────────────────────────────────────────────────────

  // Normalize field names to handle any ESP32 firmware variant
  req.body = normalizeAqiPayload(req.body);
  console.log('🔄 AQI Normalized payload →', JSON.stringify(req.body));

  next();
}, validateAqiPayload, (req, res) => {
  const { pm25, pm10, co2, tvoc, hcho, temp, humidity } = req.body;
  
  // Safe parsing values
  const safePm25 = safeFloat(pm25, 0);
  const safePm10 = safeFloat(pm10, 0);

  // Compute official CPCB AQI
  const pm25Idx = calculateCpcbSubIndex(safePm25, 'pm25');
  const pm10Idx = calculateCpcbSubIndex(safePm10, 'pm10');
  const score = Math.max(pm25Idx, pm10Idx);

  const getCategory = (v) => {
    if (v <= 50) return "Good";
    if (v <= 100) return "Satisfactory";
    if (v <= 200) return "Moderate";
    if (v <= 300) return "Poor";
    if (v <= 400) return "Very Poor";
    return "Severe";
  };

  db.run(`INSERT INTO aqi_history 
    (pm25, pm10, co2, tvoc, hcho, temp, humidity, aqi) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [safePm25, safePm10, safeFloat(co2, 400), safeFloat(tvoc, 0), safeFloat(hcho, 0), safeFloat(temp, 0), safeFloat(humidity, 0), score],
    function(err) {
      if (err) {
        console.error("AQI DB Error:", err.message);
        return res.status(500).json({ error: "Failed to store AQI data." });
      }
      
      broadcast({
        type: 'aqi',
        timestamp: new Date().toISOString(),
        data: {
          pm25: safePm25, 
          pm10: safePm10, 
          co2: safeFloat(co2, 400), 
          tvoc: safeFloat(tvoc, 0), 
          hcho: safeFloat(hcho, 0), 
          temp: safeFloat(temp, 0), 
          humidity: safeFloat(humidity, 0),
          aqi: score,
          category: getCategory(score),
          dominant_pollutant: pm25Idx >= pm10Idx ? "pm25" : "pm10"
        }
      });

      console.log(`🌬️ AQI Data Ingested: ${score} (${getCategory(score)}). PM2.5=${safePm25}`);

      res.json({
        aqi: score,
        category: getCategory(score),
        dominant_pollutant: pm25Idx >= pm10Idx ? "pm25" : "pm10"
      });
    }
  );
});

// --- AUTHENTICATION ENDPOINTS ---

const crypto = require('crypto');
const { SESSION_SECRET: secret } = require('./config');

function hashPassword(password, salt) {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 10000, 64, 'sha512').toString('hex');
  return `${finalSalt}:${hash}`;
}

function generateToken(userId, email) {
  const payload = JSON.stringify({ userId, email, expires: Date.now() + 24 * 3600 * 1000 });
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64');
}

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

// 1. User login (supports URL encoded form data)
app.post('/api/auth/login', (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ detail: "Username and password required." });
  }

  db.get('SELECT id, email, password, full_name FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ detail: "Internal database login error." });
    }
    if (!user) {
      return res.status(401).json({ detail: "Incorrect username or password." });
    }

    const storedPassword = user.password;
    let passwordMatched = false;
    if (storedPassword.includes(':')) {
      const [salt, hash] = storedPassword.split(':');
      const checkHashBuf = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
      const storedHashBuf = Buffer.from(hash, 'hex');
      passwordMatched = checkHashBuf.length === storedHashBuf.length &&
        crypto.timingSafeEqual(checkHashBuf, storedHashBuf);
    } else {
      // Legacy plaintext fallback (timing-safe via fixed-length comparison)
      passwordMatched = storedPassword.length === password.length &&
        crypto.timingSafeEqual(Buffer.from(storedPassword), Buffer.from(password));
    }

    if (!passwordMatched) {
      return res.status(401).json({ detail: "Incorrect username or password." });
    }

    const token = generateToken(user.id, user.email);
    res.json({ access_token: token });
  });
});

// 2. User registration
app.post('/api/auth/register', (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: "Username and password required." });
  }

  const hashedPassword = hashPassword(password);

  db.run('INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)', [email, hashedPassword, full_name || email], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ detail: "Username already exists." });
      }
      console.error('Registration error:', err);
      return res.status(500).json({ detail: "Internal database registration error." });
    }
    res.json({ status: "Success", userId: this.lastID });
  });
});

// 3. Get current authenticated user profile
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: "Unauthorized." });
  }

  const token = authHeader.split(' ')[1];

  // Try dynamic session first
  const session = verifyToken(token);
  if (session) {
    db.get('SELECT id, email, full_name FROM users WHERE id = ?', [session.userId], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ detail: "Unauthorized access token." });
      }
      res.json(user);
    });
    return;
  }

  // Fallback to legacy base64 decoding
  try {
    const decoded = Buffer.from(token, 'base64').toString('ascii').split(':');
    const email = decoded[0];
    const password = decoded[1];

    db.get('SELECT id, email, password, full_name FROM users WHERE email = ?', [email], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ detail: "Unauthorized access token." });
      }
      
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
        return res.status(401).json({ detail: "Unauthorized access token." });
      }
      
      res.json({ id: user.id, email: user.email, full_name: user.full_name });
    });
  } catch (e) {
    return res.status(401).json({ detail: "Invalid session token." });
  }
});

// 5. Locations & Status Management (Syncs with Frontend Polling)
app.get('/api/locations', requireDashboardAuth, (req, res) => {
  res.json([
    { location_id: "BLR-01", name: "BLR-01", latitude: 12.9716, longitude: 77.5946, online: true, last_seen: new Date().toISOString() }
  ]);
});

app.get('/api/locations/status', requireDashboardAuth, (req, res) => {
  res.json([
    { location_id: "BLR-01", name: "BLR-01", latitude: 12.9716, longitude: 77.5946, online: true, last_seen: new Date().toISOString() }
  ]);
});

app.get('/api/location/:name/capabilities', requireDashboardAuth, (req, res) => {
  res.json({ has_aqi: true, has_water: true });
});

// 6. Devices Listing — dynamic status from DB timestamps
app.get('/api/devices', requireDashboardAuth, (req, res) => {
  const ONLINE_THRESHOLD_MS = 30000; // 30 seconds

  // Query latest water update and latest AQI entry in parallel
  db.get("SELECT last_updated FROM borewell_state WHERE id = 'BW-01'", [], (err, bwRow) => {
    db.get("SELECT timestamp FROM aqi_history ORDER BY id DESC LIMIT 1", [], (err2, aqiRow) => {
      const now = Date.now();

      // Parse SQLite timestamps (stored as "YYYY-MM-DD HH:MM:SS" in UTC)
      const bwLastMs = bwRow?.last_updated
        ? new Date(bwRow.last_updated.replace(' ', 'T') + 'Z').getTime()
        : 0;
      const aqiLastMs = aqiRow?.timestamp
        ? new Date(aqiRow.timestamp.replace(' ', 'T') + 'Z').getTime()
        : 0;

      const isWaterOnline = bwLastMs > 0 && (now - bwLastMs) < ONLINE_THRESHOLD_MS;
      const isAqiOnline   = aqiLastMs > 0 && (now - aqiLastMs) < ONLINE_THRESHOLD_MS;

      const bwLastSeen  = bwLastMs  > 0 ? new Date(bwLastMs).toISOString()  : null;
      const aqiLastSeen = aqiLastMs > 0 ? new Date(aqiLastMs).toISOString() : null;

      res.json([
        { device_id: "BW-GW-01",   type: "GATEWAY", status: isWaterOnline ? "ONLINE" : "OFFLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: bwLastSeen  },
        { device_id: "BW-NODE-01", type: "SENSOR",  status: isWaterOnline ? "ONLINE" : "OFFLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: bwLastSeen  },
        { device_id: "AQI-NODE-01",type: "SENSOR",  status: isAqiOnline   ? "ONLINE" : "OFFLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: aqiLastSeen },
        { device_id: "LORA-HUB",   type: "BASE",    status: isWaterOnline ? "ONLINE" : "OFFLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: bwLastSeen  }
      ]);
    });
  });
});

// --- WEBSOCKET LOGIC ---

wss.on('connection', (ws, req) => {
  const urlParams = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
  const token = urlParams.get('token');
  const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || null;

  const handleAuthResult = (isAuthorized) => {
    if (!isAuthorized) {
      console.warn(`🚫 WebSocket connection rejected: Invalid or missing token from ${req.socket.remoteAddress}`);
      // Send message to client before closing to make debugging easier
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized WebSocket connection.' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    console.log('📱 Dashboard App Connected via WebSocket');
    clients.add(ws);

    // Small heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
      }
    }, 10000);

    const cleanup = () => {
      clearInterval(heartbeat);
      clients.delete(ws);
    };

    ws.on('close', () => {
      cleanup();
      console.log('❌ Dashboard Disconnected');
    });

    ws.on('error', () => {
      cleanup();
    });
  };

  // 1. Direct environment variable token match
  if (DASHBOARD_TOKEN && token === DASHBOARD_TOKEN) {
    handleAuthResult(true);
    return;
  }

  // 2. Verify dynamic session token or legacy fallback
  if (token) {
    const session = verifyToken(token);
    if (session) {
      db.get('SELECT id FROM users WHERE id = ?', [session.userId], (err, user) => {
        handleAuthResult(!err && !!user);
      });
      return;
    }

    // Try legacy base64 validation
    try {
      const decoded = Buffer.from(token, 'base64').toString('ascii').split(':');
      const email = decoded[0];
      const password = decoded[1];
      if (email && password) {
        db.get('SELECT password FROM users WHERE email = ?', [email], (err, user) => {
          if (err || !user) {
            handleAuthResult(false);
            return;
          }
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
          handleAuthResult(passwordMatched);
        });
        return;
      }
    } catch (e) {
      // Ignore
    }
  }

  // If no auth matches and DASHBOARD_TOKEN is set, reject. Otherwise, allow.
  if (DASHBOARD_TOKEN) {
    handleAuthResult(false);
  } else {
    handleAuthResult(true);
  }
});

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// --- HARDWARE SIMULATOR (For Local Testing) ---
const simulateHardware = () => {
  console.log("🛠️ Starting Hardware Simulator...");
  setInterval(() => {
    // 1. Simulate Water/Borewell Data
    for (let i = 1; i <= 3; i++) {
      const mockWaterData = {
        location_id: "default",
        device_id: `borewell-${i}`,
        type: 'water',
        timestamp: new Date().toISOString(),
        data: {
          flowRate: (40 + Math.random() * 10).toFixed(1),
          efficiency: (70 + Math.random() * 10).toFixed(0),
          voltage: (230 + Math.random() * 5).toFixed(0),
          current: (8 + Math.random() * 2).toFixed(1),
          runTime: (4.5 + Math.random() * 0.1).toFixed(2),
          waterLevel: (50 + Math.sin(Date.now() / 10000) * 5).toFixed(1)
        }
      };
      broadcast(mockWaterData);
    }

    // 2. Simulate AQI Data
    const mockAqiData = {
      type: 'aqi',
      timestamp: new Date().toISOString(),
      data: {
        pm25: (10 + Math.random() * 5).toFixed(1),
        pm10: (20 + Math.random() * 10).toFixed(1),
        co2: (400 + Math.random() * 50).toFixed(0),
        tvoc: (0.1 + Math.random() * 0.05).toFixed(3),
        hcho: (0.02 + Math.random() * 0.01).toFixed(3),
        temp: (24 + Math.random() * 2).toFixed(1),
        humidity: (55 + Math.random() * 5).toFixed(0),
        aqi: (90 + Math.random() * 5).toFixed(0)
      }
    };
    broadcast(mockAqiData);

  }, 5000); // 5 second intervals to match ESP32
};

// Auto-start simulator for testing if env var SIMULATE_HARDWARE is set to true
if (process.env.SIMULATE_HARDWARE === 'true') {
  simulateHardware();
}

// 7. Start the Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🛠️ Starting Edge Backend Hub...`);
  console.log(`🚀 Edge Backend Hub Running on http://localhost:${PORT}`);

  // Start Tuya Cloud AQI poller (only runs when TUYA_* env vars are set)
  startTuyaPoller(db, broadcast);
});

// AUDIT FIX (Finding 7.3 — High): Graceful Shutdown Hook
// Ensure database is safely closed on SIGTERM / SIGINT to prevent SQLite file corruption.
const gracefulShutdown = () => {
  console.log('🔄 Server shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    db.close((err) => {
      if (err) console.error('Error closing SQLite DB during shutdown:', err.message);
      else console.log('Database connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
