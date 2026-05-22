const { SystemSetting } = require('../models');
const { logAudit } = require('./audit.service');

const BOOL_KEYS = new Set(['sap_integration_enabled', 'sap_auto_sync']);

async function get(key) {
  const row = await SystemSetting.findOne({ where: { key } });
  return row?.value ?? null;
}

async function set(key, value, userId = null) {
  const [row] = await SystemSetting.findOrCreate({
    where: { key },
    defaults: { key, value: String(value), updated_by: userId },
  });
  await row.update({ value: String(value), updated_by: userId });
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
  const rows = await SystemSetting.findAll({ order: [['key', 'ASC']] });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
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

module.exports = {
  get,
  set,
  getAll,
  isFeatureEnabled,
  getSapSettings,
};
