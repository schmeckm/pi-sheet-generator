/** Normalize Anthropic message.usage for API responses and UI. */

function extractUsageFromResponse(response) {
  const openAi = extractOpenAiUsage(response);
  if (openAi) return openAi;

  const u = response?.usage;
  if (!u || typeof u !== 'object') return null;
  const input = Number(u.input_tokens) || 0;
  const output = Number(u.output_tokens) || 0;
  if (!input && !output) return null;
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
  };
}

function extractOpenAiUsage(response) {
  const u = response?.usage;
  if (!u || typeof u !== 'object') return null;
  const input = Number(u.prompt_tokens) || 0;
  const output = Number(u.completion_tokens) || 0;
  if (!input && !output) return null;
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: Number(u.total_tokens) || input + output,
  };
}

function mergeUsage(a, b) {
  if (!b) return a || null;
  if (!a) return { ...b };
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    total_tokens: a.total_tokens + b.total_tokens,
  };
}

function addUsage(acc, response) {
  return mergeUsage(acc, extractUsageFromResponse(response));
}

module.exports = { extractUsageFromResponse, extractOpenAiUsage, mergeUsage, addUsage };
