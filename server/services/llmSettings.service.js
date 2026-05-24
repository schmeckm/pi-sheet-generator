const { getAnthropicClient } = require('../config/anthropic');
const { getOpenAIApiKey } = require('../config/openai');
const { LlmUsageDaily } = require('../models');
const settingsService = require('./settings.service');
const tokenBudget = require('./tokenBudget.service');
const llmProvider = require('./llmProvider.service');
const {
  getModelConfig,
  getFullModelConfig,
  ALLOWED_ANTHROPIC_MODELS,
  ALLOWED_OPENAI_MODELS,
  DEFAULTS,
  OPENAI_DEFAULTS,
} = require('../utils/llmModel');

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function maskApiKey(raw) {
  const key = String(raw || '').trim();
  if (!key || key.includes('your-key-here')) return null;
  if (key.length <= 12) return '••••';
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

async function listSelectableAnthropicModels() {
  const client = getAnthropicClient();
  if (!client?.models?.list) {
    return { source: 'static', models: [...ALLOWED_ANTHROPIC_MODELS] };
  }
  try {
    const page = await client.models.list({ limit: 100 });
    const fromApi = (page?.data || [])
      .map((m) => m.id)
      .filter((id) => typeof id === 'string' && id.startsWith('claude'));
    const merged = [...new Set([...ALLOWED_ANTHROPIC_MODELS, ...fromApi])].sort();
    return { source: 'api', models: merged.length ? merged : [...ALLOWED_ANTHROPIC_MODELS] };
  } catch {
    return { source: 'static', models: [...ALLOWED_ANTHROPIC_MODELS] };
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

async function fetchOpenAiBilling() {
  const key = getOpenAIApiKey();
  if (!key) return { available: false, reason: 'key_missing' };

  try {
    const res = await fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return {
        available: false,
        reason: res.status === 401 ? 'billing_api_unauthorized' : 'billing_api_error',
        status: res.status,
        note: 'Prepaid credit balance is not available for this key type. Check platform.openai.com/usage.',
      };
    }
    const json = await res.json();
    const grants = json.data || [];
    let grant_usd = 0;
    let used_usd = 0;
    for (const g of grants) {
      grant_usd += Number(g.grant_amount) || 0;
      used_usd += Number(g.used_amount) || 0;
    }
    return {
      available: true,
      has_prepaid_credits: grants.length > 0,
      grant_usd,
      used_usd,
      remaining_usd: Math.max(0, grant_usd - used_usd),
      grants_count: grants.length,
    };
  } catch (err) {
    return { available: false, reason: 'fetch_failed', message: err.message };
  }
}

async function getOverview(userId, role) {
  const [piSheet, qa, vision, anthropicModels, openaiModels, orgUsage, userBudget, dailyBudget, adminUnlimited] =
    await Promise.all([
      getFullModelConfig('pi_sheet'),
      getFullModelConfig('qa'),
      getFullModelConfig('vision'),
      listSelectableAnthropicModels(),
      llmProvider.listOpenAiModels(),
      getOrgUsageToday(),
      tokenBudget.getStatus(userId, role),
      tokenBudget.getDailyBudget(),
      settingsService.get('llm_token_budget_admin_unlimited'),
    ]);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = getOpenAIApiKey();

  let anthropicReachable = false;
  const anthropicClient = getAnthropicClient();
  if (anthropicClient) {
    try {
      await anthropicClient.models.list({ limit: 1 });
      anthropicReachable = true;
    } catch {
      anthropicReachable = false;
    }
  }

  const openaiReachable = await llmProvider.checkOpenAiReachable();
  const [anthropicUsage, openaiBilling] = await Promise.all([
    fetchAnthropicUsageWindow(7),
    fetchOpenAiBilling(),
  ]);

  return {
    providers: {
      anthropic: {
        configured: Boolean(maskApiKey(anthropicKey)),
        reachable: anthropicReachable,
        key_hint: maskApiKey(anthropicKey),
      },
      openai: {
        configured: Boolean(maskApiKey(openaiKey)),
        reachable: openaiReachable,
        key_hint: maskApiKey(openaiKey),
      },
    },
    /** @deprecated use providers.anthropic */
    api: {
      configured: Boolean(maskApiKey(anthropicKey)),
      reachable: anthropicReachable,
      key_hint: maskApiKey(anthropicKey),
    },
    models: {
      pi_sheet: piSheet,
      qa,
      vision,
      defaults: DEFAULTS,
      openai_defaults: OPENAI_DEFAULTS,
      anthropic: anthropicModels.models,
      openai: openaiModels.models,
      anthropic_source: anthropicModels.source,
      openai_source: openaiModels.source,
      /** @deprecated */
      selectable: anthropicModels.models,
      selectable_source: anthropicModels.source,
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
    openai_account: openaiBilling,
  };
}

module.exports = {
  getOverview,
  listSelectableModels: listSelectableAnthropicModels,
  getOrgUsageToday,
};
