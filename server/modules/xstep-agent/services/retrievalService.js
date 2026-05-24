'use strict';

const path = require('path');
const { parseSopChunks, tokenize } = require('../parsers/sopParser');
const { parseRecipe } = require('../parsers/recipeParser');

const MOCK_DIR = path.join(__dirname, '..', 'data', 'mock');

function loadJson(name) {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(path.join(MOCK_DIR, name));
}

function scoreDocument(doc, queryTokens) {
  if (!queryTokens.length) return 0;
  const haystack = [
    doc.name,
    doc.title,
    doc.text,
    doc.id,
    doc.stepType,
    ...(doc.keywords || []),
    ...(doc.tokens || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function matchesMetadata(doc, filters = {}) {
  if (filters.processArea && doc.processArea && doc.processArea !== filters.processArea) {
    return false;
  }
  if (filters.packagingType && doc.packagingType && doc.packagingType !== filters.packagingType) {
    return false;
  }
  return true;
}

/**
 * Retrieve top-k mock knowledge items using metadata filter + keyword ranking.
 * @param {{ query?: string, processArea?: string, packagingType?: string, topK?: number }} options
 */
function retrieve(options = {}) {
  const query = options.query || '';
  const topK = Math.max(1, Math.min(options.topK || 5, 20));
  const filters = {
    processArea: options.processArea,
    packagingType: options.packagingType,
  };
  const queryTokens = tokenize(query);

  const materials = loadJson('materials.json').filter((m) => matchesMetadata(m, filters));
  const xsteps = loadJson('xsteps.json').filter((x) => matchesMetadata(x, filters));
  const recipes = loadJson('recipes.json')
    .map(parseRecipe)
    .filter((r) => matchesMetadata(r, filters));
  const sops = parseSopChunks(loadJson('sops.json')).filter((s) => matchesMetadata(s, filters));

  const ranked = [
    ...materials.map((m) => ({ type: 'material', score: scoreDocument(m, queryTokens), data: m })),
    ...xsteps.map((x) => ({ type: 'xstep', score: scoreDocument(x, queryTokens), data: x })),
    ...recipes.map((r) => ({ type: 'recipe', score: scoreDocument(r, queryTokens), data: r })),
    ...sops.map((s) => ({ type: 'sop', score: scoreDocument(s, queryTokens), data: s })),
  ]
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type))
    .slice(0, topK);

  return {
    query,
    filters,
    topK,
    mode: 'keyword-mock',
    results: ranked,
    counts: {
      materials: materials.length,
      xsteps: xsteps.length,
      recipes: recipes.length,
      sops: sops.length,
    },
  };
}

module.exports = {
  retrieve,
  scoreDocument,
  matchesMetadata,
  loadJson,
};
