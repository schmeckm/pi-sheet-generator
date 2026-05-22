require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const http = require('http');

const body = JSON.stringify({ email: 'admin@pisheet.local', password: 'admin123' });
const req = http.request(
  {
    hostname: '127.0.0.1',
    port: process.env.PORT || 7000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Body:', data);
      const parsed = JSON.parse(data);
      if (res.statusCode === 200 && parsed.token) {
        console.log('OK: token received');
        process.exit(0);
      }
      process.exit(1);
    });
  }
);
req.on('error', (e) => {
  console.error('Request failed:', e.message);
  process.exit(1);
});
req.write(body);
req.end();
