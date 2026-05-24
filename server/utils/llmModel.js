/**
 * LLM provider + model + max_tokens selection per mode.
 * Reads from settings (cached) and env, with safe fallbacks.
 */

const settingsService = require('../services/settings.service');
const { createTtlCache } = require('./ttlCache');

const PROVIDERS = ['anthropic', 'openai'];

const ALLOWED_ANTHROPIC_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-20250514',
  'claude-opus-4-20250514',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-latest',
  'claude-3-5-sonnet-latest',
];

const ALLOWED_OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o4-mini',
];

/** @deprecated use ALLOWED_ANTHROPIC_MODELS */
const ALLOWED_MODELS = ALLOWED_ANTHROPIC_MODELS;

const DEFAULTS = {
  pi_sheet: { provider: 'anthropic', model: 'claude-sonnet-4-6', max_tokens: 8000 },
  qa: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', max_tokens: 1500 },
  vision: { provider: 'anthropic', model: 'claude-sonnet-4-6', max_tokens: 8000 },
};

const OPENAI_DEFAULTS = {
  pi_sheet: { provider: 'openai', model: 'gpt-4o', max_tokens: 8000 },
  qa: { provider: 'openai', model: 'gpt-4o-mini', max_tokens: 1500 },
  vision: { provider: 'openai', model: 'gpt-4o', max_tokens: 8000 },
};

function isAllowedProvider(provider) {
  return PROVIDERS.includes(String(provider || '').trim());
}

function isAllowedModel(modelId, provider = 'anthropic') {
  const id = String(modelId || '').trim();
  if (!id) return false;
  if (provider === 'openai') {
    return (
      ALLOWED_OPENAI_MODELS.includes(id) ||
      /^gpt-[a-z0-9.-]+$/i.test(id) ||
      /^o\d-[a-z0-9.-]+$/i.test(id)
    );
  }
  return (
    ALLOWED_ANTHROPIC_MODELS.includes(id) || /^claude-[a-z0-9.-]+$/i.test(id)
  );
}

const MODES = ['pi_sheet', 'qa', 'vision'];

const SETTING_KEYS = {
  pi_sheet: {
    provider: 'llm_provider_pi_sheet',
    model: 'llm_model_pi_sheet',
    tokens: 'llm_max_tokens_pi_sheet',
  },
  qa: {
    provider: 'llm_provider_qa',
    model: 'llm_model_qa',
    tokens: 'llm_max_tokens_qa',
  },
  vision: {
    provider: 'llm_provider_vision',
    model: 'llm_model_vision',
    tokens: 'llm_max_tokens_vision',
  },
};

const cache = createTtlCache(30_000);

function envOverride(key) {
  return process.env[key] || null;
}

async function readSetting(key, fallback) {
  try {
    const fromDb = await settingsService.get(key);
    if (fromDb != null && String(fromDb).trim() !== '') return String(fromDb).trim();
  } catch {
    /* fall through */
  }
  return fallback;
}

async function getModelConfig(mode = 'pi_sheet') {
  const full = await getFullModelConfig(mode);
  return { model: full.model, max_tokens: full.max_tokens };
}

async function getFullModelConfig(mode = 'pi_sheet') {
  const base = DEFAULTS[mode] || DEFAULTS.pi_sheet;
  const keys = SETTING_KEYS[mode] || SETTING_KEYS.pi_sheet;

  return cache.wrap(`full:${mode}`, async () => {
    const providerRaw = await readSetting(keys.provider, base.provider);
    const provider = isAllowedProvider(providerRaw) ? providerRaw : base.provider;

    const providerDefaults =
      provider === 'openai' ? OPENAI_DEFAULTS[mode] || OPENAI_DEFAULTS.pi_sheet : base;

    const modelRaw = await readSetting(keys.model, providerDefaults.model);
    const model = isAllowedModel(modelRaw, provider) ? modelRaw : providerDefaults.model;

    let tokens = base.max_tokens;
    try {
      const fromDb = await settingsService.get(keys.tokens);
      const n = Number(fromDb);
      if (Number.isFinite(n) && n >= 256 && n <= 8000) tokens = n;
    } catch {
      /* fall through */
    }
    const envN = Number(envOverride(keys.tokens.toUpperCase()));
    if (Number.isFinite(envN) && envN >= 256 && envN <= 8000) tokens = envN;

    return { provider, model, max_tokens: tokens };
  });
}

function invalidate() {
  cache.invalidate();
}

function modeFromModelSettingKey(key) {
  if (key === 'llm_model_pi_sheet') return 'pi_sheet';
  if (key === 'llm_model_qa') return 'qa';
  if (key === 'llm_model_vision') return 'vision';
  return null;
}

function modeFromProviderSettingKey(key) {
  if (key === 'llm_provider_pi_sheet') return 'pi_sheet';
  if (key === 'llm_provider_qa') return 'qa';
  if (key === 'llm_provider_vision') return 'vision';
  return null;
}

module.exports = {
  getModelConfig,
  getFullModelConfig,
  invalidate,
  DEFAULTS,
  OPENAI_DEFAULTS,
  ALLOWED_MODELS,
  ALLOWED_ANTHROPIC_MODELS,
  ALLOWED_OPENAI_MODELS,
  PROVIDERS,
  MODES,
  isAllowedModel,
  isAllowedProvider,
  SETTING_KEYS,
  modeFromModelSettingKey,
  modeFromProviderSettingKey,
};
