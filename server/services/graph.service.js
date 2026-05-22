const { Op } = require('sequelize');
const { ProcessGraphEdge, XStep, EquipmentConfig } = require('../models');
const { logAudit } = require('./audit.service');

const EDGE_TYPES = ['FOLLOWS', 'USES_EQUIPMENT', 'REQUIRES', 'APPLIES_TO', 'MAPS_TO_SAP'];
const REF_KINDS = ['xstep', 'equipment', 'process_type', 'gmp_rule', 'sap'];

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

function sapTargetRef(xstep) {
  const tx = (xstep.sap_transaction || '').trim();
  if (!tx) return null;
  const mv = (xstep.movement_type || '').trim();
  return mv ? `${tx}:${mv}` : tx;
}

/**
 * Create MAPS_TO_SAP edges from active XSteps with sap_transaction.
 */
async function syncSapFromXSteps(processType, userId) {
  const where = {
    is_active: true,
    sap_transaction: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
  };
  if (processType) where.process_type = processType;

  const xsteps = await XStep.findAll({
    where,
    attributes: ['xstep_id', 'process_type', 'sap_transaction', 'movement_type', 'name'],
  });

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const xs of xsteps) {
    const target = sapTargetRef(xs);
    if (!target) {
      skipped += 1;
      continue;
    }
    try {
      const [, wasCreated] = await ProcessGraphEdge.findOrCreate({
        where: {
          process_type: xs.process_type,
          edge_type: 'MAPS_TO_SAP',
          from_ref: xs.xstep_id,
          to_ref: target,
        },
        defaults: {
          process_type: xs.process_type,
          edge_type: 'MAPS_TO_SAP',
          from_kind: 'xstep',
          from_ref: xs.xstep_id,
          to_kind: 'sap',
          to_ref: target,
          metadata: {
            sap_transaction: xs.sap_transaction,
            movement_type: xs.movement_type || null,
            xstep_name: xs.name,
            source: 'xstep_sync',
          },
          created_by: userId,
        },
      });
      if (wasCreated) created += 1;
      else skipped += 1;
    } catch (err) {
      errors.push({ xstep_id: xs.xstep_id, message: err.message });
    }
  }

  await logAudit({
    userId,
    action: 'graph_sap_sync',
    entityType: 'process_graph',
    entityId: null,
    details: { process_type: processType || 'all', created, skipped, errors: errors.length },
  });

  return { created, skipped, total: xsteps.length, errors };
}

