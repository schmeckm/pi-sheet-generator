const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const knowledgeService = require('../services/knowledge.service');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadSchema = Joi.object({
  title: Joi.string().max(255).allow('', null),
  category: Joi.string().max(100).allow('', null),
  process_type: Joi.string().max(100).allow('', null),
  replace: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
});

const updateSchema = Joi.object({
  title: Joi.string().max(255),
  category: Joi.string().max(100).allow('', null),
  process_type: Joi.string().max(100).allow('', null),
});

router.use(authMiddleware);
router.use(roles('admin'));

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const { error, value } = uploadSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const doc = await knowledgeService.upload(req.file, value, req.user.id, {
      replace: Boolean(value.replace),
    });
    res.status(201).json(doc);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, existingId: err.existingId });
    }
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await knowledgeService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const documents = await knowledgeService.listDocuments();
    res.json({ items: documents });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await knowledgeService.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const doc = await knowledgeService.updateDocument(req.params.id, value, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await knowledgeService.deleteDocument(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
