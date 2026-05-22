const graphService = require('./graph.service');

const GRAPH_TOOL_DEFINITIONS = [
  {
    name: 'get_process_chain',
    description:
      'Returns the recommended XStep sequence (FOLLOWS edges) and equipment/requirement links for a manufacturing process type from the process knowledge graph.',
    input_schema: {
      type: 'object',
      properties: {
        process_type: {
          type: 'string',
          description: "Process type, e.g. 'Verpackung', 'Abfüllung', 'Granulation'",
        },
      },
      required: ['process_type'],
    },
  },
  {
    name: 'get_step_requirements',
    description:
      'Returns graph requirements for one XStep (e.g. USES_EQUIPMENT) within a process type.',
    input_schema: {
      type: 'object',
      properties: {
        process_type: { type: 'string' },
        xstep_id: { type: 'string', description: "XStep ID, e.g. 'XS-VP-005'" },
      },
      required: ['process_type', 'xstep_id'],
    },
  },
];

const GRAPH_TOOL_NAMES = new Set(GRAPH_TOOL_DEFINITIONS.map((t) => t.name));

async function executeGraphTool(name, input = {}) {
  switch (name) {
    case 'get_process_chain': {
      const processType = String(input.process_type || '').trim();
      if (!processType) return { error: 'process_type is required' };
      const ctx = await graphService.getProcessContext(processType);
      return {
        process_type: ctx.processType,
        recommended_step_order: ctx.chain,
        requirements: ctx.requirements,
        edge_count: ctx.edges?.length ?? 0,
      };
    }
    case 'get_step_requirements': {
      const processType = String(input.process_type || '').trim();
      const xstepId = String(input.xstep_id || '').trim();
      if (!processType || !xstepId) {
        return { error: 'process_type and xstep_id are required' };
      }
      const ctx = await graphService.getProcessContext(processType);
      const related = ctx.requirements.filter(
        (r) => r.from_ref === xstepId || r.to_ref === xstepId
      );
      const position = ctx.chain.indexOf(xstepId);
      return {
        process_type: processType,
        xstep_id: xstepId,
        position_in_chain: position >= 0 ? position + 1 : null,
        total_steps_in_chain: ctx.chain.length,
        requirements: related,
      };
    }
    default:
      return { error: `Unknown graph tool: ${name}` };
  }
}

async function executeGraphToolSafe(name, input = {}) {
  try {
    return await executeGraphTool(name, input);
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = {
  GRAPH_TOOL_DEFINITIONS,
  GRAPH_TOOL_NAMES,
  executeGraphTool,
  executeGraphToolSafe,
};
