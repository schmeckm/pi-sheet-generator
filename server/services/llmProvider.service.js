const { getAnthropicClient } = require('../config/anthropic');
const { getOpenAIApiKey } = require('../config/openai');
const { getFullModelConfig } = require('../utils/llmModel');
const { withTimeout } = require('../utils/withTimeout');
const { mapLlmError, LlmError } = require('../utils/llmErrors');
const { extractUsageFromResponse, addUsage, extractOpenAiUsage } = require('../utils/llmUsage');
const { EQUIPMENT_TOOL_DEFINITIONS } = require('./equipment/equipment-llm.tools');
const { GRAPH_TOOL_DEFINITIONS } = require('./graph-llm.tools');

const LLM_REQUEST_TIMEOUT_MS = 150_000;
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function assertProviderConfigured(provider) {
  if (provider === 'openai') {
    if (!getOpenAIApiKey()) {
      throw mapLlmError(new Error('OPENAI_API_KEY is not configured'));
    }
    return;
  }
  if (!getAnthropicClient()) {
    throw mapLlmError(new Error('ANTHROPIC_API_KEY is not configured'));
  }
}

function toOpenAiTools(definitions = []) {
  return definitions.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

function extractAnthropicText(response) {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

async function callOpenAi(body) {
  const apiKey = getOpenAIApiKey();
  const res = await withTimeout(
    fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    LLM_REQUEST_TIMEOUT_MS,
    'OpenAI API'
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `OpenAI API error ${res.status}`);
    err.status = res.status;
    err.error = json?.error;
    throw mapLlmError(err);
  }
  return json;
}

async function runOpenAiToolLoop({
  systemPrompt,
  userContent,
  model,
  max_tokens,
  tools = [],
  jsonMode = false,
  maxRounds = 6,
}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  let usage = null;
  let rounds = 0;

  while (rounds < maxRounds) {
    const body = {
      model,
      max_tokens,
      messages,
      ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
      ...(jsonMode && !tools.length ? { response_format: { type: 'json_object' } } : {}),
    };

    const response = await callOpenAi(body);
    usage = addUsage(usage, response);
    const choice = response.choices?.[0];
    if (!choice?.message) {
      throw new LlmError('LLM_GENERIC', 'OpenAI returned an empty response', 502);
    }

    const toolCalls = choice.message.tool_calls || [];
    if (!toolCalls.length) {
      return {
        text: String(choice.message.content || '').trim(),
        usage,
        stopReason: choice.finish_reason,
      };
    }

    messages.push({
      role: 'assistant',
      content: choice.message.content || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      let result;
      const fn = call.function || {};
      let args = {};
      try {
        args = fn.arguments ? JSON.parse(fn.arguments) : {};
      } catch {
        args = {};
      }
      try {
        result = await executeToolSafe(fn.name, args);
      } catch (err) {
        result = { error: err.message };
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }

    rounds += 1;
  }

  throw mapLlmError(new Error('Equipment tool loop exceeded max rounds'));
}

async function callAnthropic(createFn) {
  try {
    return await withTimeout(createFn(), LLM_REQUEST_TIMEOUT_MS, 'Anthropic API');
  } catch (err) {
    throw mapLlmError(err);
  }
}

async function runAnthropicToolLoop(client, requestParams, maxRounds, executeToolSafeFn) {
  const createMessage = requestParams.mcp_servers
    ? (params) =>
        callAnthropic(() =>
          client.beta.messages.create({ ...params, betas: requestParams.betas || ['mcp-client-2025-11-20'] })
        )
    : (params) => callAnthropic(() => client.messages.create(params));

  let response = await createMessage(requestParams);
  let usage = extractUsageFromResponse(response);
  let rounds = 0;

  while (rounds < maxRounds && response.content.some((b) => b.type === 'tool_use')) {
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      let result;
      try {
        result = await executeToolSafeFn(block.name, block.input || {});
      } catch (err) {
        result = { error: err.message };
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    const nextParams = {
      ...requestParams,
      messages: [
        ...requestParams.messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
    };

    response = await createMessage(nextParams);
    usage = addUsage(usage, response);
    rounds += 1;
  }

  return {
    text: extractAnthropicText(response),
    usage,
    stopReason: response.stop_reason,
    rawResponse: response,
  };
}

/** Injected from llm.service to avoid circular deps for graph/equipment tools. */
let executeToolSafe = async () => ({ error: 'Tool handler not configured' });

function setToolExecutor(fn) {
  executeToolSafe = fn;
}

/**
 * Unified LLM completion with optional tools (equipment / graph / MCP on Anthropic only).
 */
async function runCompletion({
  mode,
  systemPrompt,
  userContent,
  includeMcp = false,
  includeEquipmentTools = false,
  includeGraphTools = false,
  maxTokensOverride,
  jsonMode = false,
  mcpParams = {},
  maxRounds = 6,
  executeToolSafeFn,
}) {
  const cfg = await getFullModelConfig(mode);
  assertProviderConfigured(cfg.provider);

  const model = cfg.model;
  const max_tokens = maxTokensOverride || cfg.max_tokens;
  const toolFn = executeToolSafeFn || executeToolSafe;

  if (cfg.provider === 'openai') {
    const tools = toOpenAiTools([
      ...(includeEquipmentTools ? EQUIPMENT_TOOL_DEFINITIONS : []),
      ...(includeGraphTools ? GRAPH_TOOL_DEFINITIONS : []),
    ]);
    return runOpenAiToolLoop({
      systemPrompt,
      userContent,
      model,
      max_tokens,
      tools,
      jsonMode,
      maxRounds,
    });
  }

  const client = getAnthropicClient();
  const tools = [
    ...(includeEquipmentTools ? EQUIPMENT_TOOL_DEFINITIONS : []),
    ...(includeGraphTools ? GRAPH_TOOL_DEFINITIONS : []),
    ...(includeMcp && mcpParams.tools ? mcpParams.tools : []),
  ];

  const requestParams = {
    model,
    max_tokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    ...(tools.length ? { tools } : {}),
    ...(includeMcp ? mcpParams : {}),
  };

  const result = await runAnthropicToolLoop(client, requestParams, maxRounds, toolFn);
  return result;
}

async function checkOpenAiReachable() {
  const key = getOpenAIApiKey();
  if (!key) return false;
  try {
    const res = await fetch('https://api.openai.com/v1/models?limit=1', {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function listOpenAiModels() {
  const key = getOpenAIApiKey();
  if (!key) {
    const { ALLOWED_OPENAI_MODELS } = require('../utils/llmModel');
    return { source: 'static', models: [...ALLOWED_OPENAI_MODELS] };
  }
  try {
    const res = await fetch('https://api.openai.com/v1/models?limit=100', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const { ALLOWED_OPENAI_MODELS } = require('../utils/llmModel');
      return { source: 'static', models: [...ALLOWED_OPENAI_MODELS] };
    }
    const json = await res.json();
    const fromApi = (json.data || [])
      .map((m) => m.id)
      .filter(
        (id) =>
          typeof id === 'string' &&
          (/^gpt-4/i.test(id) || /^gpt-3\.5/i.test(id) || /^o\d/i.test(id))
      );
    const { ALLOWED_OPENAI_MODELS } = require('../utils/llmModel');
    const merged = [...new Set([...ALLOWED_OPENAI_MODELS, ...fromApi])].sort();
    return { source: 'api', models: merged.length ? merged : [...ALLOWED_OPENAI_MODELS] };
  } catch {
    const { ALLOWED_OPENAI_MODELS } = require('../utils/llmModel');
    return { source: 'static', models: [...ALLOWED_OPENAI_MODELS] };
  }
}

module.exports = {
  runCompletion,
  runAnthropicToolLoop,
  runOpenAiToolLoop,
  callOpenAi,
  setToolExecutor,
  assertProviderConfigured,
  checkOpenAiReachable,
  listOpenAiModels,
  extractAnthropicText,
  toOpenAiTools,
};
