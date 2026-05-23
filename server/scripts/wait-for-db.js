/**
 * Blocks until DATABASE_URL is reachable (Docker entrypoint).
 * Tries service name "db" first, then fallbacks (pisheet-db, host port) when DNS fails.
 */
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env');
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const { Client } = require('pg');

const maxAttempts = Number.parseInt(process.env.DB_WAIT_ATTEMPTS || '45', 10);
const delayMs = Number.parseInt(process.env.DB_WAIT_DELAY_MS || '2000', 10);
const inDocker = fs.existsSync('/.dockerenv');

function parsePgUrl(connectionString) {
  const u = new URL(connectionString.replace(/^postgres:/, 'http:'));
  return {
    hostname: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, '') || 'pisheet',
  };
}

function buildPgUrl(parts) {
  const auth = parts.password
    ? `${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}`
    : encodeURIComponent(parts.user);
  return `postgres://${auth}@${parts.hostname}:${parts.port}/${parts.database}`;
}

function candidateUrls(primary) {
  if (!primary) return [];
  const parsed = parsePgUrl(primary);
  const urls = [primary];

  const extraHosts = (process.env.DB_CONNECT_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (parsed.hostname === 'db') {
    if (!extraHosts.includes('pisheet-db')) extraHosts.unshift('pisheet-db');
    if (inDocker && !extraHosts.includes('host.docker.internal')) {
      extraHosts.push('host.docker.internal');
    }
  }

  for (const host of extraHosts) {
    if (host === parsed.hostname) continue;
    const port =
      host === 'host.docker.internal'
        ? String(process.env.DB_FALLBACK_PORT || '7003')
        : parsed.port;
    urls.push(buildPgUrl({ ...parsed, hostname: host, port }));
  }

  if (process.env.DB_FALLBACK_URL) urls.push(process.env.DB_FALLBACK_URL);

  return [...new Set(urls)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryConnect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
}

async function main() {
  let primary = process.env.DATABASE_URL;
  if (!primary) {
    console.error('[wait-for-db] DATABASE_URL is not set');
    process.exit(1);
  }

  if (process.env.DB_HOST) {
    try {
      const parsed = parsePgUrl(primary);
      parsed.hostname = process.env.DB_HOST;
      primary = buildPgUrl(parsed);
    } catch {
      /* keep original */
    }
  }

  const candidates = candidateUrls(primary);
  const hosts = candidates.map((u) => parsePgUrl(u).hostname).join(', ');
  console.log(`[wait-for-db] Waiting for PostgreSQL (hosts: ${hosts})…`);

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const candidate of candidates) {
      const host = parsePgUrl(candidate).hostname;
      try {
        await tryConnect(candidate);
        process.env.DATABASE_URL = candidate;
        if (candidate !== primary) {
          console.log(`[wait-for-db] Connected via fallback host "${host}".`);
        } else {
          console.log('[wait-for-db] Database is reachable.');
        }
        process.exit(0);
      } catch (err) {
        lastError = err;
        const code = err.code || err.message;
        if (attempt === 1 || attempt % 5 === 0) {
          console.log(`[wait-for-db] attempt ${attempt}/${maxAttempts} @${host}: ${code}`);
        }
      }
    }
    if (attempt < maxAttempts) await sleep(delayMs);
  }

  console.error('[wait-for-db] Database not reachable after all hosts failed.');
  console.error(
    '[wait-for-db] Fix: deploy the FULL stack in one compose/portainer stack (services db + api + client).'
  );
  console.error(
    '[wait-for-db] Do NOT start only the API container. Host "db" resolves only on the stack network "pisheet".'
  );
  if (lastError) {
    console.error(`[wait-for-db] Last error: ${lastError.code || lastError.message}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('[wait-for-db] Fatal:', err.message);
  process.exit(1);
});
