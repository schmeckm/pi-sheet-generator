'use strict';

const { ProcessGraphEdge } = require('../../../models');

const SAP_EDGE_TYPES = new Set(['CONTAINS', 'HAS_VERSION', 'REFERENCES_SOP', 'FOLLOWS']);

function mapNodeKind(label) {
  switch (label) {
    case 'Folder':
      return 'sap';
    case 'Version':
      return 'sap';
    case 'SOP':
      return 'gmp_rule';
    case 'XStepTemplate':
    case 'XStep':
      return 'xstep';
    default:
      return 'sap';
  }
}

/**
 * Persist canonical graph edges to process_graph_edges (idempotent).
 * @param {object} graphPayload  { metadata, nodes, edges }
 * @param {{ processType: string, userId?: string }} opts
 */
async function loadGraphFromCanonical(graphPayload, opts) {
  if (!graphPayload?.edges?.length) {
    return { created: 0, updated: 0, skipped: 0, edges: 0 };
  }

  const processType = opts.processType || graphPayload.metadata?.processType || 'Import';
  const userId = opts.userId || null;
  const nodeById = new Map((graphPayload.nodes || []).map((n) => [n.id, n]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const edge of graphPayload.edges) {
    if (!SAP_EDGE_TYPES.has(edge.type) && edge.type !== 'FOLLOWS') {
      skipped += 1;
      continue;
    }

    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (!fromNode || !toNode) {
      skipped += 1;
      continue;
    }

    try {
      const [, wasCreated] = await ProcessGraphEdge.findOrCreate({
        where: {
          process_type: processType,
          edge_type: edge.type,
          from_ref: edge.from,
          to_ref: edge.to,
        },
        defaults: {
          from_kind: mapNodeKind(fromNode.label),
          to_kind: mapNodeKind(toNode.label),
          sort_order: null,
          metadata: {
            sap_import: true,
            from_label: fromNode.label,
            to_label: toNode.label,
            doc_id: graphPayload.metadata?.docId,
          },
          created_by: userId,
        },
      });

      if (wasCreated) created += 1;
      else updated += 1;
    } catch {
      skipped += 1;
    }
  }

  await createFollowsChain(graphPayload, processType, userId);

  return {
    created,
    updated,
    skipped,
    edges: graphPayload.edges.length,
    processType,
  };
}

/**
 * FOLLOWS-Kette aus aufeinanderfolgenden XStep/XStepTemplate-Knoten (Traversierungsreihenfolge).
 */
async function createFollowsChain(graphPayload, processType, userId) {
  const stepNodes = (graphPayload.nodes || []).filter((n) =>
    ['XStep', 'XStepTemplate'].includes(n.label)
  );
  if (stepNodes.length < 2) return;

  for (let i = 0; i < stepNodes.length - 1; i += 1) {
    const from = stepNodes[i].id;
    const to = stepNodes[i + 1].id;
    await ProcessGraphEdge.findOrCreate({
      where: {
        process_type: processType,
        edge_type: 'FOLLOWS',
        from_ref: from,
        to_ref: to,
      },
      defaults: {
        from_kind: 'xstep',
        to_kind: 'xstep',
        sort_order: i + 1,
        metadata: { sap_import: true, auto_chain: true },
        created_by: userId,
      },
    });
  }
}

module.exports = { loadGraphFromCanonical, mapNodeKind };
