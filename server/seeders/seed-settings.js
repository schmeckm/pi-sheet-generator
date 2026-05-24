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
  {
    key: 'llm_provider_pi_sheet',
    value: 'anthropic',
    description: 'LLM provider for PI Sheet generation: anthropic | openai',
  },
  {
    key: 'llm_provider_qa',
    value: 'anthropic',
    description: 'LLM provider for QA / equipment chat: anthropic | openai',
  },
  {
    key: 'llm_provider_vision',
    value: 'anthropic',
    description: 'LLM provider for vision / digitization: anthropic | openai (vision: Anthropic only today)',
  },
  {
    key: 'llm_model_pi_sheet',
    value: 'claude-sonnet-4-6',
    description: 'Model id for PI Sheet generation (provider-specific)',
  },
  {
    key: 'llm_model_qa',
    value: 'claude-haiku-4-5-20251001',
    description: 'Model id for QA / equipment chat (provider-specific)',
  },
  {
    key: 'llm_model_vision',
    value: 'claude-sonnet-4-6',
    description: 'Model id for vision / document digitization (provider-specific)',
  },
  {
    key: 'llm_max_tokens_pi_sheet',
    value: '8000',
    description: 'Max output tokens for PI Sheet generation',
  },
  {
    key: 'llm_max_tokens_qa',
    value: '1500',
    description: 'Max output tokens for QA / equipment chat',
  },
  {
    key: 'llm_max_tokens_vision',
    value: '8000',
    description: 'Max output tokens for vision / document digitization',
  },
  {
    key: 'llm_token_budget_daily_per_user',
    value: '250000',
    description: 'Max LLM tokens per user per UTC day (0 = unlimited)',
  },
  {
    key: 'llm_token_budget_admin_unlimited',
    value: 'true',
    description: 'Admins bypass daily token budget when true',
  },
];

async function seedSettings() {
  for (const row of DEFAULTS) {
    const [, created] = await SystemSetting.findOrCreate({
      where: { key: row.key },
      defaults: row,
    });
    if (!created) {
      const updates = { description: row.description };
      if (row.key === 'llm_max_tokens_pi_sheet') {
        const current = await SystemSetting.findOne({ where: { key: row.key } });
        if (current?.value === '2500') updates.value = row.value;
      }
      if (row.key === 'llm_model_pi_sheet' || row.key === 'llm_model_vision') {
        const current = await SystemSetting.findOne({ where: { key: row.key } });
        if (current?.value === 'claude-sonnet-4-20250514') updates.value = row.value;
      }
      if (row.key === 'llm_model_qa') {
        const current = await SystemSetting.findOne({ where: { key: row.key } });
        if (current?.value === 'claude-haiku-4-20250514') updates.value = row.value;
      }
      await SystemSetting.update(updates, { where: { key: row.key } });
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
