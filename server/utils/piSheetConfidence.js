const { XStep } = require('../models');

function clamp01(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value > 1 && value <= 100) return Math.min(1, value / 100);
  return Math.max(0, Math.min(1, value));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Score each PI sheet step (0–1) from repository match + optional LLM self-assessment.
 */
async function enrichPiSheetConfidence(parsed, { contextXstepIds = [] } = {}) {
  if (!parsed?.steps?.length) return parsed;

  const contextSet = new Set(contextXstepIds.filter(Boolean));
  const stepXstepIds = parsed.steps.map((s) => s.xstep_id).filter(Boolean);
  const dbRows = stepXstepIds.length
    ? await XStep.findAll({
        where: { xstep_id: stepXstepIds },
        attributes: ['xstep_id'],
      })
    : [];
  const verifiedSet = new Set(dbRows.map((r) => r.xstep_id));

  const enrichedSteps = parsed.steps.map((step) => {
    const llmConf = clamp01(step.confidence);
    let heuristic = 0.55;
    let confidence_source = 'ai_estimated';

    const xid = step.xstep_id;
    if (xid && verifiedSet.has(xid) && !step.is_suggestion) {
      heuristic = 0.92;
      confidence_source = 'repository_verified';
    } else if (xid && verifiedSet.has(xid) && step.is_suggestion) {
      heuristic = 0.78;
      confidence_source = 'repository_adapted';
    } else if (xid && contextSet.has(xid)) {
      heuristic = 0.72;
      confidence_source = 'context_match';
    } else if (step.is_suggestion) {
      heuristic = 0.42;
      confidence_source = 'ai_suggestion';
    } else if (xid && /^NEW-/i.test(xid)) {
      heuristic = 0.38;
      confidence_source = 'new_step';
    }

    const confidence =
      llmConf != null ? round2(0.35 * llmConf + 0.65 * heuristic) : round2(heuristic);

    return { ...step, confidence, confidence_source };
  });

  const stepScores = enrichedSteps.map((s) => s.confidence);
  let overall = stepScores.reduce((a, b) => a + b, 0) / stepScores.length;
  const warningPenalty = Math.min(0.25, (parsed.warnings?.length || 0) * 0.05);
  overall = Math.max(0, overall - warningPenalty);

  const llmOverall = clamp01(parsed.confidence);
  if (llmOverall != null) {
    overall = round2(0.4 * llmOverall + 0.6 * overall);
  } else {
    overall = round2(overall);
  }

  return {
    ...parsed,
    confidence: overall,
    confidence_percent: Math.round(overall * 100),
    confidence_breakdown: {
      repository_steps: enrichedSteps.filter((s) => s.confidence_source === 'repository_verified')
        .length,
      adapted_steps: enrichedSteps.filter((s) => s.confidence_source === 'repository_adapted').length,
      suggestion_steps: enrichedSteps.filter((s) => s.is_suggestion).length,
      warning_count: parsed.warnings?.length || 0,
      step_count: enrichedSteps.length,
    },
    steps: enrichedSteps,
  };
}

module.exports = { enrichPiSheetConfidence, clamp01 };
