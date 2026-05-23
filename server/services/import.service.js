const crypto = require('crypto');
const { XStep } = require('../models');
const { logAudit } = require('./audit.service');
const embeddingService = require('./embedding.service');
const { CATEGORIES } = require('./repository.service');
const parsers = require('./import-parsers');

const REQUIRED_FIELDS = ['xstep_id', 'name', 'category', 'process_type'];

const COLUMN_ALIASES = {
  xstep_id: ['xstep_id', 'xstepid', 'step_id', 'stepid', 'id', 'vornr', 'operation', 'schritt_nr', 'xstep id', 'xstep-id'],
  name: ['name', 'bezeichnung', 'kurztext', 'ltxa1', 'titel', 'title', 'step_name'],
  category: ['category', 'kategorie', 'cat', 'type', 'typ', 'step_type'],
  process_type: ['process_type', 'processtype', 'prozesstyp', 'prozess', 'process', 'bereich'],
  description: ['description', 'beschreibung', 'desc', 'langtext', 'details'],
  instruction_template: ['instruction_template', 'instruction', 'anweisung', 'arbeitsanweisung'],
  sap_transaction: ['sap_transaction', 'transaction', 'tcode', 'transaktion'],
  movement_type: ['movement_type', 'bewegungsart', 'bwart'],
  sap_system: ['sap_system', 'system', 'lager_system', 'warehouse_system', 'ewm_mm', 'pfad', 'path'],
  tags: ['tags', 'labels', 'schlagworte', 'merkmale'],
  gmp_relevant: ['gmp_relevant', 'gmp', 'gxp', 'gmp-relevant'],
  signature_required: ['signature_required', 'signatur', 'unterschrift', 'signature'],
};

const SAP_SYSTEM_ALIASES = {
  ewm: 'ewm',
  'sap-ewm': 'ewm',
  'sap_ewm': 'ewm',
  handling_unit: 'ewm',
  'handling-unit': 'ewm',
  hu: 'ewm',
  scwm: 'ewm',
  mm: 'mm',
  'sap-mm': 'mm',
  'sap_mm': 'mm',
  migo: 'mm',
  wm: 'mm',
  none: 'none',
  neutral: 'none',
  confirmation: 'none',
  rückmeldung: 'none',
  ruckmeldung: 'none',
};

function normalizeSapSystem(val) {
  if (val === undefined || val === null || val === '') return null;
  const key = String(val).trim().toLowerCase();
  return SAP_SYSTEM_ALIASES[key] || (['ewm', 'mm', 'none'].includes(key) ? key : null);
}

function normalizeTags(val) {
  if (val === undefined || val === null || val === '') return [];
  if (Array.isArray(val)) {
    return val
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
  }
  return String(val)
    .split(/[,;|]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

const importSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

function parseBool(val) {
  if (val === undefined || val === null || val === '') return false;
  return val === true || val === 'true' || val === '1' || val === 'yes' || val === 'ja';
}

function normalizeColumnKey(col) {
  return String(col).toLowerCase().trim().replace(/\s+/g, '_');
}

function autoMapColumns(columns) {
  const mapping = {};
  for (const col of columns) {
    const norm = normalizeColumnKey(col);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some((a) => a === norm || normalizeColumnKey(a) === norm)) {
        mapping[col] = field;
        break;
      }
    }
  }
  return mapping;
}

function getUnmappedRequired(mapping) {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return REQUIRED_FIELDS.filter((f) => !mapped.has(f));
}

function mapRow(row, mapping) {
  const out = {};
  for (const [src, field] of Object.entries(mapping || {})) {
    if (!field || field === '_ignore') continue;
    if (row[src] !== undefined && row[src] !== '') out[field] = row[src];
  }
  if (!mapping || !Object.keys(mapping).length) return { ...row };
  return out;
}

function mergeInstructions(xsteps, instructions) {
  if (!instructions?.length) return xsteps;
  const byId = new Map(instructions.map((r) => [String(r.xstep_id || r.step_id || r.id), r]));
  return xsteps.map((row) => {
    const id = row.xstep_id || row.step_id;
    const instr = byId.get(String(id));
    if (instr) {
      return {
        ...row,
        instruction_template:
          instr.instruction_template || instr.instruction || instr.text || instr.anweisung || row.instruction_template,
      };
    }
    return row;
  });
}

function normalizeXStepData(raw) {
  const data = { ...raw };
  if (data.category) data.category = parsers.normalizeCategory(data.category);
  if (typeof data.params === 'string') {
    try {
      data.params = JSON.parse(data.params);
    } catch {
      data.params = [];
    }
  }
  if (!Array.isArray(data.params)) data.params = [];
  data.tags = normalizeTags(data.tags);
  data.sap_system = normalizeSapSystem(data.sap_system);
  data.gmp_relevant = parseBool(data.gmp_relevant);
  data.signature_required = parseBool(data.signature_required);
  if (data.is_active !== undefined) data.is_active = parseBool(data.is_active);
  else data.is_active = true;
  if (data.sort_order) data.sort_order = Number(data.sort_order) || 0;
  if (data.xstep_id) data.xstep_id = String(data.xstep_id).trim();
  return data;
}

function createSession(payload) {
  const id = crypto.randomUUID();
  importSessions.set(id, { ...payload, createdAt: Date.now() });
  setTimeout(() => importSessions.delete(id), SESSION_TTL_MS);
  return id;
}

