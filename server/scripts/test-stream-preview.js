/**
 * Smoke test: POST /api/chat/generate-stream must end with type=complete + piSheet.
 * Run: node scripts/test-stream-preview.js  (server on PORT, default 7000)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 7000;

async function main() {
  const loginRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@pisheet.local', password: 'admin123' }),
  });
  if (!loginRes.ok) {
    console.error('Login failed', loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const { token } = await loginRes.json();

  const prompt = 'Erstelle ein PI Sheet für Verpackung mit Rückmeldungen und Warenbewegungen';
  const res = await fetch(`http://127.0.0.1:${PORT}/api/chat/generate-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, locale: 'de' }),
  });

  console.log('HTTP', res.status);
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }

  const text = await res.text();
  let complete = null;
  let errorMsg = null;

  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') break;
    try {
      const data = JSON.parse(payload);
      if (data.type === 'complete') complete = data.piSheet;
      if (data.type === 'error') errorMsg = data.message;
    } catch {
      /* skip */
    }
  }

  if (errorMsg) {
    console.error('Stream error event:', errorMsg);
    process.exit(1);
  }
  if (!complete?.title) {
    console.error('No complete piSheet in stream');
    process.exit(1);
  }

  console.log('OK:', complete.title, '| steps:', complete.steps?.length ?? 0);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
