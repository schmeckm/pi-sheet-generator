'use strict';

function isXstepAgentEnabled() {
  const v = process.env.XSTEP_AGENT_ENABLED;
  return v === 'true' || v === '1';
}

function getLlmProvider() {
  const provider = (process.env.XSTEP_AGENT_LLM_PROVIDER || 'mock').toLowerCase();
  if (['mock', 'ollama', 'openai'].includes(provider)) return provider;
  return 'mock';
}

module.exports = {
  isXstepAgentEnabled,
  getLlmProvider,
};
