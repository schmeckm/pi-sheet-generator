const { LlmUsageDaily } = require('../models');
const settingsService = require('./settings.service');
const { LlmError } = require('../utils/llmErrors');

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function getDailyBudget() {
  const v = await settingsService.get('llm_token_budget_daily_per_user');
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

async function isAdminUnlimited() {
  const v = await settingsService.get('llm_token_budget_admin_unlimited');
  return v !== 'false' && v !== '0';
}

async function getUsedToday(userId) {
  if (!userId) return 0;
  const row = await LlmUsageDaily.findOne({
    where: { user_id: userId, usage_date: utcDateKey() },
  });
  return row?.total_tokens || 0;
}

/**
 * Enforce per-user daily token budget (0 budget = unlimited).
 */
async function assertWithinBudget(userId, role) {
  if (!userId) return;
  if (role === 'admin' && (await isAdminUnlimited())) return;

  const budget = await getDailyBudget();
  if (!budget) return;

  const used = await getUsedToday(userId);
  if (used >= budget) {
    throw new LlmError(
      'LLM_TOKEN_BUDGET',
      'Daily LLM token budget exceeded for this user',
      429,
      { used, budget, date: utcDateKey() }
    );
  }
}

async function recordUsage(userId, usage) {
  if (!userId || !usage) return;
  const tokens = Number(usage.total_tokens) || 0;
  if (!tokens) return;

  const usage_date = utcDateKey();
  const [row] = await LlmUsageDaily.findOrCreate({
    where: { user_id: userId, usage_date },
    defaults: {
      user_id: userId,
      usage_date,
      total_tokens: 0,
      request_count: 0,
    },
  });
  await row.update({
    total_tokens: row.total_tokens + tokens,
    request_count: row.request_count + 1,
  });
}

async function getStatus(userId, role) {
  const budget = await getDailyBudget();
  const unlimited = Boolean(role === 'admin' && (await isAdminUnlimited())) || !budget;
  const used = await getUsedToday(userId);
  const remaining = unlimited ? null : Math.max(0, budget - used);
  const percent_used = unlimited || !budget ? 0 : Math.min(100, Math.round((used / budget) * 100));

  return {
    date: utcDateKey(),
    used,
    budget: unlimited ? null : budget,
    remaining,
    unlimited,
    percent_used,
  };
}

module.exports = {
  assertWithinBudget,
  recordUsage,
  getStatus,
  getUsedToday,
  getDailyBudget,
};
