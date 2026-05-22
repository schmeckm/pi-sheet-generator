const { Op } = require('sequelize');
const { ProcessGraphEdge, XStep } = require('../models');
const { logAudit } = require('./audit.service');

const EDGE_TYPES = ['FOLLOWS', 'USES_EQUIPMENT', 'REQUIRES', 'APPLIES_TO', 'MAPS_TO_SAP'];
const REF_KINDS = ['xstep', 'equipment', 'process_type', 'gmp_rule'];

function buildChain(followEdges) {
  if (!followEdges.length) return [];
  const toRefs = new Set(followEdges.map((e) => e.to_ref));
  let current = followEdges.find((e) => !toRefs.has(e.from_ref))?.from_ref;
  if (!current) current = followEdges[0].from_ref;

  const byFrom = new Map(followEdges.map((e) => [e.from_ref, e]));
  const chain = [];
  const seen = new Set();

  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = byFrom.get(current)?.to_ref;
  }
  return chain;
}

async function listEdges(filters = {}) {
  const where = {};
  if (filters.process_type) where.process_type = filters.process_type;
  if (filters.edge_type) where.edge_type = filters.edge_type;

  return ProcessGraphEdge.findAll({
    where,
    order: [
      ['process_type', 'ASC'],
      ['edge_type', 'ASC'],
      ['sort_order', 'ASC'],
      ['created_at', 'ASC'],
    ],
  });
}

async function getProcessContext(processType) {
  if (!processType) {
    return { processType: null, chain: [], requirements: [], edges: [] };
  }

  const edges = await listEdges({ process_type: processType });
  const followEdges = edges.filter((e) => e.edge_type === 'FOLLOWS');
  const chain = buildChain(followEdges);

  const requirements = edges
    .filter((e) => e.edge_type !== 'FOLLOWS')
    .map((e) => ({
      edge_type: e.edge_type,
      from_kind: e.from_kind,
      from_ref: e.from_ref,
      to_kind: e.to_kind,
      to_ref: e.to_ref,
      metadata: e.metadata,
    }));

  return { processType, chain, requirements, edges };
}

async function mergeXStepsWithGraph(xsteps, processType) {
  const graphCtx = await getProcessContext(processType);
  if (!graphCtx.chain.length) return { xsteps, graphCtx };

  const chainRows = await XStep.findAll({
    where: { xstep_id: { [Op.in]: graphCtx.chain }, is_active: true },
  });
  const byId = new Map(chainRows.map((x) => [x.xstep_id, x]));
  const orderedChain = graphCtx.chain.map((id) => byId.get(id)).filter(Boolean);
  const chainIds = new Set(graphCtx.chain);
  const extra = (xsteps || []).filter((x) => !chainIds.has(x.xstep_id));
  const merged = [...orderedChain, ...extra].slice(0, 20);

  return { xsteps: merged, graphCtx };
}

async function createEdge(data, userId) {
  if (!EDGE_TYPES.includes(data.edge_type)) {
    const err = new Error(`Invalid edge_type. Allowed: ${EDGE_TYPES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  if (!REF_KINDS.includes(data.from_kind) || !REF_KINDS.includes(data.to_kind)) {
    const err = new Error(`Invalid ref kind. Allowed: ${REF_KINDS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const edge = await ProcessGraphEdge.create({
    process_type: data.process_type,
    edge_type: data.edge_type,
    from_kind: data.from_kind || 'xstep',
    from_ref: data.from_ref,
    to_kind: data.to_kind || 'xstep',
    to_ref: data.to_ref,
    sort_order: data.sort_order ?? null,
    metadata: data.metadata || {},
    created_by: userId,
  });

  await logAudit({
    userId,
    action: 'graph_edge_created',
    entityType: 'process_graph_edge',
    entityId: edge.id,
    details: {
      process_type: edge.process_type,
      edge_type: edge.edge_type,
      from_ref: edge.from_ref,
      to_ref: edge.to_ref,
    },
  });

  return edge;
}

async function deleteEdge(id, userId) {
  const edge = await ProcessGraphEdge.findByPk(id);
  if (!edge) return false;

  await edge.destroy();
  await logAudit({
    userId,
    action: 'graph_edge_deleted',
    entityType: 'process_graph_edge',
    entityId: id,
    details: {
      process_type: edge.process_type,
      edge_type: edge.edge_type,
      from_ref: edge.from_ref,
      to_ref: edge.to_ref,
    },
  });
  return true;
}

function formatGraphContext(graphCtx, locale = 'de') {
  if (!graphCtx?.chain?.length && !graphCtx?.requirements?.length) {
    return locale === 'en' ? 'No process graph defined for this process type.' : 'Kein Prozessgraph für diesen Prozesstyp definiert.';
  }
  return JSON.stringify(
    {
      process_type: graphCtx.processType,
      recommended_step_order: graphCtx.chain,
      requirements: graphCtx.requirements,
    },
    null,
    2
  );
}

/**
 * @param {Array<{ xstep_id?: string }>} steps
 * @param {string[]} chain
 * @param {string} [locale]
 */
function buildGraphOrderWarnings(steps, chain, locale = 'de') {
  if (!chain?.length || !steps?.length) return [];

  const warnings = [];
  const indices = steps
    .map((s) => (s.xstep_id ? chain.indexOf(s.xstep_id) : -1))
    .filter((i) => i >= 0);

  for (let i = 1; i < indices.length; i += 1) {
    if (indices[i] < indices[i - 1]) {
      warnings.push(
        locale === 'en'
          ? `Step order deviates from the process graph (${chain.join(' → ')}).`
          : `Schrittfolge weicht vom Prozessgraph ab (${chain.join(' → ')}).`
      );
      break;
    }
  }

  const unknown = steps
    .map((s) => s.xstep_id)
    .filter((id) => id && !chain.includes(id));
  if (unknown.length) {
    warnings.push(
      locale === 'en'
        ? `XSteps outside the standard chain: ${unknown.join(', ')}`
        : `XSteps außerhalb der Standardkette: ${unknown.join(', ')}`
    );
  }

  return warnings;
}

async function warningsForPiSheet(parsed, locale = 'de') {
  const base = Array.isArray(parsed.warnings) ? [...parsed.warnings] : [];
  const processType = parsed.process_type;
  if (!processType) return base;

  const { chain } = await getProcessContext(processType);
  const graphWarnings = buildGraphOrderWarnings(parsed.steps || [], chain, locale);
  return [...new Set([...base, ...graphWarnings])];
}

module.exports = {
  EDGE_TYPES,
  REF_KINDS,
  listEdges,
  getProcessContext,
  mergeXStepsWithGraph,
  createEdge,
  deleteEdge,
  formatGraphContext,
  buildGraphOrderWarnings,
  warningsForPiSheet,
};
