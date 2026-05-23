const { SystemSetting } = require('../models');
const { logAudit } = require('./audit.service');
const { createTtlCache } = require('../utils/ttlCache');

const BOOL_KEYS = new Set(['sap_integration_enabled', 'sap_auto_sync']);

const SETTING_TTL_MS = 30_000;
const cache = createTtlCache(SETTING_TTL_MS);

async function get(key) {
  return cache.wrap(`v:${key}`, async () => {
    const row = await SystemSetting.findOne({ where: { key } });
    return row?.value ?? null;
  });
}

async function set(key, value, userId = null) {
  const [row] = await SystemSetting.findOrCreate({
    where: { key },
    defaults: { key, value: String(value), updated_by: userId },
  });
  await row.update({ value: String(value), updated_by: userId });
  cache.invalidate(`v:${key}`);
  cache.invalidate('all');
  await logAudit({
    userId,
    action: 'setting_updated',
    entityType: 'system_setting',
    entityId: row.id,
    details: { key, value: String(value) },
  });
  return row;
}

async function getAll() {
  return cache.wrap('all', async () => {
    const rows = await SystemSetting.findAll({ order: [['key', 'ASC']] });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
}

async function isFeatureEnabled(key) {
  const v = await get(key);
  return v === 'true' || v === '1';
}

async function getSapSettings() {
  const all = await getAll();
  return {
    enabled: all.sap_integration_enabled === 'true',
    mcp_url: all.sap_mcp_url || process.env.SAP_MCP_URL || '',
    connection_type: all.sap_connection_type || 'mock',
    auto_sync: all.sap_auto_sync === 'true',
    sync_interval_minutes: Number(all.sap_sync_interval_minutes) || 60,
    last_sync_at: all.sap_last_sync_at || null,
    last_sync_report: all.sap_last_sync_report
      ? JSON.parse(all.sap_last_sync_report)
      : null,
  };
}

function invalidateCache() {
  cache.invalidate();
}

module.exports = {
  get,
  set,
  getAll,
  isFeatureEnabled,
  getSapSettings,
  invalidateCache,
  BOOL_KEYS,
};
