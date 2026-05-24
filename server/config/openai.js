function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY;
  if (!apiKey || apiKey.includes('your-key-here')) {
    return null;
  }
  return apiKey.trim();
}

module.exports = { getOpenAIApiKey };
