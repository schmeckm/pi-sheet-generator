'use strict';

const { importXSteps } = require('../../../services/import.service');
const { loadGraphFromCanonical } = require('./graphLoader');

/**
 * Map normalised agent XStep → PostgreSQL import row.
 */
function toDbRow(step, processType) {
  return {
    xstep_id: step.id,
    name: step.name,
    category: step.category || 'Prozess',
    process_type: step.processArea || processType || 'Import',
    description: step.description || '',
    instruction_template: step.instruction || '',
    params: (step.parameters || []).map((p) => ({
      name: p.name,
      value: p.value,
      unit: p.unit || '',
    })),
    tags: [...(step.keywords || [])],
    gmp_relevant: Boolean(step.gmpRelevant),
    signature_required: Boolean(step.requiresSignature),
    sort_order: step.sort_order || 0,
    is_active: true,
  };
}

/**
 * Persist normalised steps to PostgreSQL and optional graph to process_graph_edges.
 */
async function persistToDatabase({ steps, graph, processType, userId }) {
  const dbRows = steps.map((s) => toDbRow(s, processType));
  const dbReport = await importXSteps(dbRows, userId);

  let graphReport = null;
  if (graph?.edges?.length) {
    graphReport = await loadGraphFromCanonical(graph, { processType, userId });
  }

  return { db: dbReport, graph: graphReport };
}

module.exports = { persistToDatabase, toDbRow };
