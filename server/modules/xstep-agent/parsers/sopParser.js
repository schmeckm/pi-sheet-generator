'use strict';

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter((t) => t.length > 2);
}

/**
 * Convert SOP chunk records into retrieval-ready documents.
 * @param {object[]|object|string} input
 */
function parseSopChunks(input) {
  const chunks = typeof input === 'string' ? JSON.parse(input) : input;
  const list = Array.isArray(chunks) ? chunks : [chunks];

  return list.map((chunk, index) => {
    if (!chunk || typeof chunk !== 'object') {
      throw new Error(`Invalid SOP chunk at index ${index}`);
    }
    const keywords = Array.isArray(chunk.keywords) ? chunk.keywords.map(String) : [];
    const textTokens = tokenize(chunk.text);
    const titleTokens = tokenize(chunk.title);

    return {
      id: chunk.id || `SOP-CHUNK-${index + 1}`,
      title: chunk.title || `SOP Chunk ${index + 1}`,
      processArea: chunk.processArea || '',
      packagingType: chunk.packagingType || '',
      chunkIndex: Number(chunk.chunkIndex) || 0,
      text: chunk.text || '',
      keywords,
      tokens: [...new Set([...keywords.map((k) => k.toLowerCase()), ...textTokens, ...titleTokens])],
      sourceFormat: 'sop-chunk-json',
    };
  });
}

module.exports = {
  parseSopChunks,
  tokenize,
};
