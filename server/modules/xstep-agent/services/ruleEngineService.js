'use strict';

const RULES = [
  {
    id: 'RULE_PACKAGING_MANDATORY',
    description: 'Packaging templates must include core packaging control steps',
    applies: (ctx) => ctx.processArea === 'Packaging',
    check: (steps) => {
      const types = new Set(steps.map((s) => s.stepType));
      const required = ['LINE_CLEARANCE', 'MATERIAL_IDENTIFICATION', 'IPC_CHECK', 'GOODS_MOVEMENT'];
      const missing = required.filter((t) => !types.has(t));
      if (missing.length) {
        return {
          passed: false,
          severity: 'error',
          message: `Missing mandatory packaging step types: ${missing.join(', ')}`,
        };
      }
      return { passed: true };
    },
  },
  {
    id: 'RULE_MATERIAL_IDENTIFICATION',
    description: 'Material identification step is required',
    applies: () => true,
    check: (steps) => {
      const found = steps.some((s) => s.stepType === 'MATERIAL_IDENTIFICATION');
      return found
        ? { passed: true }
        : {
            passed: false,
            severity: 'error',
            message: 'Material identification step is required',
          };
    },
  },
  {
    id: 'RULE_LINE_CLEARANCE',
    description: 'Line clearance step is required for packaging',
    applies: (ctx) => ctx.processArea === 'Packaging',
    check: (steps) => {
      const found = steps.some((s) => s.stepType === 'LINE_CLEARANCE');
      return found
        ? { passed: true }
        : {
            passed: false,
            severity: 'error',
            message: 'Line clearance step is required',
          };
    },
  },
  {
    id: 'RULE_GOODS_MOVEMENT',
    description: 'Goods movement step is required',
    applies: (ctx) => ctx.processArea === 'Packaging',
    check: (steps) => {
      const found = steps.some((s) => s.stepType === 'GOODS_MOVEMENT');
      return found
        ? { passed: true }
        : {
            passed: false,
            severity: 'error',
            message: 'Goods movement step is required',
          };
    },
  },
  {
    id: 'RULE_ESIGNATURE_GMP',
    description: 'GMP-relevant steps require electronic signature',
    applies: () => true,
    check: (steps) => {
      const violations = steps.filter((s) => s.gmpRelevant && !s.requiresSignature);
      if (violations.length) {
        return {
          passed: false,
          severity: 'warning',
          message: `GMP steps without signature flag: ${violations.map((v) => v.recommendedXStep).join(', ')}`,
        };
      }
      return { passed: true };
    },
  },
];

function applyRules(template, context = {}) {
  const issues = [];
  const appliedRuleIds = [];

  for (const rule of RULES) {
    if (!rule.applies(context)) continue;
    appliedRuleIds.push(rule.id);
    const result = rule.check(template.steps || [], context);
    if (!result.passed) {
      issues.push({
        ruleId: rule.id,
        severity: result.severity || 'error',
        message: result.message,
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  let validationStatus = 'VALID';
  if (hasErrors) validationStatus = 'INVALID';
  else if (issues.length) validationStatus = 'DRAFT_REQUIRES_REVIEW';
  else if (template.validationStatus === 'DRAFT_REQUIRES_REVIEW') {
    validationStatus = 'DRAFT_REQUIRES_REVIEW';
  }

  return {
    ...template,
    validationStatus,
    validationIssues: issues,
    audit: {
      ...(template.audit || {}),
      rulesApplied: appliedRuleIds,
      validatedAt: new Date().toISOString(),
    },
  };
}

function getMandatoryStepTypes(context = {}) {
  if (context.processArea !== 'Packaging') return [];
  return ['LINE_CLEARANCE', 'MATERIAL_IDENTIFICATION', 'IPC_CHECK', 'GOODS_MOVEMENT', 'DOCUMENTATION'];
}

module.exports = {
  RULES,
  applyRules,
  getMandatoryStepTypes,
};
