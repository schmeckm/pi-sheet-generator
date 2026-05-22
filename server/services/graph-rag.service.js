const { Op } = require('sequelize');
const { getAnthropicClient } = require('../config/anthropic');
const {
  KnowledgeDocument,
  DocumentChunk,
  GraphEdgeSuggestion,
  XStep,
  EquipmentConfig,
} = require('../models');
const graphService = require('./graph.service');
const { logAudit } = require('./audit.service');

const XSTEP_RE = /\b(XS-[A-Z]{2}-\d{3}|NEW-\d{3})\b/gi;
const EQUIP_RE = /\b(W-GR-\d{2,3}|T-GR-\d{2,3})\b/gi;

function uniqueRefs(text, regex) {
  const re = new RegExp(regex.source, regex.flags);
  return [...new Set([...text.matchAll(re)].map((m) => String(m[1]).toUpperCase()))];
}

function normalizeXStepId(id) {
  return String(id).trim().toUpperCase();
}

async function filterValidRefs(suggestions, processType) {
  const xstepIds = [
    ...new Set(
      suggestions.filter((s) => s.from_kind === 'xstep' || s.to_kind === 'xstep').flatMap((s) => {
        const ids = [];
        if (s.from_kind === 'xstep') ids.push(s.from_ref);
        if (s.to_kind === 'xstep') ids.push(s.to_ref);
        return ids;
      })
    ),
  ];
  const equipIds = [
    ...new Set(
      suggestions
        .filter((s) => s.to_kind === 'equipment' || s.from_kind === 'equipment')
        .map((s) => (s.to_kind === 'equipment' ? s.to_ref : s.from_ref))
    ),
  ];

  const [xsteps, equipment] = await Promise.all([
    xstepIds.length
      ? XStep.findAll({
          where: { xstep_id: { [Op.in]: xstepIds }, is_active: true },
          attributes: ['xstep_id'],
        })
      : [],
    equipIds.length
      ? EquipmentConfig.findAll({
          where: { equipment_id: { [Op.in]: equipIds }, is_active: true },
          attributes: ['equipment_id'],
        })
      : [],
  ]);

  const validX = new Set(xsteps.map((x) => x.xstep_id));
  const validE = new Set(equipment.map((e) => e.equipment_id));

  return suggestions.filter((s) => {
    if (s.from_kind === 'xstep' && !validX.has(s.from_ref)) return false;
    if (s.to_kind === 'xstep' && !validX.has(s.to_ref)) return false;
    if (s.from_kind === 'equipment' && !validE.has(s.from_ref)) return false;
    if (s.to_kind === 'equipment' && !validE.has(s.to_ref)) return false;
    if (s.from_ref === s.to_ref && s.from_kind === s.to_kind) return false;
    return true;
  });
}

function heuristicExtract(chunks, processType, documentId) {
  const suggestions = [];
  const seen = new Set();

  const push = (row) => {
    const key = `${row.process_type}|${row.edge_type}|${row.from_ref}|${row.to_ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(row);
  };

  for (const chunk of chunks) {
    const text = chunk.content || '';
    const xsteps = uniqueRefs(text, XSTEP_RE).map(normalizeXStepId);
    const equips = uniqueRefs(text, EQUIP_RE);

    for (let i = 0; i < xsteps.length - 1; i += 1) {
      push({
        process_type: processType,
        edge_type: 'FOLLOWS',
        from_kind: 'xstep',
        from_ref: xsteps[i],
        to_kind: 'xstep',
        to_ref: xsteps[i + 1],
        document_id: documentId,
        chunk_id: chunk.id,
        source_excerpt: text.slice(0, 280),
        metadata: { source: 'heuristic' },
      });
    }

    for (const xs of xsteps) {
      for (const eq of equips) {
        push({
          process_type: processType,
          edge_type: 'USES_EQUIPMENT',
          from_kind: 'xstep',
          from_ref: xs,
          to_kind: 'equipment',
          to_ref: eq,
          document_id: documentId,
          chunk_id: chunk.id,
          source_excerpt: text.slice(0, 280),
          metadata: { source: 'heuristic' },
        });
      }
    }
  }

  return suggestions;
}

function parseLlmEdges(text) {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : parsed.edges || [];
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

async function llmExtract(chunks, processType, documentId) {
  const client = getAnthropicClient();
  if (!client) return [];

  const sample = chunks
    .slice(0, 10)
    .map((c, i) => `[Chunk ${i + 1} p.${c.page_number || '?'}]\n${c.content}`)
    .join('\n\n')
    .slice(0, 14000);

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Extract process graph edges from this GMP document excerpt for process type "${processType}".
Return ONLY a JSON array. Each item:
{ "edge_type": "FOLLOWS"|"USES_EQUIPMENT", "from_ref": "...", "to_ref": "...", "from_kind": "xstep"|"equipment", "to_kind": "xstep"|"equipment", "excerpt": "short quote" }
Use only XStep IDs (XS-XX-###) and equipment IDs (W-GR-##) that appear in the text. Max 20 edges.

${sample}`,
      },
    ],
  });

  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const raw = parseLlmEdges(text);

  return raw.map((e) => ({
    process_type: processType,
    edge_type: e.edge_type === 'USES_EQUIPMENT' ? 'USES_EQUIPMENT' : 'FOLLOWS',
    from_kind: e.from_kind || 'xstep',
    from_ref: normalizeXStepId(e.from_ref),
    to_kind: e.to_kind || (e.edge_type === 'USES_EQUIPMENT' ? 'equipment' : 'xstep'),
    to_ref: String(e.to_ref || '').trim(),
    document_id: documentId,
    chunk_id: null,
    source_excerpt: (e.excerpt || '').slice(0, 500),
    metadata: { source: 'llm' },
  }));
}

