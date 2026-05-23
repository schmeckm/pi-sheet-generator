/**
 * LLM model + max_tokens selection per mode.
 * Reads from settings (cached) and env, with safe fallbacks.
 */

const settingsService = require('../services/settings.service');
const { createTtlCache } = require('./ttlCache');

const DEFAULTS = {
  pi_sheet: { model: 'claude-sonnet-4-20250514', max_tokens: 2500 },
  qa: { model: 'claude-haiku-4-20250514', max_tokens: 1500 },
  vision: { model: 'claude-sonnet-4-20250514', max_tokens: 2500 },
};

const SETTING_KEYS = {
  pi_sheet: { model: 'llm_model_pi_sheet', tokens: 'llm_max_tokens_pi_sheet' },
  qa: { model: 'llm_model_qa', tokens: 'llm_max_tokens_qa' },
  vision: { model: 'llm_model_vision', tokens: 'llm_max_tokens_vision' },
};

const cache = createTtlCache(30_000);

function envOverride(key) {
  return process.env[key] || null;
}

async function getModelConfig(mode = 'pi_sheet') {
  const base = DEFAULTS[mode] || DEFAULTS.pi_sheet;
  const keys = SETTING_KEYS[mode] || SETTING_KEYS.pi_sheet;

  const model = await cache.wrap(`model:${mode}`, async () => {
    try {
      const fromDb = await settingsService.get(keys.model);
      if (fromDb && String(fromDb).trim()) return String(fromDb).trim();
    } catch {
      /* fall through */
    }
    return envOverride(keys.model.toUpperCase()) || base.model;
  });

  const tokens = await cache.wrap(`tokens:${mode}`, async () => {
    try {
      const fromDb = await settingsService.get(keys.tokens);
      const n = Number(fromDb);
      if (Number.isFinite(n) && n >= 256 && n <= 8000) return n;
    } catch {
      /* fall through */
    }
    const envN = Number(envOverride(keys.tokens.toUpperCase()));
    if (Number.isFinite(envN) && envN >= 256 && envN <= 8000) return envN;
    return base.max_tokens;
  });

  return { model, max_tokens: tokens };
}

function invalidate() {
  cache.invalidate();
}

module.exports = { getModelConfig, invalidate, DEFAULTS };
