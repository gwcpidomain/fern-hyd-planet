'use strict';

/**
 * test-tuya.js
 * ────────────
 * One-shot test script to verify your Tuya credentials and sensor data parsing.
 * Run from the backend folder:
 *
 *   node test-tuya.js
 *
 * Expected output on success:
 *   ✅ Tuya connection OK
 *   📊 Raw status: [ { code: 'pm25_value', value: 26 }, ... ]
 *   📋 Parsed: { pm25: 26, pm10: 30, co2: 412, tvoc: 0.007, hcho: 0.004, temp: 29.2, humidity: 59, aqi: ... }
 */

// Load .env if present locally
try { require('dotenv').config(); } catch (_) {}

const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

const CLIENT_ID     = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
const DEVICE_ID     = process.env.TUYA_DEVICE_ID;
const REGION_URL    = process.env.TUYA_REGION_URL;

// SECURITY FIX (C-01): Credentials must come from env vars — never hardcoded.
const missing = ['TUYA_CLIENT_ID', 'TUYA_CLIENT_SECRET', 'TUYA_DEVICE_ID', 'TUYA_REGION_URL']
  .filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  console.error('   Set them in your shell or a .env file before running this test.');
  process.exit(1);
}

// Same scaling logic as tuyaService.js
function parseTuyaStatus(statusArray) {
  const map = {};
  for (const { code, value } of statusArray) map[code] = value;

  return {
    pm25:     map['pm25_value']     ?? 0,
    pm10:     map['pm10']           ?? 0,
    pm1:      map['pm1']            ?? 0,
    co2:      map['co2_value']      ?? 400,
    tvoc:     (map['voc_value']     ?? 0) / 1000,
    hcho:     (map['ch2o_value']    ?? 0) / 1000,
    temp:     (map['temp_current']  ?? 0) / 10,
    humidity: map['humidity_value'] ?? 0,
    aqi_level: map['air_quality_index'] ?? 'unknown',
    battery:  map['battery_percentage'] ?? 'unknown',
  };
}

async function main() {
  console.log('🔌 Connecting to Tuya Cloud...');
  console.log(`   Region : ${REGION_URL}`);
  console.log(`   Device : ${DEVICE_ID}`);

  const tuya = new TuyaContext({
    baseUrl:   REGION_URL,
    accessKey: CLIENT_ID,
    secretKey: CLIENT_SECRET,
  });

  const response = await tuya.request({
    method: 'GET',
    path:   '/v1.0/iot-03/devices/status',
    query:  { device_ids: DEVICE_ID },
  });

  if (!response.success) {
    console.error('❌ Tuya API error:', JSON.stringify(response, null, 2));
    process.exit(1);
  }

  const deviceResult = response.result && response.result[0];
  if (!deviceResult || !Array.isArray(deviceResult.status)) {
    console.error('❌ Unexpected response shape:', JSON.stringify(response.result, null, 2));
    process.exit(1);
  }

  console.log('\n✅ Tuya connection OK');
  console.log('\n📊 Raw status:');
  console.log(JSON.stringify(deviceResult.status, null, 2));

  const parsed = parseTuyaStatus(deviceResult.status);
  console.log('\n📋 Parsed & Scaled:');
  console.log(parsed);

  console.log('\n✅ Test complete — credentials and parsing are working correctly.');
}

main().catch(err => {
  console.error('❌ Test failed:', err.message || err);
  process.exit(1);
});
