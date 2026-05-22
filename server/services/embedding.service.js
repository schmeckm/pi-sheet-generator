const { Op } = require('sequelize');
const { sequelize, XStep } = require('../models');

function buildSearchText(xstep) {
  const params = Array.isArray(xstep.params) ? xstep.params : [];
  const paramNames = params.map((p) => p.name).filter(Boolean).join(', ');
  return [
    xstep.name,
    xstep.category,
    xstep.process_type,
    xstep.description,
    paramNames ? `Parameter: ${paramNames}` : '',
    xstep.sap_transaction ? `SAP: ${xstep.sap_transaction}` : '',
    xstep.movement_type ? `Bewegungsart: ${xstep.movement_type}` : '',
  ]
    .filter(Boolean)
    .join(' - ');
}

function getEmbeddingApiKey() {
  return process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || null;
}

async function generateEmbedding(text) {
  const apiKey = getEmbeddingApiKey();
  if (!apiKey) {
    return null;
  }

  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const baseUrl = process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1/embeddings';

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

async function embedXStep(xstepId) {
  const xstep = await XStep.findByPk(xstepId);
  if (!xstep) return false;

  const text = buildSearchText(xstep);
  const embedding = await generateEmbedding(text);
  if (!embedding) {
    console.log(`Skipping embedding for ${xstep.xstep_id} (no API key)`);
    return false;
  }

  const vectorStr = `[${embedding.join(',')}]`;
  await sequelize.query(
    `UPDATE xsteps SET embedding = $1::vector WHERE id = $2`,
    { bind: [vectorStr, xstepId] }
  );
  return true;
}

async function embedAllXSteps() {
  if (!getEmbeddingApiKey()) {
    console.log('No embedding API key configured — skipping embedAllXSteps');
    return { embedded: 0, skipped: true };
  }

  const rows = await sequelize.query(
    `SELECT id FROM xsteps WHERE embedding IS NULL AND is_active = true`,
    { type: sequelize.QueryTypes.SELECT }
  );

  let embedded = 0;
  for (const row of rows) {
    const ok = await embedXStep(row.id);
    if (ok) embedded += 1;
  }
  return { embedded, skipped: false };
}

async function searchSimilar(queryText, { limit = 15, processType = null } = {}) {
  const embedding = await generateEmbedding(queryText);
  if (!embedding) {
    return searchByKeywords(queryText, { limit, processType });
  }

  const vectorStr = `[${embedding.join(',')}]`;
  const binds = [vectorStr];
  let processFilter = '';
  if (processType) {
    binds.push(processType);
    processFilter = `AND process_type = $${binds.length}`;
  }
  binds.push(limit);

  const [rows] = await sequelize.query(
    `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
     FROM xsteps
     WHERE is_active = true AND embedding IS NOT NULL
     ${processFilter}
     ORDER BY embedding <=> $1::vector
     LIMIT $${binds.length}`,
    { bind: binds }
  );

  if (!rows.length) {
    return searchByKeywords(queryText, { limit, processType });
  }

  return rows;
}

async function searchByKeywords(queryText, { limit = 15, processType = null } = {}) {
  const terms = queryText
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);

  const where = { is_active: true };
  if (processType) where.process_type = processType;

  if (terms.length) {
    where[Op.or] = terms.flatMap((term) => [
      { name: { [Op.iLike]: `%${term}%` } },
      { description: { [Op.iLike]: `%${term}%` } },
      { category: { [Op.iLike]: `%${term}%` } },
      { process_type: { [Op.iLike]: `%${term}%` } },
      { xstep_id: { [Op.iLike]: `%${term}%` } },
    ]);
  }

  return XStep.findAll({
    where,
    order: [['sort_order', 'ASC']],
    limit,
  });
}

module.exports = {
  buildSearchText,
  generateEmbedding,
  embedXStep,
  embedAllXSteps,
  searchSimilar,
  searchByKeywords,
  getEmbeddingApiKey,
};
