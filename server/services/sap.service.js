const settingsService = require('./settings.service');
const repositoryService = require('./repository.service');
const { XStep } = require('../models');

const MOCK_XSTEPS = [
  {
    xstep_id: 'XS-SAP-001',
    name: 'SAP Materialentnahme',
    category: 'Warenbewegung',
    process_type: 'Verpackung',
    description: 'Aus SAP-Stückliste (Mock).',
    instruction_template: 'Material gemäß SAP-Auftrag entnehmen und buchen.',
    params: [
      { name: 'Auftrag', type: 'display' },
      { name: 'Material', type: 'input', required: true },
      { name: 'Menge', type: 'input', unit: 'kg', required: true },
    ],
    sap_transaction: 'MIGO',
    movement_type: '261',
    gmp_relevant: false,
    signature_required: false,
    sort_order: 99,
    is_active: true,
  },
];

async function requireEnabled() {
  const enabled = await settingsService.isFeatureEnabled('sap_integration_enabled');
  if (!enabled) {
    const err = new Error('SAP integration is disabled');
    err.statusCode = 400;
    throw err;
  }
}

async function testConnection() {
  await requireEnabled();
  const settings = await settingsService.getSapSettings();
  const url = settings.mcp_url || process.env.SAP_MCP_URL;
  const start = Date.now();

  if (!url) {
    return { success: false, message: 'SAP MCP URL not configured', latency_ms: 0 };
  }

  try {
    const healthUrl = url.replace(/\/sse\/?$/, '/health').replace(/\/mcp\/?$/, '/health');
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    const latency_ms = Date.now() - start;
    if (res.ok) {
      return {
        success: true,
        message: `SAP MCP erreichbar (${settings.connection_type})`,
        latency_ms,
        url: healthUrl,
      };
    }
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latency_ms,
    };
  } catch (err) {
    if (settings.connection_type === 'mock') {
      return {
        success: true,
        message: 'Mock-Modus: SAP-Verbindung simuliert (MCP nicht erreichbar, Offline-Fallback aktiv)',
        latency_ms: Date.now() - start,
        mock: true,
      };
    }
    return {
      success: false,
      message: err.message,
      latency_ms: Date.now() - start,
    };
  }
}

async function syncXSteps(userId) {
  await requireEnabled();
  const report = { fetched: MOCK_XSTEPS.length, created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of MOCK_XSTEPS) {
    try {
      const existing = await XStep.findOne({ where: { xstep_id: row.xstep_id } });
      if (!existing) {
        await repositoryService.create(row, userId);
        report.created += 1;
      } else {
        await repositoryService.update(existing.id, row, userId);
        report.updated += 1;
      }
    } catch (err) {
      report.errors.push({ xstep_id: row.xstep_id, message: err.message });
    }
  }

  await settingsService.set('sap_last_sync_at', new Date().toISOString(), userId);
  await settingsService.set('sap_last_sync_report', JSON.stringify(report), userId);

  return report;
}

async function getStatus() {
  const settings = await settingsService.getSapSettings();
  let connected = false;
  if (settings.enabled && settings.mcp_url) {
    try {
      const test = await testConnection();
      connected = test.success;
    } catch {
      connected = false;
    }
  }
  return {
    enabled: settings.enabled,
    connected,
    connection_type: settings.connection_type,
    mcp_url: settings.mcp_url,
    auto_sync: settings.auto_sync,
    sync_interval_minutes: settings.sync_interval_minutes,
    last_sync_at: settings.last_sync_at,
    last_sync_report: settings.last_sync_report,
  };
}

const MOCK_ORDER = {
  order_number: '1000234',
  material: 'FG-88421-100',
  description: 'Paracetamol 500mg Tabletten — Charge CH-2026-042',
  plant: 'CH01',
  status: 'REL',
  operations: [
    { operation: '0010', work_center: 'VP-03', description: 'Granulation', duration_min: 120 },
    { operation: '0020', work_center: 'VP-03', description: 'Tablettierung', duration_min: 180 },
    { operation: '0030', work_center: 'VP-05', description: 'Verpackung', duration_min: 90 },
  ],
  bom_components: [
    { material: 'RM-LACT-001', description: 'Lactose monohydrat', quantity: 25, unit: 'kg' },
    { material: 'RM-PARA-500', description: 'Paracetamol API', quantity: 12.5, unit: 'kg' },
  ],
};

async function getProcessOrder(orderNumber) {
  await requireEnabled();
  const settings = await settingsService.getSapSettings();
  const num = String(orderNumber || '').trim();
  if (!num) {
    const err = new Error('Order number required');
    err.statusCode = 400;
    throw err;
  }

  if (settings.connection_type === 'mock' || !settings.mcp_url) {
    return { ...MOCK_ORDER, order_number: num };
  }

  try {
    const base = settings.mcp_url.replace(/\/sse\/?$/, '').replace(/\/mcp\/?$/, '');
    const res = await fetch(`${base}/mock/orders/${encodeURIComponent(num)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return res.json();
  } catch {
    /* fall through to mock */
  }
  return { ...MOCK_ORDER, order_number: num, source: 'mock_fallback' };
}

module.exports = {
  testConnection,
  syncXSteps,
  getStatus,
  getProcessOrder,
};
