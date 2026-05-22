/**
 * Blocks until DATABASE_URL is reachable (used in Docker entrypoint).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Client } = require('pg');

const url = process.env.DATABASE_URL;
const maxAttempts = Number.parseInt(process.env.DB_WAIT_ATTEMPTS || '30', 10);
const delayMs = Number.parseInt(process.env.DB_WAIT_DELAY_MS || '2000', 10);

function dbHost() {
  if (!url) return '?';
  try {
    return new URL(url.replace(/^postgres:/, 'http:')).hostname;
  } catch {
    return '?';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryConnect() {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
}

async function main() {
  if (!url) {
    console.error('[wait-for-db] DATABASE_URL is not set');
    process.exit(1);
  }

  const host = dbHost();
  console.log(`[wait-for-db] Waiting for PostgreSQL at host "${host}"…`);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await tryConnect();
      console.log('[wait-for-db] Database is reachable.');
      process.exit(0);
    } catch (err) {
      const code = err.code || err.message;
      console.log(`[wait-for-db] attempt ${attempt}/${maxAttempts}: ${code}`);
      if (attempt === maxAttempts) {
        console.error(
          '[wait-for-db] Database not reachable. Deploy the full stack (services db + api + client) on the same network. Host "db" only resolves inside the compose stack.'
        );
        process.exit(1);
      }
      await sleep(delayMs);
    }
  }
}

main().catch((err) => {
  console.error('[wait-for-db] Fatal:', err.message);
  process.exit(1);
});
