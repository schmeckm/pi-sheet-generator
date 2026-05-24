'use strict';

const STEP_TYPE_ALIASES = {
  LINE_CLEARANCE: 'LINE_CLEARANCE',
  LINECLEARANCE: 'LINE_CLEARANCE',
  MATERIAL_IDENTIFICATION: 'MATERIAL_IDENTIFICATION',
  MATERIALID: 'MATERIAL_IDENTIFICATION',
  MATERIALIDENTIFICATION: 'MATERIAL_IDENTIFICATION',
  GOODS_MOVEMENT: 'GOODS_MOVEMENT',
  GOODSMOVEMENT: 'GOODS_MOVEMENT',
  IPC: 'IPC_CHECK',
  IPC_CHECK: 'IPC_CHECK',
  IPCCHECK: 'IPC_CHECK',
  DOCUMENTATION: 'DOCUMENTATION',
  PROCESS: 'PROCESS',
  PACKAGING: 'PACKAGING',
  WEIGHING: 'WEIGHING',
  SAMPLING: 'SAMPLING',
  LABELLING: 'LABELLING',
  ESIGNATURE: 'E_SIGNATURE',
  E_SIGNATURE: 'E_SIGNATURE',
};

function normalizeStepType(raw) {
  if (!raw) return 'PROCESS';
  const key = String(raw).toUpperCase().replace(/[\s-]+/g, '_');
  return STEP_TYPE_ALIASES[key] || key || 'PROCESS';
}

function normalizeKeywords(arr) {
  return (arr || [])
    .map((k) => String(k).trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Normalise a single raw parsed XStep into the canonical JSON shape
 * used throughout the xstep-agent module.
 *
 * @param {object} raw  raw parsed object from xmlParser
 * @param {number} seqBase  sequence base for fallback id generation
 * @returns {object}  canonical XStep JSON
 */
function normalizeXStep(raw, seqBase = 0) {
  const seq = (raw._index ?? seqBase) + 1;

  return {
    id: raw.id || `XSTEP_IMPORT_${seq}`,
    name: raw.name || `Imported Step ${seq}`,
    stepType: normalizeStepType(raw.stepType),
    processArea: raw.processArea || '',
    packagingType: raw.packagingType || '',
    category: raw.category || 'Prozess',
    gmpRelevant: Boolean(raw.gmpRelevant),
    requiresSignature: Boolean(raw.requiresSignature),
    keywords: normalizeKeywords(raw.keywords),
    parameters: (raw.parameters || []).map((p) => ({
      name: String(p.name || 'param').trim(),
      value: String(p.value ?? '').trim(),
      unit: String(p.unit || '').trim(),
    })),
    sourceFormat: 'xstep-xml-import',
  };
}

/**
 * Normalise an array of raw parsed XSteps.
 * @param {object[]} rawSteps
 * @returns {object[]}  canonical XStep JSON array
 */
function normalizeAll(rawSteps) {
  return rawSteps.map((r, i) => normalizeXStep(r, i));
}

module.exports = { normalizeXStep, normalizeAll, normalizeStepType };
