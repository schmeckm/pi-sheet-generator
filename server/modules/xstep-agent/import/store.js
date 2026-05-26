'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORE_DIR = path.join(__dirname, '..', 'data', 'imports');
const MANIFEST_PATH = path.join(STORE_DIR, '_manifest.json');

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readManifest() {
  ensureDir();
  if (!fs.existsSync(MANIFEST_PATH)) return [];
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
}

function writeManifest(manifest) {
  ensureDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Persist an import batch to JSON on disk.
 *
 * @param {object}   opts
 * @param {object[]} opts.steps       normalised XStep array
 * @param {object}   opts.validation  validation result
 * @param {string}   opts.filename    original upload filename
 * @param {string}   [opts.userId]    importing user id
 * @returns {object} stored record metadata
 */
function saveImport({
  steps,
  validation,
  filename,
  userId,
  format,
  rootTag,
  graphSummary,
  persistResult,
}) {
  ensureDir();

  const id = uuidv4();
  const ts = new Date().toISOString();

  const record = {
    id,
    filename: filename || 'unknown.xml',
    importedAt: ts,
    importedBy: userId || null,
    stepCount: steps.length,
    warningCount: validation.warningCount,
    warnings: validation.warnings,
    format: format || null,
    rootTag: rootTag || null,
    graphSummary: graphSummary || null,
    persistResult: persistResult
      ? {
          db: {
            created: persistResult.db?.created,
            updated: persistResult.db?.updated,
            skipped: persistResult.db?.skipped,
          },
          graph: persistResult.graph || null,
        }
      : null,
  };

  const dataPath = path.join(STORE_DIR, `${id}.json`);
  fs.writeFileSync(dataPath, JSON.stringify(steps, null, 2), 'utf-8');

  const manifest = readManifest();
  manifest.push(record);
  writeManifest(manifest);

  return record;
}

/**
 * List all imports (metadata only).
 * @returns {object[]}
 */
function listImports() {
  return readManifest();
}

/**
 * Retrieve a single import by id including its steps.
 * @param {string} id
 * @returns {object|null}
 */
function getImport(id) {
  const manifest = readManifest();
  const meta = manifest.find((r) => r.id === id);
  if (!meta) return null;

  const dataPath = path.join(STORE_DIR, `${id}.json`);
  if (!fs.existsSync(dataPath)) return null;

  const steps = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  return { ...meta, steps };
}

/**
 * Delete an import by id.
 * @param {string} id
 * @returns {boolean}
 */
function deleteImport(id) {
  const manifest = readManifest();
  const idx = manifest.findIndex((r) => r.id === id);
  if (idx === -1) return false;

  manifest.splice(idx, 1);
  writeManifest(manifest);

  const dataPath = path.join(STORE_DIR, `${id}.json`);
  if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);

  return true;
}

module.exports = { saveImport, listImports, getImport, deleteImport };
