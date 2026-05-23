/** Structured LLM / PI-sheet errors for API + i18n (client maps `code`). */

class LlmError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.name = 'LlmError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function isMcpRetryable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('mcp') ||
    msg.includes('connector') ||
    msg.includes('sap_mcp') ||
    err?.code === 'LLM_MCP_UNAVAILABLE'
  );
}

function mapAnthropicError(err) {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  const type = err?.error?.type || err?.type;
  const msg = String(err?.message || err?.error?.message || '').toLowerCase();

  if (status === 429 || type === 'rate_limit_error' || msg.includes('rate limit')) {
    return new LlmError(
      'LLM_RATE_LIMIT',
      'Anthropic rate limit reached. Please wait and try again.',
      429
    );
  }
  if (status === 529 || msg.includes('overloaded') || type === 'overloaded_error') {
    return new LlmError(
      'LLM_OVERLOADED',
      'The AI service is temporarily overloaded. Please try again shortly.',
      503
    );
  }
  if (status === 401 || msg.includes('authentication') || msg.includes('invalid api key')) {
    return new LlmError(
      'LLM_AUTH_FAILED',
      'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.',
      503
    );
  }
  if (
    status === 400 &&
    (msg.includes('context') ||
      msg.includes('too long') ||
      msg.includes('token') ||
      msg.includes('maximum'))
  ) {
    return new LlmError(
      'LLM_CONTEXT_TOO_LONG',
      'The request context is too large for the model. Shorten your prompt or reduce repository context.',
      413
    );
  }
  if (
    msg.includes('credit') ||
    msg.includes('billing') ||
    msg.includes('insufficient') ||
    msg.includes('payment')
  ) {
    return new LlmError(
      'LLM_BILLING',
      'Anthropic API billing or quota limit reached.',
      503
    );
  }
  if (
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ECONNRESET' ||
    err?.code === 'ECONNABORTED' ||
    err?.name === 'AbortError' ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  ) {
    return new LlmError(
      'LLM_TIMEOUT',
      'The AI request timed out. Please try again.',
      504
    );
  }
  if (msg.includes('network') || msg.includes('fetch failed') || err?.code === 'ENOTFOUND') {
    return new LlmError(
      'LLM_NETWORK',
      'Could not reach the AI service. Check network and API availability.',
      503
    );
  }

  return null;
}

function mapLlmError(err) {
  if (err instanceof LlmError) return err;

  if (err?.message === 'ANTHROPIC_API_KEY is not configured') {
    return new LlmError(
      'LLM_NOT_CONFIGURED',
      'ANTHROPIC_API_KEY is not configured',
      503
    );
  }
  if (err?.message === 'No active prompt configuration found') {
    return new LlmError(
      'PROMPT_CONFIG_MISSING',
      'No active prompt configuration found',
      503
    );
  }
  if (err?.message === 'Equipment tool loop exceeded max rounds') {
    return new LlmError(
      'LLM_TOOL_LOOP',
      'Equipment tool loop exceeded maximum rounds',
      504
    );
  }

  const anthropic = mapAnthropicError(err);
  if (anthropic) return anthropic;

  return new LlmError(
    'LLM_GENERIC',
    err?.message || 'An unexpected AI error occurred',
    err?.statusCode || 500
  );
}

function throwPiJsonParseError(cause) {
  throw new LlmError(
    'PI_JSON_PARSE',
    'Could not parse PI Sheet JSON from the model response',
    422,
    cause?.message
  );
}

