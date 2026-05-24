'use strict';

const { retrieve } = require('./retrievalService');
const { applyRules, getMandatoryStepTypes } = require('./ruleEngineService');
const { interpretPrompt } = require('./llmService');
const { getLlmProvider } = require('../config');

const DEFAULT_XSTEP_BY_TYPE = {
  LINE_CLEARANCE: 'XSTEP_PACK_LINE_CLEARANCE',
  MATERIAL_IDENTIFICATION: 'XSTEP_PACK_MATERIAL_ID',
  IPC_CHECK: 'XSTEP_PACK_IPC_CHECK',
  GOODS_MOVEMENT: 'XSTEP_PACK_GOODS_MOVEMENT',
  DOCUMENTATION: 'XSTEP_PACK_DOCUMENTATION',
  PROCESS: 'XSTEP_PACK_BLISTER_FORM',
};

function inferContext(prompt = '', overrides = {}) {
  const lower = String(prompt).toLowerCase();
  return {
    processArea:
      overrides.processArea ||
      (lower.includes('packaging') || lower.includes('verpackung') ? 'Packaging' : 'General'),
    packagingType:
      overrides.packagingType || (lower.includes('blister') ? 'Blister' : overrides.packagingType || ''),
  };
}

function buildStepFromXStep(xstep, sequence, ruleIds = []) {
  return {
    sequence,
    stepType: xstep.stepType,
    name: xstep.name,
    recommendedXStep: xstep.id,
    gmpRelevant: Boolean(xstep.gmpRelevant),
    requiresSignature: Boolean(xstep.requiresSignature),
    source: 'retrieval-xstep',
    ruleIds,
  };
}

function buildFallbackStep(stepType, sequence, xstepsByType) {
  const match = xstepsByType.get(stepType);
  if (match) return buildStepFromXStep(match, sequence, ['RULE_PACKAGING_MANDATORY']);
  return {
    sequence,
    stepType,
    name: stepType.replace(/_/g, ' '),
    recommendedXStep: DEFAULT_XSTEP_BY_TYPE[stepType] || `XSTEP_${stepType}`,
    gmpRelevant: stepType !== 'PROCESS',
    requiresSignature: ['LINE_CLEARANCE', 'MATERIAL_IDENTIFICATION', 'IPC_CHECK', 'DOCUMENTATION'].includes(
      stepType
    ),
    source: 'rule-engine-fallback',
    ruleIds: ['RULE_PACKAGING_MANDATORY'],
  };
}

/**
 * Compose a structured PI Sheet template proposal (JSON only, no SAP export).
 * @param {{ prompt: string, processArea?: string, packagingType?: string }} input
 */
async function composeTemplate(input = {}) {
  const prompt = input.prompt || '';
  if (!prompt.trim()) {
    throw new Error('prompt is required');
  }

  const llm = await interpretPrompt(prompt);
  const context = inferContext(prompt, {
    processArea: input.processArea || llm.processArea,
    packagingType: input.packagingType || llm.packagingType,
  });

  const retrieval = await retrieve({
    query: prompt,
    processArea: context.processArea,
    packagingType: context.packagingType,
    topK: 15,
  });

  const xstepResults = retrieval.results.filter((r) => r.type === 'xstep').map((r) => r.data);
  const knowledgeResults = retrieval.results
    .filter((r) => r.type === 'knowledge' || r.type === 'sop')
    .map((r) => r.data);
  const xstepsByType = new Map(xstepResults.map((x) => [x.stepType, x]));

  const mandatoryTypes = getMandatoryStepTypes(context);
  const steps = [];
  let sequence = 10;

  for (const stepType of mandatoryTypes) {
    steps.push(buildFallbackStep(stepType, sequence, xstepsByType));
    sequence += 10;
  }

  for (const xstep of xstepResults) {
    if (steps.some((s) => s.recommendedXStep === xstep.id)) continue;
    steps.push(buildStepFromXStep(xstep, sequence));
    sequence += 10;
  }

  // Re-order steps using process graph chain if available
  const graphChain = retrieval.graphContext?.chain || [];
  if (graphChain.length > 0) {
    const chainIndex = new Map(graphChain.map((id, i) => [id, i]));
    steps.sort((a, b) => {
      const ia = chainIndex.has(a.recommendedXStep) ? chainIndex.get(a.recommendedXStep) : 9999;
      const ib = chainIndex.has(b.recommendedXStep) ? chainIndex.get(b.recommendedXStep) : 9999;
      return ia - ib || a.sequence - b.sequence;
    });
    steps.forEach((s, i) => { s.sequence = (i + 1) * 10; });
  } else {
    steps.sort((a, b) => a.sequence - b.sequence);
  }

  let template = {
    templateType: 'PI_SHEET',
    processArea: context.processArea,
    packagingType: context.packagingType || undefined,
    prompt,
    steps,
    validationStatus: 'DRAFT_REQUIRES_REVIEW',
    validationIssues: [],
    retrievalSummary: {
      topK: retrieval.topK,
      resultCount: retrieval.results.length,
      mode: retrieval.mode,
      counts: retrieval.counts,
      knowledgeHits: knowledgeResults.length,
      knowledgeTitles: knowledgeResults.slice(0, 5).map((k) => k.title || k.id),
      graphChainUsed: graphChain.length > 0,
      graphChainLength: graphChain.length,
      piSheetExamples: retrieval.counts?.piSheetExamples || 0,
    },
    audit: {
      generatedAt: new Date().toISOString(),
      provider: getLlmProvider(),
      mode: 'mock-composer',
      llmSummary: llm.summary || llm.raw || null,
      noSapWriteBack: true,
      humanApprovalRequired: true,
    },
  };

  template = applyRules(template, context);
  return template;
}

function validateTemplate(template) {
  if (!template || typeof template !== 'object') {
    throw new Error('template object is required');
  }
  const context = {
    processArea: template.processArea,
    packagingType: template.packagingType,
  };
  return applyRules(
    {
      ...template,
      validationStatus: 'DRAFT_REQUIRES_REVIEW',
    },
    context
  );
}

module.exports = {
  composeTemplate,
  validateTemplate,
  inferContext,
  DEFAULT_XSTEP_BY_TYPE,
};
