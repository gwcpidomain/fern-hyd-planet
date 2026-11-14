'use strict';

/**
 * tuyaService.js
 * ──────────────
 * Background poller for the amiciSense 13-in-1 WiFi Air Quality Monitor
 * connected via Tuya Cloud OpenAPI.
 *
 * Supports two tenants (fern + urbanrise) via isolated pollers.
 * Fern  : reads TUYA_FERN_*     vars (falls back to legacy TUYA_* vars)
 * Urbanrise: reads TUYA_URBANRISE_* vars only
 *
 * The service is started from server.js only when env vars are present.
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

// ── Main exported function: startTuyaPoller (multi-tenant) ───────────────────
// Called once from server.js after the DB and WebSocket server are ready.
// Reads TUYA_FERN_* and TUYA_URBANRISE_* env var sets and starts an isolated
// 60-second poller for each configured site. Legacy TUYA_* vars are supported
// as a fallback for the fern site to avoid breaking the existing Render config.
function startTuyaPoller(db, broadcast) {
  const sites = [];

  // ── Fern: prefer new TUYA_FERN_* vars, fall back to legacy TUYA_* vars ──────
  const fernClientId  = process.env.TUYA_FERN_CLIENT_ID     || process.env.TUYA_CLIENT_ID;
  const fernSecret    = process.env.TUYA_FERN_CLIENT_SECRET  || process.env.TUYA_CLIENT_SECRET;
  const fernDeviceId  = process.env.TUYA_FERN_DEVICE_ID      || process.env.TUYA_DEVICE_ID;
  const fernRegion    = process.env.TUYA_FERN_REGION_URL      || process.env.TUYA_REGION_URL || 'https://openapi.tuyain.com';
  if (fernClientId && fernSecret && fernDeviceId) {
    sites.push({
      tenantId: process.env.TUYA_TENANT_ID || 'fern',
      clientId: fernClientId,
      secret:   fernSecret,
      deviceId: fernDeviceId,
      region:   fernRegion,
    });
  }

  // ── Urbanrise: only new-style TUYA_URBANRISE_* vars ─────────────────────────
  const urbClientId   = process.env.TUYA_URBANRISE_CLIENT_ID;
  const urbSecret     = process.env.TUYA_URBANRISE_CLIENT_SECRET;
  const urbDeviceId   = process.env.TUYA_URBANRISE_DEVICE_ID;
  const urbRegion     = process.env.TUYA_URBANRISE_REGION_URL || 'https://openapi.tuyain.com';
  if (urbClientId && urbSecret && urbDeviceId) {
    sites.push({
      tenantId: 'urbanrise',
      clientId: urbClientId,
      secret:   urbSecret,
      deviceId: urbDeviceId,
      region:   urbRegion,
    });
  }

  if (sites.length === 0) {
    console.warn('⚠️  TUYA: No sites configured. Tuya poller will NOT start.');
    return;
  }

  // ── Start one isolated poller per site ───────────────────────────────────────
  for (const site of sites) {
    const tuya = new TuyaContext({
      baseUrl:   site.region,
      accessKey: site.clientId,
      secretKey: site.secret,
    });
    console.log(`🌱 Tuya poller started for tenant '${site.tenantId}' — device: ${site.deviceId} @ ${site.region}`);
    console.log('   Polling every 60 seconds for AQI data...');

    // IIFE to capture site + tuya per iteration (avoids loop closure bug)
    (function (s, ctx) {
      async function poll() {
        try {
          const response = await ctx.request({
            method: 'GET',
            path:   '/v1.0/iot-03/devices/status',
            query:  { device_ids: s.deviceId },
          });

          if (!response.success) {
            console.error(`❌ Tuya[${s.tenantId}]: API failure:`, JSON.stringify(response));
            return;
          }

          const deviceResult = response.result && response.result[0];
          if (!deviceResult || !Array.isArray(deviceResult.status)) {
            console.error(`❌ Tuya[${s.tenantId}]: Unexpected response shape:`, JSON.stringify(response.result));
            return;
          }

          const { pm25, pm10, pm1, co2, tvoc, hcho, temp, humidity, aqi } = parseTuyaStatus(deviceResult.status);
          const category = getCategory(aqi);
          const dominant = calculateCpcbSubIndex(pm25, 'pm25') >= calculateCpcbSubIndex(pm10, 'pm10') ? 'pm25' : 'pm10';

          db.run(
            `INSERT INTO aqi_history (pm25, pm10, co2, tvoc, hcho, temp, humidity, aqi, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pm25, pm10, co2, tvoc, hcho, temp, humidity, aqi, s.tenantId],
            (err) => {
              if (err) {
                console.error(`❌ Tuya[${s.tenantId}] DB error:`, err.message);
              } else {
                console.log(
                  `🌬️ [Tuya|${s.tenantId}] AQI=${aqi} (${category}) PM2.5=${pm25} PM10=${pm10} PM1=${pm1} ` +
                  `CO2=${co2} TVOC=${tvoc.toFixed(3)} HCHO=${hcho.toFixed(3)} ` +
                  `Temp=${temp}°C Humidity=${humidity}%`
                );
              }
            }
          );

          broadcast({
            type:      'aqi',
            tenant_id: s.tenantId,
            timestamp: new Date().toISOString(),
            data: { pm25, pm10, co2, tvoc, hcho, temp, humidity, aqi, category, dominant_pollutant: dominant },
          });

        } catch (err) {
          console.error(`❌ Tuya[${s.tenantId}] Poll error:`, err.message || err);
        }
      }

      poll();
      setInterval(poll, 60 * 1000);
    })(site, tuya);
  }
}

module.exports = { startTuyaPoller };