function detectRefusal(text) {
  const lower = String(text || '').toLowerCase();
  const hints = [
    'i cannot',
    'i can\'t',
    'ich kann nicht',
    'unable to',
    'not able to',
    'against policy',
    'sorry,',
    'entschuldigung',
  ];
  return hints.some((h) => lower.includes(h)) && !/\{\s*"title"/.test(text);
}

const VALID_CATEGORIES = new Set([
  'Warenbewegung',
  'Rückmeldung',
  'Qualität',
  'Prozess',
  'Dokumentation',
]);

const VALID_PARAM_TYPES = new Set([
  'input',
  'display',
  'checkbox',
  'scale',
  'temperature',
  'select',
]);

function clampConfidence(value) {
  if (value == null) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return Math.round(n) / 100;
  return Math.max(0, Math.min(1, n));
}

function validatePiSheet(parsed, rawText = '', options = {}) {
  if (!parsed || typeof parsed !== 'object') {
    throw new LlmError(
      'PI_INVALID_STRUCTURE',
      'Invalid PI Sheet structure: expected a JSON object',
      422
    );
  }
  if (!parsed.title || typeof parsed.title !== 'string' || !parsed.title.trim()) {
    throw new LlmError(
      'PI_INVALID_STRUCTURE',
      'Invalid PI Sheet structure: title is required',
      422
    );
  }
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new LlmError(
      'PI_INVALID_STRUCTURE',
      'Invalid PI Sheet structure: at least one step is required',
      422
    );
  }

  const allowedEquipmentIds = new Set(
    (options.allowedEquipmentIds || []).filter(Boolean)
  );
  const seenStepNrs = new Set();
  const warnings = Array.isArray(parsed.warnings) ? [...parsed.warnings] : [];

  for (let i = 0; i < parsed.steps.length; i += 1) {
    const step = parsed.steps[i];
    if (!step || typeof step !== 'object') {
      throw new LlmError(
        'PI_INVALID_STRUCTURE',
        `Invalid PI Sheet step at index ${i}: expected an object`,
        422
      );
    }
    if (!step.name || typeof step.name !== 'string' || !step.name.trim()) {
      throw new LlmError(
        'PI_INVALID_STRUCTURE',
        `Invalid PI Sheet step at index ${i}: name is required`,
        422
      );
    }

    if (step.confidence != null) step.confidence = clampConfidence(step.confidence);

    if (step.step_nr != null) {
      const nr = Number(step.step_nr);
      if (Number.isFinite(nr)) {
        if (seenStepNrs.has(nr)) {
          warnings.push(`Duplicate step_nr ${nr} normalized at index ${i}`);
          step.step_nr = i + 1;
        } else {
          seenStepNrs.add(nr);
        }
      }
    }

    if (step.category && !VALID_CATEGORIES.has(step.category)) {
      warnings.push(
        `Step ${step.step_nr || i + 1}: unknown category "${step.category}" — kept as is, please review`
      );
    }

    if (Array.isArray(step.params)) {
      for (const p of step.params) {
        if (!p || typeof p !== 'object') continue;
        if (p.type && !VALID_PARAM_TYPES.has(p.type)) {
          warnings.push(
            `Step ${step.step_nr || i + 1}: parameter "${p.name || '?'}" has unknown type "${p.type}"`
          );
        }
        const eqId = p?.equipment_config?.equipment_id;
        if (eqId && allowedEquipmentIds.size && !allowedEquipmentIds.has(eqId)) {
          warnings.push(
            `Step ${step.step_nr || i + 1}: unknown equipment_id "${eqId}" — not in configured equipment`
          );
          delete p.equipment_config;
        }
      }
    }
  }

  parsed.warnings = warnings;
  if (parsed.confidence != null) parsed.confidence = clampConfidence(parsed.confidence);

  const text = rawText || JSON.stringify(parsed);
  if (detectRefusal(text) && !parsed.steps?.length) {
    throw new LlmError(
      'PI_REFUSAL',
      'The model declined to generate a PI Sheet for this request',
      422
    );
  }

  if (text.includes('"steps"') && text.endsWith('...')) {
    throw new LlmError(
      'PI_TRUNCATED',
      'The PI Sheet response appears truncated (token limit). Try a shorter prompt.',
      422
    );
  }

  return parsed;
}

function parseLlmJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new LlmError(
      'PI_EMPTY_RESPONSE',
      'The model returned an empty response',
      422
    );
  }
  if (detectRefusal(trimmed) && !trimmed.includes('"title"')) {
    throw new LlmError(
      'PI_REFUSAL',
      'The model declined to generate a PI Sheet for this request',
      422
    );
  }

  try {
    return JSON.parse(trimmed);
  } catch (firstErr) {
    try {
      const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) {
        return JSON.parse(codeBlock[1].trim());
      }
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      throwPiJsonParseError(firstErr);
    }
    throwPiJsonParseError(firstErr);
  }
}

function toErrorPayload(err, locale = 'de') {
  const mapped = mapLlmError(err);
  return {
    error: mapped.message,
    code: mapped.code,
    statusCode: mapped.statusCode,
    details: mapped.details || undefined,
    locale,
  };
}

module.exports = {
  LlmError,
  mapLlmError,
  isMcpRetryable,
  parseLlmJson,
  validatePiSheet,
  toErrorPayload,
  VALID_CATEGORIES,
  VALID_PARAM_TYPES,
  clampConfidence,
};
