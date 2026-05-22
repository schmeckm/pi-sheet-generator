const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const repositoryService = require('../services/repository.service');
const importService = require('../services/import.service');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const createSchema = Joi.object({
  xstep_id: Joi.string().required(),
  name: Joi.string().required(),
  category: Joi.string()
    .valid(...repositoryService.CATEGORIES)
    .required(),
  process_type: Joi.string().required(),
  description: Joi.string().allow('', null),
  instruction_template: Joi.string().allow('', null),
  params: Joi.array().items(Joi.object()).default([]),
  sap_transaction: Joi.string().allow('', null),
  movement_type: Joi.string().allow('', null),
  gmp_relevant: Joi.boolean().default(false),
  signature_required: Joi.boolean().default(false),
  sort_order: Joi.number().integer().default(0),
  is_active: Joi.boolean().default(true),
});

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const result = await repositoryService.findAll(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', roles('admin'), async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const xstep = await repositoryService.create(value, req.user.id);
    res.status(201).json(xstep);
  } catch (err) {
    next(err);
  }
});

const updateSchema = createSchema.fork(
  ['xstep_id', 'name', 'category', 'process_type', 'description', 'instruction_template', 'params', 'sap_transaction', 'movement_type', 'gmp_relevant', 'signature_required', 'sort_order', 'is_active'],
  (field) => field.optional()
);

function parseJsonField(val, fallback = {}) {
  if (!val) return fallback;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

/** Phase 1: preview (multipart file) */
router.post('/import/preview', roles('admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const options = parseJsonField(req.body.options, {});
    const file_roles = parseJsonField(req.body.file_roles, {});
    const result = await importService.previewImport(req.file, options, file_roles);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 2: validate (session + mapping) */
router.post('/import/validate', roles('admin'), async (req, res, next) => {
  try {
    const schema = Joi.object({
      session_id: Joi.string().uuid().required(),
      mapping: Joi.object().required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const result = await importService.validateSession(value.session_id, value.mapping);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 3: confirm import */
router.post('/import/confirm', roles('admin'), async (req, res, next) => {
  try {
    const schema = Joi.object({
      session_id: Joi.string().uuid().required(),
      mapping: Joi.object().required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const result = await importService.confirmSession(value.session_id, value.mapping, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Legacy single-shot import */
router.post('/import', roles('admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const mapping = parseJsonField(req.body.mapping, {});
    const options = parseJsonField(req.body.options, {});
    const file_roles = parseJsonField(req.body.file_roles, {});
    const report = await importService.importFromFile(
      req.file,
      mapping,
      req.user.id,
      options,
      file_roles
    );
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-action', roles('admin'), async (req, res, next) => {
  try {
    const schema = Joi.object({
      action: Joi.string().valid('activate', 'deactivate', 'delete').required(),
      ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const result = await repositoryService.bulkAction(value.action, value.ids, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', roles('admin'), async (req, res, next) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const xstep = await repositoryService.update(req.params.id, value, req.user.id);
    if (!xstep) return res.status(404).json({ error: 'XStep not found' });
    res.json(xstep);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', roles('admin'), async (req, res, next) => {
  try {
    const xstep = await repositoryService.softDelete(req.params.id, req.user.id);
    if (!xstep) return res.status(404).json({ error: 'XStep not found' });
    res.json(xstep);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const xstep = await repositoryService.findById(req.params.id);
    if (!xstep) return res.status(404).json({ error: 'XStep not found' });
    res.json(xstep);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
