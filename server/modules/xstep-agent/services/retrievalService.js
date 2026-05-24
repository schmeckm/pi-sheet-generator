'use strict';

const path = require('path');
const { parseSopChunks, tokenize } = require('../parsers/sopParser');
const { parseRecipe } = require('../parsers/recipeParser');

const MOCK_DIR = path.join(__dirname, '..', 'data', 'mock');

function loadJson(name) {
  return require(path.join(MOCK_DIR, name));
}

function scoreDocument(doc, queryTokens) {
  if (!queryTokens.length) return 0;
  const haystack = [
    doc.name,
    doc.title,
    doc.text,
    doc.id,
    doc.xstep_id,
    doc.stepType,
    doc.category,
    doc.process_type,
    doc.description,
    ...(doc.keywords || []),
    ...(doc.tokens || []),
    ...(doc.tags || []),
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

function mapDbXStepToCanonical(row) {
  const r = row.dataValues ? row.dataValues : row;
  return {
    id: r.xstep_id,
    dbId: r.id,
    name: r.name,
    stepType: guessStepType(r),
    processArea: r.process_type || '',
    category: r.category || 'Prozess',
    gmpRelevant: Boolean(r.gmp_relevant),
    requiresSignature: Boolean(r.signature_required),
    keywords: Array.isArray(r.tags) ? r.tags : [],
    description: r.description || '',
    params: r.params || [],
    sap_transaction: r.sap_transaction || '',
    sap_system: r.sap_system || '',
    source: 'database',
    similarity: r.similarity != null ? Number(r.similarity) : undefined,
  };
}

function guessStepType(row) {
  const name = String(row.name || '').toLowerCase();
  const cat = String(row.category || '').toLowerCase();
  const xid = String(row.xstep_id || '').toLowerCase();
  const combined = `${name} ${cat} ${xid}`;

  if (/line.?clear|linienfreigabe/.test(combined)) return 'LINE_CLEARANCE';
  if (/material.?id|materialprüf/.test(combined)) return 'MATERIAL_IDENTIFICATION';
  if (/goods.?move|warenbewegung|umlager/.test(combined)) return 'GOODS_MOVEMENT';
  if (/ipc|in.?process|kontrolle/.test(combined)) return 'IPC_CHECK';
  if (/dokument|documentation|batch.?record/.test(combined)) return 'DOCUMENTATION';
  if (/signature|signatur|freigabe|genehmig/.test(combined)) return 'SIGNATURE';
  return 'PROCESS';
}

function mapDbChunkToSop(row) {
  const r = row.dataValues ? row.dataValues : row;
  return {
    id: `CHUNK-${r.id || r.chunk_index}`,
    title: r['kd.title'] || r.title || r.doc_title || 'Knowledge Chunk',
    processArea: r['kd.process_type'] || r.process_type || r.doc_process_type || '',
    text: r.content || '',
    chunkIndex: r.chunk_index || 0,
    source: 'database',
    similarity: r.similarity != null ? Number(r.similarity) : undefined,
  };
}

/**
 * Try loading real XSteps from DB via embedding service.
 * Falls back to empty array on any error (module must not crash the app).
 */
async function loadDbXSteps(query, processType, limit) {
  try {
    const embeddingService = require('../../../services/embedding.service');
    const rows = await embeddingService.searchSimilar(query, { limit, processType });
    return rows.map(mapDbXStepToCanonical);
  } catch {
    return [];
  }
}

/**
 * Try loading real knowledge chunks from DB.
 */
async function loadDbChunks(query, processType, limit) {
  try {
    const knowledgeService = require('../../../services/knowledge.service');
    const rows = await knowledgeService.searchChunks(query, { limit, processType });
    return rows.map(mapDbChunkToSop);
  } catch {
    return [];
  }
}

/**
 * Load process graph context (chain + requirements) for step ordering.
 */
async function loadGraphContext(processType) {
  try {
    const graphService = require('../../../services/graph.service');
    return await graphService.getProcessContext(processType);
  } catch {
    return null;
  }
}

/**
 * Load existing PI Sheets as reference examples.
 */
async function loadPiSheetExamples(processType, limit = 3) {
  try {
    const { PISheet, PISheetStep } = require('../../../models');
    const where = { status: 'approved' };
    if (processType) where.process_type = processType;
    const sheets = await PISheet.findAll({
      where,
      include: [{ model: PISheetStep, as: 'steps' }],
      order: [['approved_at', 'DESC']],
      limit,
    });
    return sheets.map((s) => ({
      id: s.id,
      title: s.title,
      process_type: s.process_type,
      stepCount: s.steps?.length || 0,
      steps: (s.steps || []).map((st) => ({
        step_nr: st.step_nr,
        name: st.name,
        xstep_id: st.xstep_id,
        category: st.category,
      })),
      source: 'pi-sheet-example',
    }));
  } catch {
    return [];
  }
}

/**
 * Retrieve knowledge items — prefers real DB data, falls back to mock.
 */
async function retrieve(options = {}) {
  const query = options.query || '';
  const topK = Math.max(1, Math.min(options.topK || 10, 50));
  const filters = {
    processArea: options.processArea,
    packagingType: options.packagingType,
  };
  const queryTokens = tokenize(query);
  const processType = filters.processArea || null;

  const [dbXSteps, dbChunks, graphContext, piSheetExamples] = await Promise.all([
    loadDbXSteps(query, processType, topK),
    loadDbChunks(query, processType, topK),
    loadGraphContext(processType),
    loadPiSheetExamples(processType, 3),
  ]);

  const useDb = dbXSteps.length > 0 || dbChunks.length > 0;

  let mockXSteps = [];
  let mockSops = [];
  let mockMaterials = [];
  let mockRecipes = [];

  if (!useDb) {
    mockMaterials = loadJson('materials.json').filter((m) => matchesMetadata(m, filters));
    mockXSteps = loadJson('xsteps.json').filter((x) => matchesMetadata(x, filters));
    mockRecipes = loadJson('recipes.json').map(parseRecipe).filter((r) => matchesMetadata(r, filters));
    mockSops = parseSopChunks(loadJson('sops.json')).filter((s) => matchesMetadata(s, filters));
  }

  const ranked = [];

  for (const x of dbXSteps) {
    ranked.push({
      type: 'xstep',
      score: x.similarity != null ? x.similarity * 10 : scoreDocument(x, queryTokens),
      data: x,
    });
  }
  for (const c of dbChunks) {
    ranked.push({
      type: 'knowledge',
      score: c.similarity != null ? c.similarity * 10 : scoreDocument(c, queryTokens),
      data: c,
    });
  }

  for (const m of mockMaterials) {
    ranked.push({ type: 'material', score: scoreDocument(m, queryTokens), data: m });
  }
  for (const x of mockXSteps) {
    ranked.push({ type: 'xstep', score: scoreDocument(x, queryTokens), data: x });
  }
  for (const r of mockRecipes) {
    ranked.push({ type: 'recipe', score: scoreDocument(r, queryTokens), data: r });
  }
  for (const s of mockSops) {
    ranked.push({ type: 'sop', score: scoreDocument(s, queryTokens), data: s });
  }

  for (const ex of piSheetExamples) {
    ranked.push({ type: 'pi-sheet-example', score: 5, data: ex });
  }

  ranked.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
  const topResults = ranked.slice(0, topK);

  return {
    query,
    filters,
    topK,
    mode: useDb ? 'database' : 'keyword-mock',
    results: topResults,
    graphContext: graphContext || null,
    counts: {
      dbXSteps: dbXSteps.length,
      dbChunks: dbChunks.length,
      piSheetExamples: piSheetExamples.length,
      graphChainLength: graphContext?.chain?.length || 0,
      mockXSteps: mockXSteps.length,
      mockMaterials: mockMaterials.length,
      mockRecipes: mockRecipes.length,
      mockSops: mockSops.length,
    },
  };
}

/**
 * Synchronous mock-only retrieve for unit tests (no DB).
 */
function retrieveMockOnly(options = {}) {
  const query = options.query || '';
  const topK = Math.max(1, Math.min(options.topK || 5, 20));
  const filters = {
    processArea: options.processArea,
    packagingType: options.packagingType,
  };
  const queryTokens = tokenize(query);

  const materials = loadJson('materials.json').filter((m) => matchesMetadata(m, filters));
  const xsteps = loadJson('xsteps.json').filter((x) => matchesMetadata(x, filters));
  const recipes = loadJson('recipes.json').map(parseRecipe).filter((r) => matchesMetadata(r, filters));
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
  retrieveMockOnly,
  scoreDocument,
  matchesMetadata,
  loadJson,
};
