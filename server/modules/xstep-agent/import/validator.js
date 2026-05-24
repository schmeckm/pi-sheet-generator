'use strict';

/**
 * Validate a single normalised XStep and collect non-fatal warnings.
 * Returns { valid: boolean, warnings: string[] }.
 */
function validateXStep(step, index) {
  const warnings = [];
  const prefix = `step[${index}] (${step.id})`;

  if (!step.id || step.id.startsWith('XSTEP_IMPORT_')) {
    warnings.push(`${prefix}: missing or auto-generated id`);
  }

  if (!step.name || step.name.startsWith('Imported Step')) {
    warnings.push(`${prefix}: missing or auto-generated name`);
  }

  if (step.stepType === 'PROCESS' && !step.processArea) {
    warnings.push(`${prefix}: generic PROCESS step without processArea`);
  }

  if (step.gmpRelevant && !step.requiresSignature) {
    warnings.push(`${prefix}: GMP-relevant but requiresSignature is false — verify intent`);
  }

  if (step.requiresSignature && !step.gmpRelevant) {
    warnings.push(`${prefix}: signature required on non-GMP step — unusual`);
  }

  if (!step.processArea) {
    warnings.push(`${prefix}: processArea is empty`);
  }

  if (step.keywords.length === 0) {
    warnings.push(`${prefix}: no keywords — retrieval quality may suffer`);
  }

  if (step.parameters.length > 0) {
    step.parameters.forEach((p, pi) => {
      if (!p.name || p.name === 'param') {
        warnings.push(`${prefix}: parameter[${pi}] has no name`);
      }
    });
  }

  return { valid: true, warnings };
}

/**
 * Validate a batch of normalised XSteps.
 * Returns aggregate result with per-step and global warnings.
 */
function validateBatch(steps) {
  const perStep = steps.map((s, i) => ({ step: s.id, ...validateXStep(s, i) }));

  const globalWarnings = [];

  const ids = steps.map((s) => s.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    globalWarnings.push(`Duplicate ids detected: ${[...new Set(dupes)].join(', ')}`);
  }

  if (steps.length === 0) {
    globalWarnings.push('Import contains zero steps');
  }

  const allWarnings = [
    ...globalWarnings,
    ...perStep.flatMap((r) => r.warnings),
  ];

  return {
    valid: steps.length > 0,
    stepCount: steps.length,
    warningCount: allWarnings.length,
    warnings: allWarnings,
    details: perStep,
  };
}

module.exports = { validateXStep, validateBatch };