function getSession(sessionId) {
  const s = importSessions.get(sessionId);
  if (!s) throw new Error('Import session expired — please upload the file again');
  return s;
}

async function previewImport(file, options = {}, fileRoles = {}) {
  const parsed = await parsers.parseFile(file.buffer, file.originalname, options, fileRoles);
  const rawRows = parsed.xsteps || [];
  const rows = mergeInstructions(rawRows, parsed.instructions);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const auto_mapping = autoMapColumns(columns);
  const sessionId = createSession({
    filename: file.originalname,
    format: parsers.detectFormat(file.originalname),
    rawRows: rows,
    metadata: parsed.metadata,
    files: parsed.files || null,
    options,
    fileRoles,
  });

  return {
    status: 'preview',
    session_id: sessionId,
    detected_format: parsers.detectFormat(file.originalname),
    detected_delimiter: parsed.metadata?.delimiter || null,
    columns,
    auto_mapping,
    unmapped_required: getUnmappedRequired(auto_mapping),
    preview_rows: rows.slice(0, 10),
    total_rows: rows.length,
    files: parsed.files || undefined,
  };
}

function applyMapping(rows, mapping) {
  return rows.map((row) => mapRow(row, mapping));
}

function validateRows(rows) {
  const valid = [];
  const warnings = [];
  const errors = [];
  const seenIds = new Set();

  rows.forEach((raw, i) => {
    const rowNum = i + 1;
    try {
      const data = normalizeXStepData(raw);
      const missing = REQUIRED_FIELDS.filter((f) => !data[f]);
      if (missing.length) {
        errors.push({ row: rowNum, field: missing.join(','), message: `Pflichtfelder fehlen: ${missing.join(', ')}` });
        return;
      }
      if (seenIds.has(data.xstep_id)) {
        errors.push({ row: rowNum, field: 'xstep_id', message: `Doppelte xstep_id: ${data.xstep_id}` });
        return;
      }
      seenIds.add(data.xstep_id);

      if (!CATEGORIES.includes(data.category)) {
        warnings.push({
          row: rowNum,
          message: `Kategorie "${data.category}" — wird importiert (nicht in Standardliste)`,
        });
      }
      valid.push(data);
    } catch (err) {
      errors.push({ row: rowNum, message: err.message });
    }
  });

  return {
    status: 'validated',
    summary: {
      total: rows.length,
      valid: valid.length,
      warnings: warnings.length,
      errors: errors.length,
    },
    valid,
    warnings,
    errors,
    error_details: errors,
    warning_details: warnings,
  };
}

async function importXSteps(xsteps, userId) {
  const start = Date.now();
  const report = {
    status: 'completed',
    total_rows: xsteps.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    error_details: [],
    duration_ms: 0,
  };

  for (let i = 0; i < xsteps.length; i += 1) {
    const rowNum = i + 1;
    try {
      const data = normalizeXStepData(xsteps[i]);
      const missing = REQUIRED_FIELDS.filter((f) => !data[f]);
      if (missing.length) {
        report.errors.push({ row: rowNum, message: `Missing: ${missing.join(', ')}` });
        report.skipped += 1;
        continue;
      }

      const [record, created] = await XStep.findOrCreate({
        where: { xstep_id: data.xstep_id },
        defaults: { ...data, created_by: userId, version: 1 },
      });

      if (created) report.created += 1;
      else {
        await record.update({ ...data, version: (record.version || 1) + 1 });
        report.updated += 1;
      }
    } catch (err) {
      report.errors.push({ row: rowNum, message: err.message });
      report.error_details.push({ row: rowNum, message: err.message });
      report.skipped += 1;
    }
  }

  report.duration_ms = Date.now() - start;

  await logAudit({
    userId,
    action: 'xsteps_imported',
    entityType: 'xstep',
    entityId: null,
    details: report,
  });

  embeddingService.embedAllXSteps().catch(console.error);
  return report;
}

async function validateSession(sessionId, mapping) {
  const session = getSession(sessionId);
  const mapped = applyMapping(session.rawRows, mapping);
  return validateRows(mapped);
}

async function confirmSession(sessionId, mapping, userId) {
  const validation = await validateSession(sessionId, mapping);
  const report = await importXSteps(validation.valid, userId);
  importSessions.delete(sessionId);
  return { ...report, warnings: validation.summary.warnings, skipped: report.skipped + validation.summary.errors };
}

/** Legacy: direct file import */
async function importFromFile(file, mapping, userId, options = {}, fileRoles = {}) {
  const preview = await previewImport(file, options, fileRoles);
  const map = Object.keys(mapping || {}).length ? mapping : preview.auto_mapping;
  return confirmSession(preview.session_id, map, userId);
}

module.exports = {
  previewImport,
  validateSession,
  confirmSession,
  importFromFile,
  validateRows,
  applyMapping,
  autoMapColumns,
  normalizeXStepData,
  normalizeSapSystem,
  normalizeTags,
  COLUMN_ALIASES,
  REQUIRED_FIELDS,
  // legacy
  importXSteps,
  parseCSV: (buf, m) => parsers.parseCSV(buf).then((r) => applyMapping(r.xsteps, m || {})),
  parseJSON: (buf) => parsers.parseJSON(buf).xsteps,
};
