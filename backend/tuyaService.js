'use strict';

/**
 * tuyaService.js
 * ──────────────
 * Background poller for the amiciSense 13-in-1 WiFi Air Quality Monitor
 * connected via Tuya Cloud OpenAPI.
 *
 * Required environment variables:
 *   TUYA_CLIENT_ID     — Access ID from Tuya Developer Console
 *   TUYA_CLIENT_SECRET — Access Secret from Tuya Developer Console
 *   TUYA_DEVICE_ID     — Device ID of the amiciSense unit
 *   TUYA_REGION_URL    — Regional API endpoint (e.g. https://openapi.tuyain.com)
 *
 * The service is started from server.js only when all four env vars are present.
 * It does NOT touch any frontend code or UI behaviour.
 */

const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

// ── CPCB AQI Sub-Index Calculator (same breakpoints as server.js) ─────────────
function calculateCpcbSubIndex(conc, pollutant) {
  const breakpoints = {
    pm25: [
      { cL: 0,   cH: 30,  iL: 0,   iH: 50  },
      { cL: 31,  cH: 60,  iL: 51,  iH: 100 },
      { cL: 61,  cH: 90,  iL: 101, iH: 200 },
      { cL: 91,  cH: 120, iL: 201, iH: 300 },
      { cL: 121, cH: 250, iL: 301, iH: 400 },
      { cL: 251, cH: 500, iL: 401, iH: 500 },
    ],
    pm10: [
      { cL: 0,   cH: 50,  iL: 0,   iH: 50  },
      { cL: 51,  cH: 100, iL: 51,  iH: 100 },
      { cL: 101, cH: 250, iL: 101, iH: 200 },
      { cL: 251, cH: 350, iL: 201, iH: 300 },
      { cL: 351, cH: 430, iL: 301, iH: 400 },
      { cL: 431, cH: 600, iL: 401, iH: 500 },
    ],
  };

  const bp = breakpoints[pollutant];
  if (!bp) return 0;
  const range = bp.find(b => conc >= b.cL && conc <= b.cH);
  if (!range) return conc > bp[bp.length - 1].cH ? 500 : 0;
  return Math.round(((range.iH - range.iL) / (range.cH - range.cL)) * (conc - range.cL) + range.iL);
}

