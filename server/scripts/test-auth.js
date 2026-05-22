/**
 * Step 2 auth smoke tests. Run with server on PORT (default 7000).
 *   node scripts/test-auth.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 7000;
const BASE = `http://127.0.0.1:${PORT}/api/auth`;

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(name, ok, detail) {
    if (ok) {
      console.log(`✓ ${name}`);
      passed += 1;
    } else {
      console.error(`✗ ${name}`, detail ?? '');
      failed += 1;
    }
  }

  const login = await request('POST', '/login', {
    email: 'admin@pisheet.local',
    password: 'admin123',
  });
  assert('POST /login returns 200', login.status === 200, login);
  assert('POST /login returns token', Boolean(login.data?.token), login.data);
  assert('POST /login returns user with role admin', login.data?.user?.role === 'admin', login.data?.user);

  const token = login.data?.token;

  const me = await request('GET', '/me', null, token);
  assert('GET /me with token returns 200', me.status === 200, me);
  assert('GET /me returns user email', me.data?.user?.email === 'admin@pisheet.local', me.data);

  const meNoAuth = await request('GET', '/me');
  assert('GET /me without token returns 401', meNoAuth.status === 401, meNoAuth);

  const registerNoAuth = await request('POST', '/register', {
    email: 'new@pisheet.local',
    password: 'test123',
    name: 'New User',
  });
  assert('POST /register without token returns 401', registerNoAuth.status === 401, registerNoAuth);

  const registerAdmin = await request(
    'POST',
    '/register',
    {
      email: `test-${Date.now()}@pisheet.local`,
      password: 'test123',
      name: 'Test User',
      role: 'operator',
    },
    token
  );
  assert('POST /register with admin token returns 201', registerAdmin.status === 201, registerAdmin);
  assert('POST /register returns token and user', Boolean(registerAdmin.data?.token), registerAdmin.data);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test run failed:', err.message);
  console.error('Start the server first: npm run dev --prefix server');
  process.exit(1);
});
