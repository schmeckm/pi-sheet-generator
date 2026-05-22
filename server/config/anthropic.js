const Anthropic = require('@anthropic-ai/sdk');

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes('your-key-here')) {
    return null;
  }
  return new Anthropic({ apiKey });
}

module.exports = { getAnthropicClient };
