const { getAnthropicClient } = require('../config/anthropic');
const { LlmUsageDaily } = require('../models');
const settingsService = require('./settings.service');
const tokenBudget = require('./tokenBudget.service');
const {
  getModelConfig,
  ALLOWED_MODELS,
  DEFAULTS,
} = require('../utils/llmModel');

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function maskApiKey() {
  const key = process.env.ANTHROPIC_API_KEY || '';
  if (!key || key.includes('your-key-here')) return null;
  if (key.length <= 12) return '••••';
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

async function listSelectableModels() {
  const client = getAnthropicClient();
  if (!client?.models?.list) {
    return { source: 'static', models: [...ALLOWED_MODELS] };
  }
  try {
    const page = await client.models.list({ limit: 100 });
    const fromApi = (page?.data || [])
      .map((m) => m.id)
      .filter((id) => typeof id === 'string' && id.startsWith('claude'));
    const merged = [...new Set([...ALLOWED_MODELS, ...fromApi])].sort();
    return { source: 'api', models: merged.length ? merged : [...ALLOWED_MODELS] };
  } catch {
    return { source: 'static', models: [...ALLOWED_MODELS] };
  }
}

async function getOrgUsageToday() {
  const usage_date = utcDateKey();
  const rows = await LlmUsageDaily.findAll({
    where: { usage_date },
    attributes: ['total_tokens', 'request_count', 'user_id'],
  });
  return {
    date: usage_date,
    total_tokens: rows.reduce((s, r) => s + (r.total_tokens || 0), 0),
    request_count: rows.reduce((s, r) => s + (r.request_count || 0), 0),
    active_users: rows.length,
  };
}

/**
 * Anthropic does not expose remaining prepaid balance on the standard Messages API key.
 * Optional Admin API: last 7 days token usage (not dollar balance).
 */
async function fetchAnthropicUsageWindow(days = 7) {
  const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!adminKey) return { available: false, reason: 'admin_key_missing' };

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    starting_at: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ending_at: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    bucket_width: '1d',
    limit: String(Math.min(days, 31)),
  });

  try {
    const res = await fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?${params}`,
      {
        headers: {
          'x-api-key': adminKey,
          'anthropic-version': '2023-06-01',
        },
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { available: false, reason: 'admin_api_error', status: res.status, detail: body.slice(0, 200) };
    }
    const json = await res.json();
    let input_tokens = 0;
    let output_tokens = 0;
    for (const bucket of json.data || []) {
      for (const row of bucket.results || []) {
        input_tokens += Number(row.input_tokens) || 0;
        output_tokens += Number(row.output_tokens) || 0;
      }
    }
    return {
      available: true,
      days,
      input_tokens,
      output_tokens,
      total_tokens: input_tokens + output_tokens,
    };
  } catch (err) {
    return { available: false, reason: 'admin_api_fetch_failed', message: err.message };
  }
}

async function getOverview(userId, role) {
  const [piSheet, qa, vision, modelList, orgUsage, userBudget, dailyBudget, adminUnlimited] =
    await Promise.all([
      getModelConfig('pi_sheet'),
      getModelConfig('qa'),
      getModelConfig('vision'),
      listSelectableModels(),
      getOrgUsageToday(),
      tokenBudget.getStatus(userId, role),
      tokenBudget.getDailyBudget(),
      settingsService.get('llm_token_budget_admin_unlimited'),
    ]);

  const apiKeyConfigured = Boolean(maskApiKey());
  let apiReachable = false;
  const client = getAnthropicClient();
  if (client) {
    try {
      await client.models.list({ limit: 1 });
      apiReachable = true;
    } catch {
      apiReachable = false;
    }
  }

  const anthropicUsage = await fetchAnthropicUsageWindow(7);

  return {
    api: {
      configured: apiKeyConfigured,
      reachable: apiReachable,
      key_hint: maskApiKey(),
    },
    models: {
      pi_sheet: piSheet,
      qa,
      vision,
      defaults: DEFAULTS,
      selectable: modelList.models,
      selectable_source: modelList.source,
    },
    budget: {
      daily_per_user: dailyBudget || null,
      admin_unlimited: adminUnlimited !== 'false' && adminUnlimited !== '0',
      user: userBudget,
      organization_today: orgUsage,
    },
    anthropic_account: {
      balance_available: false,
      balance_note:
        'Remaining Anthropic prepaid credits are not exposed via the standard API key. Check console.anthropic.com → Billing, or set ANTHROPIC_ADMIN_API_KEY for org usage stats.',
      usage_last_7d: anthropicUsage,
    },
  };
}

module.exports = {
  getOverview,
  listSelectableModels,
  getOrgUsageToday,
};
