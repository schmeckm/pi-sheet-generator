/**
 * Runnable: node seeders/seed-settings.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize, initializeDatabase } = require('../config/database');
const { SystemSetting } = require('../models');

const DEFAULTS = [
  {
    key: 'sap_integration_enabled',
    value: 'false',
    description: 'Enable optional SAP MCP integration',
  },
  {
    key: 'sap_mcp_url',
    value: 'http://localhost:7001/sse',
    description: 'SAP MCP server URL (SSE)',
  },
  {
    key: 'sap_connection_type',
    value: 'mock',
    description: 'mock | rfc | odata | me_api',
  },
  {
    key: 'sap_auto_sync',
    value: 'false',
    description: 'Automatic XStep sync from SAP',
  },
  {
    key: 'sap_sync_interval_minutes',
    value: '60',
    description: 'Auto-sync interval in minutes',
  },
  {
    key: 'sap_last_sync_at',
    value: '',
    description: 'ISO timestamp of last successful sync',
  },
  {
    key: 'sap_last_sync_report',
    value: '',
    description: 'JSON report of last sync',
  },
  {
    key: 'production_plants',
    value: JSON.stringify([
      { code: 'CH01', name: 'Basel' },
      { code: 'CH02', name: 'Stein' },
    ]),
    description: 'JSON array of plants (Werke): { code, name }',
  },
  {
    key: 'default_plant',
    value: 'CH01',
    description: 'Default plant code for new PI Sheets',
  },
];

async function seedSettings() {
  for (const row of DEFAULTS) {
    const [, created] = await SystemSetting.findOrCreate({
      where: { key: row.key },
      defaults: row,
    });
    if (!created) {
      await SystemSetting.update(
        { description: row.description },
        { where: { key: row.key } }
      );
    }
  }
  console.log(`System settings seeded: ${DEFAULTS.length} keys`);
}

async function main() {
  await initializeDatabase();
  await seedSettings();
  await sequelize.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedSettings, DEFAULTS };