function getCategory(aqi) {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

// ── Map Tuya status array to canonical sensor object ─────────────────────────
// Tuya returns an array of { code, value } objects. We map each to our DB schema.
// Scaling rules confirmed from the amiciSense 2C08 device specification:
//   temp_current  : raw integer / 10   -> degrees C  (e.g. 292 -> 29.2 C)
//   ch2o_value    : raw integer / 1000 -> mg/m3       (e.g. 4   -> 0.004 mg/m3)
//   voc_value     : raw integer / 1000 -> mg/m3       (e.g. 7   -> 0.007 mg/m3)
//   pm25_value, pm10, pm1, co2_value, humidity_value: used as-is (natural units)
function parseTuyaStatus(statusArray) {
  const map = {};
  for (const { code, value } of statusArray) {
    map[code] = value;
  }

  const pm25     = typeof map['pm25_value']     === 'number' ? map['pm25_value']           : 0;
  const pm10     = typeof map['pm10']           === 'number' ? map['pm10']                  : 0;
  const pm1      = typeof map['pm1']            === 'number' ? map['pm1']                   : 0;
  const co2      = typeof map['co2_value']      === 'number' ? map['co2_value']             : 400;
  const tvoc     = typeof map['voc_value']      === 'number' ? map['voc_value']  / 1000     : 0;
  const hcho     = typeof map['ch2o_value']     === 'number' ? map['ch2o_value'] / 1000     : 0;
  const temp     = typeof map['temp_current']   === 'number' ? map['temp_current']  / 10    : 0;
  const humidity = typeof map['humidity_value'] === 'number' ? map['humidity_value']        : 0;

  // CPCB AQI score
  const pm25Idx = calculateCpcbSubIndex(pm25, 'pm25');
  const pm10Idx = calculateCpcbSubIndex(pm10, 'pm10');
  const aqi     = Math.max(pm25Idx, pm10Idx);

  return { pm25, pm10, pm1, co2, tvoc, hcho, temp, humidity, aqi };
}

// ── Main exported function: startTuyaPoller ──────────────────────────────────
// Called once from server.js after the DB and WebSocket server are ready.
// Parameters:
//   db        — the existing db instance from db.js / db-turso.js
//   broadcast — the existing broadcast(data) helper from server.js
function startTuyaPoller(db, broadcast) {
  const {
    TUYA_CLIENT_ID,
    TUYA_CLIENT_SECRET,
    TUYA_DEVICE_ID,
    TUYA_REGION_URL,
    TUYA_TENANT_ID,   // Which tenant this physical device belongs to (e.g. 'fern')
  } = process.env;

  if (!TUYA_CLIENT_ID || !TUYA_CLIENT_SECRET || !TUYA_DEVICE_ID || !TUYA_REGION_URL) {
    console.warn('⚠️  TUYA: One or more required env vars missing. Tuya Cloud poller will NOT start.');
    console.warn('   Required: TUYA_CLIENT_ID, TUYA_CLIENT_SECRET, TUYA_DEVICE_ID, TUYA_REGION_URL');
    return;
  }

  // Which tenant owns this Tuya device — defaults to 'fern' if not explicitly set
  const tenantId = TUYA_TENANT_ID || 'fern';
  console.log(`🏠 Tuya poller will write AQI data to tenant: '${tenantId}'`);

  // Initialise the Tuya SDK context — handles access token fetch + refresh automatically
  const tuya = new TuyaContext({
    baseUrl:   TUYA_REGION_URL,
    accessKey: TUYA_CLIENT_ID,
    secretKey: TUYA_CLIENT_SECRET,
  });

  console.log(`🌱 Tuya Cloud poller started — device: ${TUYA_DEVICE_ID} @ ${TUYA_REGION_URL}`);
  console.log('   Polling every 60 seconds for AQI data...');

  async function poll() {
    try {
      // Fetch live device status from Tuya Cloud
      const response = await tuya.request({
        method: 'GET',
        path:   '/v1.0/iot-03/devices/status',
        query:  { device_ids: TUYA_DEVICE_ID },
      });

      if (!response.success) {
        console.error('❌ Tuya API returned failure:', JSON.stringify(response));
        return;
      }

      const deviceResult = response.result && response.result[0];
      if (!deviceResult || !Array.isArray(deviceResult.status)) {
        console.error('❌ Tuya: Unexpected response shape:', JSON.stringify(response.result));
        return;
      }

      // Parse and scale sensor values
      const { pm25, pm10, pm1, co2, tvoc, hcho, temp, humidity, aqi } = parseTuyaStatus(deviceResult.status);
      const category = getCategory(aqi);
      const dominant = calculateCpcbSubIndex(pm25, 'pm25') >= calculateCpcbSubIndex(pm10, 'pm10') ? 'pm25' : 'pm10';

      // Write to aqi_history table — scoped to tenant so each site's AQI is isolated
      db.run(
        `INSERT INTO aqi_history (pm25, pm10, co2, tvoc, hcho, temp, humidity, aqi, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pm25, pm10, co2, tvoc, hcho, temp, humidity, aqi, tenantId],
        function (err) {
          if (err) {
            console.error('❌ Tuya: DB insert error:', err.message);
          } else {
            console.log(
              `🌬️ [Tuya|${tenantId}] AQI=${aqi} (${category}) | PM2.5=${pm25} PM10=${pm10} PM1=${pm1} ` +
              `CO2=${co2} TVOC=${tvoc.toFixed(3)} HCHO=${hcho.toFixed(3)} ` +
              `Temp=${temp}°C Humidity=${humidity}%`
            );
          }
        }
      );

      // Broadcast to dashboard clients — tagged with tenant_id so each subdomain
      // only receives its own site's AQI readings via the WebSocket filter.
      broadcast({
        type: 'aqi',
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
        data: {
          pm25,
          pm10,
          co2,
          tvoc,
          hcho,
          temp,
          humidity,
          aqi,
          category,
          dominant_pollutant: dominant,
        },
      });

    } catch (err) {
      console.error('❌ Tuya: Poll error:', err.message || err);
    }
  }

  // Run immediately on startup, then repeat every 60 seconds
  poll();
  setInterval(poll, 60 * 1000);
}

module.exports = { startTuyaPoller };