async function extractFromDocument(documentId) {
  const doc = await KnowledgeDocument.findByPk(documentId);
  if (!doc || doc.status !== 'ready') return { created: 0 };

  const processType = doc.process_type;
  if (!processType) {
    console.log(`[graph-rag] Skip ${documentId}: no process_type on document`);
    return { created: 0 };
  }

  const chunks = await DocumentChunk.findAll({
    where: { document_id: doc.id },
    order: [['chunk_index', 'ASC']],
    limit: 40,
  });
  if (!chunks.length) return { created: 0 };

  let suggestions = heuristicExtract(chunks, processType, doc.id);
  try {
    const llmEdges = await llmExtract(chunks, processType, doc.id);
    suggestions = [...suggestions, ...llmEdges];
  } catch (err) {
    console.warn(`[graph-rag] LLM extract skipped for ${documentId}:`, err.message);
  }

  suggestions = await filterValidRefs(suggestions, processType);
  if (!suggestions.length) return { created: 0 };

  let created = 0;
  for (const row of suggestions) {
    const [, wasCreated] = await GraphEdgeSuggestion.findOrCreate({
      where: {
        process_type: row.process_type,
        edge_type: row.edge_type,
        from_ref: row.from_ref,
        to_ref: row.to_ref,
        status: 'pending',
      },
      defaults: { ...row, status: 'pending' },
    });
    if (wasCreated) created += 1;
  }

  if (created > 0) {
    await logAudit({
      userId: null,
      action: 'graph_suggestions_extracted',
      entityType: 'knowledge_document',
      entityId: doc.id,
      details: { created, process_type: processType },
    });
  }

  return { created };
}

async function listSuggestions({ status = 'pending', process_type } = {}) {
  const where = { status };
  if (process_type) where.process_type = process_type;

  return GraphEdgeSuggestion.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [
      {
        association: 'document',
        attributes: ['id', 'title', 'filename', 'process_type'],
      },
    ],
  });
}

async function approveSuggestion(id, userId) {
  const suggestion = await GraphEdgeSuggestion.findByPk(id);
  if (!suggestion || suggestion.status !== 'pending') {
    const err = new Error('Suggestion not found or already reviewed');
    err.statusCode = 404;
    throw err;
  }

  let edge = null;
  try {
    edge = await graphService.createEdge(
      {
        process_type: suggestion.process_type,
        edge_type: suggestion.edge_type,
        from_kind: suggestion.from_kind,
        from_ref: suggestion.from_ref,
        to_kind: suggestion.to_kind,
        to_ref: suggestion.to_ref,
        metadata: {
          ...suggestion.metadata,
          from_suggestion_id: suggestion.id,
          document_id: suggestion.document_id,
        },
      },
      userId
    );
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
  }

  await suggestion.update({
    status: 'approved',
    reviewed_by: userId,
    reviewed_at: new Date(),
  });

  await logAudit({
    userId,
    action: 'graph_suggestion_approved',
    entityType: 'graph_edge_suggestion',
    entityId: suggestion.id,
    details: { edge_id: edge.id },
  });

  return { suggestion, edge };
}

async function rejectSuggestion(id, userId) {
  const suggestion = await GraphEdgeSuggestion.findByPk(id);
  if (!suggestion || suggestion.status !== 'pending') {
    const err = new Error('Suggestion not found or already reviewed');
    err.statusCode = 404;
    throw err;
  }

  await suggestion.update({
    status: 'rejected',
    reviewed_by: userId,
    reviewed_at: new Date(),
  });

  await logAudit({
    userId,
    action: 'graph_suggestion_rejected',
    entityType: 'graph_edge_suggestion',
    entityId: suggestion.id,
    details: {},
  });

  return suggestion;
}

module.exports = {
  extractFromDocument,
  listSuggestions,
  approveSuggestion,
  rejectSuggestion,
};
