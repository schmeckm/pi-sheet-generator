'use strict';

const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const { parseImportXml } = require('./parseImportXml');
const { normalizeAll } = require('./normalizer');
const { validateBatch } = require('./validator');
const { saveImport, listImports, getImport, deleteImport } = require('./store');
const { persistToDatabase } = require('./persistService');
const { authMiddleware } = require('../../../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/xml', 'application/xml', 'application/octet-stream'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xml')) {
      return cb(null, true);
    }
    return cb(new Error('Only XML files are accepted'));
  },
});

router.use(authMiddleware);

/**
 * POST /import/upload
 * Multipart upload of an XStep XML file.
 * Parses → normalises → validates → stores as JSON.
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'XML file is required (field name: "file")' });
    }

    const xmlString = req.file.buffer.toString('utf-8');
    const processType =
      req.body?.processType || req.query?.processType || 'Import';
    const shouldPersist = req.query?.persist !== 'false';

    const parsed = parseImportXml(xmlString, { processType });
    const normalised = normalizeAll(parsed.raw);
    const validation = validateBatch(normalised);

    let persistResult = null;
    if (shouldPersist) {
      persistResult = await persistToDatabase({
        steps: normalised,
        graph: parsed.graph,
        processType,
        userId: req.user?.id,
      });
    }

    const record = saveImport({
      steps: normalised,
      validation,
      filename: req.file.originalname,
      userId: req.user?.id,
      format: parsed.format,
      rootTag: parsed.rootTag,
      graphSummary: parsed.graph
        ? {
            nodes: parsed.graph.nodes.length,
            edges: parsed.graph.edges.length,
            docId: parsed.graph.metadata?.docId,
          }
        : null,
      persistResult,
    });

    return res.status(201).json({
      importId: record.id,
      filename: record.filename,
      format: parsed.format,
      rootTag: parsed.rootTag,
      processType,
      stepCount: normalised.length,
      validation,
      steps: normalised,
      graph: parsed.graph
        ? {
            metadata: parsed.graph.metadata,
            summary: {
              nodes: parsed.graph.nodes.length,
              edges: parsed.graph.edges.length,
            },
          }
        : null,
      persist: persistResult,
    });
  } catch (err) {
    const msg = err.message || '';
    if (
      msg.includes('No XStep elements') ||
      msg.includes('XML input') ||
      msg.includes('SAP SXS') ||
      msg.includes('Ordnerstrukturen') ||
      msg.includes('Template-Knoten')
    ) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

const xmlBodySchema = Joi.object({
  xml: Joi.string().min(10).required(),
});

/**
 * POST /import/parse
 * Accept raw XML string in JSON body, parse and return normalised result
 * without persisting (dry-run / preview).
 */
router.post('/parse', (req, res, next) => {
  try {
    const { value, error } = xmlBodySchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.message });

    const processType = req.body?.processType || 'Import';
    const parsed = parseImportXml(value.xml, { processType });
    const normalised = normalizeAll(parsed.raw);
    const validation = validateBatch(normalised);

    return res.json({
      format: parsed.format,
      rootTag: parsed.rootTag,
      stepCount: normalised.length,
      validation,
      steps: normalised,
      graph: parsed.graph
        ? {
            metadata: parsed.graph.metadata,
            summary: {
              nodes: parsed.graph.nodes.length,
              edges: parsed.graph.edges.length,
            },
          }
        : null,
    });
  } catch (err) {
    if (err.message.includes('No XStep elements') || err.message.includes('XML input')) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

/**
 * GET /import/list
 * List all previous imports (metadata only).
 */
router.get('/list', (_req, res) => {
  return res.json({ imports: listImports() });
});

/**
 * GET /import/:id
 * Retrieve a single import including its steps.
 */
router.get('/:id', (req, res) => {
  const record = getImport(req.params.id);
  if (!record) return res.status(404).json({ error: 'Import not found' });
  return res.json(record);
});

/**
 * DELETE /import/:id
 * Delete a stored import.
 */
router.delete('/:id', (req, res) => {
  const ok = deleteImport(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Import not found' });
  return res.json({ deleted: true });
});

module.exports = router;