function mermaidSafeId(ref) {
  return String(ref).replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeMermaidLabel(text) {
  return String(text)
    .replace(/"/g, '#quot;')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function truncateLabel(text, max = 48) {
  const s = String(text).trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function xstepLookupMap(xsteps) {
  const map = new Map();
  for (const row of xsteps || []) {
    const plain = row?.toJSON ? row.toJSON() : row;
    if (plain?.xstep_id) map.set(plain.xstep_id, plain);
  }
  return map;
}

function equipmentLookupMap(equipment) {
  const map = new Map();
  for (const row of equipment || []) {
    const plain = row?.toJSON ? row.toJSON() : row;
    if (plain?.equipment_id) map.set(plain.equipment_id, plain);
  }
  return map;
}

function formatXStepNodeLabel(id, meta) {
  if (!meta?.name) return escapeMermaidLabel(id);
  const title = escapeMermaidLabel(truncateLabel(meta.name, 42));
  const parts = [id];
  if (meta.category) parts.push(meta.category);
  if (meta.sap_transaction) {
    const sap = meta.movement_type
      ? `${meta.sap_transaction}:${meta.movement_type}`
      : meta.sap_transaction;
    parts.push(`SAP ${sap}`);
  }
  if (meta.gmp_relevant) parts.push('GMP');
  return `${title}<br/>${escapeMermaidLabel(parts.join(' · '))}`;
}

function formatSapNodeLabel(toRef, edge, xstepsById) {
  const md = edge?.metadata || {};
  const tx = md.sap_transaction || String(toRef).split(':')[0];
  const mv = md.movement_type || String(toRef).split(':')[1];
  const fromMeta = xstepsById.get(edge?.from_ref);
  const title = escapeMermaidLabel(
    truncateLabel(md.xstep_name || fromMeta?.name || `SAP ${tx}`, 42)
  );
  const sub = [toRef];
  if (mv) sub.push(`Bewegungsart ${mv}`);
  return `${title}<br/>${escapeMermaidLabel(sub.join(' · '))}`;
}

function formatEquipmentNodeLabel(toRef, edge, equipmentById) {
  const eq = equipmentById.get(toRef);
  const title = escapeMermaidLabel(truncateLabel(eq?.name || toRef, 42));
  const parts = [toRef];
  if (eq?.equipment_type) parts.push(eq.equipment_type);
  if (eq?.location) parts.push(eq.location);
  const note = edge?.metadata?.note;
  if (note) parts.push(truncateLabel(note, 36));
  return `${title}<br/>${escapeMermaidLabel(parts.join(' · '))}`;
}

const MERMAID_CLASS_DEFS = [
  'classDef defaultNode fill:#ffffff,stroke:#334155,color:#0f172a,stroke-width:2px',
  'classDef sapNode fill:#dbeafe,stroke:#0070f2,color:#0c2340,stroke-width:2px',
  'classDef equipNode fill:#d1fae5,stroke:#059669,color:#064e3b,stroke-width:2px',
  'classDef gmpNode fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px',
];

const NODE_CLASS_PRIORITY = { defaultNode: 1, equipNode: 2, sapNode: 2, gmpNode: 3 };

function assignNodeClass(nodeClasses, nodeId, className) {
  const prev = nodeClasses.get(nodeId);
  if (!prev || NODE_CLASS_PRIORITY[className] > NODE_CLASS_PRIORITY[prev]) {
    nodeClasses.set(nodeId, className);
  }
}

function appendMermaidClasses(lines, nodeClasses) {
  lines.push(...MERMAID_CLASS_DEFS);
  const byClass = new Map();
  for (const [nodeId, className] of nodeClasses) {
    if (!byClass.has(className)) byClass.set(className, []);
    byClass.get(className).push(nodeId);
  }
  for (const [className, ids] of byClass) {
    lines.push(`  class ${[...new Set(ids)].join(',')} ${className}`);
  }
}

function buildMermaidDiagram(ctx) {
  const xstepsById = ctx.xstepsById instanceof Map ? ctx.xstepsById : xstepLookupMap(ctx.xsteps);
  const equipmentById =
    ctx.equipmentById instanceof Map ? ctx.equipmentById : equipmentLookupMap(ctx.equipment);

  const lines = ['flowchart LR'];
  const nodeClasses = new Map();
  const chain = ctx.chain || [];

  for (let i = 0; i < chain.length; i += 1) {
    const id = chain[i];
    const meta = xstepsById.get(id);
    const nodeId = mermaidSafeId(id);
    const label = formatXStepNodeLabel(id, meta);
    assignNodeClass(nodeClasses, nodeId, meta?.gmp_relevant ? 'gmpNode' : 'defaultNode');

    if (i < chain.length - 1) {
      const nextId = chain[i + 1];
      const nextMeta = xstepsById.get(nextId);
      const nextNodeId = mermaidSafeId(nextId);
      const nextLabel = formatXStepNodeLabel(nextId, nextMeta);
      assignNodeClass(nodeClasses, nextNodeId, nextMeta?.gmp_relevant ? 'gmpNode' : 'defaultNode');
      lines.push(`  ${nodeId}["${label}"] --> ${nextNodeId}["${nextLabel}"]`);
    } else if (chain.length === 1) {
      lines.push(`  ${nodeId}["${label}"]`);
    }
  }

  const sapEdges = (ctx.edges || []).filter((e) => e.edge_type === 'MAPS_TO_SAP');
  for (const e of sapEdges) {
    const from = mermaidSafeId(e.from_ref);
    const to = mermaidSafeId(e.to_ref);
    const sapLabel = formatSapNodeLabel(e.to_ref, e, xstepsById);
    assignNodeClass(nodeClasses, from, 'defaultNode');
    assignNodeClass(nodeClasses, to, 'sapNode');
    lines.push(`  ${from} -.->|SAP| ${to}["${sapLabel}"]`);
  }

  const equip = (ctx.edges || []).filter((e) => e.edge_type === 'USES_EQUIPMENT');
  for (const e of equip) {
    const from = mermaidSafeId(e.from_ref);
    const to = mermaidSafeId(e.to_ref);
    const equipLabel = formatEquipmentNodeLabel(e.to_ref, e, equipmentById);
    assignNodeClass(nodeClasses, from, 'defaultNode');
    assignNodeClass(nodeClasses, to, 'equipNode');
    lines.push(`  ${from} -->|Equipment| ${to}["${equipLabel}"]`);
  }

  if (nodeClasses.size) appendMermaidClasses(lines, nodeClasses);

  return lines.join('\n');
}

async function getExplorer(processType) {
  if (!processType) {
    const err = new Error('process_type required');
    err.statusCode = 400;
    throw err;
  }

  const ctx = await getProcessContext(processType);
  const plainEdges = ctx.edges.map((e) => (e.toJSON ? e.toJSON() : e));
  const groups = {};
  for (const type of EDGE_TYPES) {
    groups[type] = plainEdges.filter((e) => e.edge_type === type);
  }

  const xstepIds = new Set([
    ...ctx.chain,
    ...plainEdges.filter((e) => e.from_kind === 'xstep').map((e) => e.from_ref),
    ...plainEdges.filter((e) => e.to_kind === 'xstep').map((e) => e.to_ref),
  ]);
  const equipmentIds = new Set(
    plainEdges
      .filter((e) => e.to_kind === 'equipment')
      .map((e) => e.to_ref)
      .concat(plainEdges.filter((e) => e.from_kind === 'equipment').map((e) => e.from_ref))
  );

  const [xsteps, equipment] = await Promise.all([
    xstepIds.size
      ? XStep.findAll({
          where: { xstep_id: { [Op.in]: [...xstepIds] } },
          attributes: [
            'xstep_id',
            'name',
            'category',
            'sap_transaction',
            'movement_type',
            'gmp_relevant',
          ],
        })
      : [],
    equipmentIds.size
      ? EquipmentConfig.findAll({
          where: { equipment_id: { [Op.in]: [...equipmentIds] } },
          attributes: ['equipment_id', 'name', 'equipment_type', 'location'],
        })
      : [],
  ]);

  const xstepsById = xstepLookupMap(xsteps);
  const equipmentById = equipmentLookupMap(equipment);

  return {
    processType,
    chain: ctx.chain,
    groups,
    nodes: {
      xsteps: xsteps.map((x) => ({
        id: x.xstep_id,
        name: x.name,
        category: x.category,
        sap_transaction: x.sap_transaction,
        movement_type: x.movement_type,
        gmp_relevant: x.gmp_relevant,
      })),
      equipment: equipment.map((e) => ({
        id: e.equipment_id,
        name: e.name,
        equipment_type: e.equipment_type,
        location: e.location,
      })),
    },
    mermaid: buildMermaidDiagram({
      ...ctx,
      edges: plainEdges,
      xstepsById,
      equipmentById,
    }),
    stats: {
      totalEdges: plainEdges.length,
      byType: Object.fromEntries(
        EDGE_TYPES.map((t) => [t, (groups[t] || []).length])
      ),
    },
  };
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
  syncSapFromXSteps,
  getExplorer,
  buildMermaidDiagram,
};
