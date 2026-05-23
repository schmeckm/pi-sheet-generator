const { PromptConfig } = require('../models');
const { createTtlCache } = require('../utils/ttlCache');

const TTL_MS = 30_000;
const cache = createTtlCache(TTL_MS);

const NAME_PI_SHEET = 'default';
const NAME_QA = 'qa-default';

async function getActive() {
  return cache.wrap('active', async () => {
    return PromptConfig.findOne({ where: { is_active: true } });
  });
}

async function getByName(name) {
  return cache.wrap(`name:${name}`, async () => {
    return PromptConfig.findOne({ where: { name } });
  });
}

/**
 * Resolve the prompt config to use for a given mode.
 * - PI sheet: active "pi_sheet" prompt if present (name: default), else any active.
 * - QA: optional dedicated "qa-default" prompt; otherwise active.
 */
async function getForMode(mode = 'pi_sheet') {
  if (mode === 'qa') {
    const qa = await getByName(NAME_QA);
    if (qa) return qa;
  }
  return getActive();
}

function invalidate() {
  cache.invalidate();
}

module.exports = {
  getActive,
  getByName,
  getForMode,
  invalidate,
  NAME_PI_SHEET,
  NAME_QA,
};
