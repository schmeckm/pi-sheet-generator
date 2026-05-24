'use strict';

const { getLlmProvider } = require('../config');

const PACKAGING_KEYWORDS = {
  blister: 'Blister',
  packaging: 'Packaging',
  verpackung: 'Packaging',
  'line clearance': 'LINE_CLEARANCE',
  'material identification': 'MATERIAL_IDENTIFICATION',
  ipc: 'IPC_CHECK',
  'goods movement': 'GOODS_MOVEMENT',
  'electronic signature': 'SIGNATURE',
  esignature: 'SIGNATURE',
};

/**
 * Mock LLM: enrich prompt interpretation without external API.
 */
async function mockEnhancePrompt(prompt) {
  const lower = String(prompt || '').toLowerCase();
  const hints = [];
  for (const [key, value] of Object.entries(PACKAGING_KEYWORDS)) {
    if (lower.includes(key)) hints.push(value);
  }
  return {
    provider: 'mock',
    processArea: hints.includes('Packaging') || lower.includes('packaging') ? 'Packaging' : 'General',
    packagingType: hints.includes('Blister') ? 'Blister' : undefined,
    requestedCapabilities: hints,
    summary: `Mock interpretation for: ${prompt.slice(0, 120)}`,
  };
}

async function callOllama(prompt) {
  const baseUrl = process.env.XSTEP_AGENT_OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.XSTEP_AGENT_OLLAMA_MODEL || 'llama3.2';
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `Extract processArea, packagingType, and required step types as JSON from: ${prompt}`,
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    provider: 'ollama',
    raw: data.response,
    summary: String(data.response || '').slice(0, 200),
  };
}

async function callOpenAi(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY not configured for XStep agent');
    err.code = 'LLM_NOT_CONFIGURED';
    throw err;
  }
  const model = process.env.XSTEP_AGENT_OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Return JSON with keys processArea, packagingType, requestedStepTypes (array of strings). No SAP write-back.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${res.status}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { summary: text };
  }
  return { provider: 'openai', ...parsed };
}

async function interpretPrompt(prompt) {
  const provider = getLlmProvider();
  if (provider === 'ollama') {
    try {
      return await callOllama(prompt);
    } catch {
      return mockEnhancePrompt(prompt);
    }
  }
  if (provider === 'openai') {
    try {
      return await callOpenAi(prompt);
    } catch {
      return mockEnhancePrompt(prompt);
    }
  }
  return mockEnhancePrompt(prompt);
}

module.exports = {
  interpretPrompt,
  mockEnhancePrompt,
};
