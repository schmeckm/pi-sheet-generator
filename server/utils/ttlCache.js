/**
 * Tiny in-memory TTL cache. Single-process; safe for our Node app.
 * Use only for hot lookups (settings, active prompt config).
 */

function createTtlCache(defaultTtlMs = 30_000) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    store.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  }

  async function wrap(key, loader, ttlMs = defaultTtlMs) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    if (value !== undefined && value !== null) set(key, value, ttlMs);
    return value;
  }

  function invalidate(key) {
    if (key === undefined) store.clear();
    else store.delete(key);
  }

  return { get, set, wrap, invalidate };
}

module.exports = { createTtlCache };
