/**
 * Quick vision API smoke test: node scripts/test-vision-api.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');

const BASE = `http://localhost:${process.env.PORT || 7000}/api`;
const PNG = path.resolve(__dirname, '../../test-assets/pi-test.png');

async function main() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'operator@pisheet.local',
      password: 'operator123',
    }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed', loginRes.status, loginBody);
    process.exit(1);
  }
  const token = loginBody.token;

  if (!fs.existsSync(PNG)) {
    console.error('Missing', PNG);
    process.exit(1);
  }

  const blob = new Blob([fs.readFileSync(PNG)], { type: 'image/png' });
  const form = new FormData();
  form.append('file', blob, 'pi-test.png');

  console.log('POST /vision/analyze …');
  const analyzeRes = await fetch(`${BASE}/vision/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const analyzeText = await analyzeRes.text();
  console.log('analyze', analyzeRes.status, analyzeText.slice(0, 500));
  if (!analyzeRes.ok) process.exit(1);

  const form2 = new FormData();
  form2.append('file', new Blob([fs.readFileSync(PNG)], { type: 'image/png' }), 'pi-test.png');
  console.log('POST /vision/generate …');
  const genRes = await fetch(`${BASE}/vision/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form2,
  });
  const genText = await genRes.text();
  console.log('generate', genRes.status, genText.slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
