const express = require('express');
const Joi = require('joi');
const graphService = require('../services/graph.service');
const graphRagService = require('../services/graph-rag.service');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

const router = express.Router();
router.use(authMiddleware);

router.get('/context', async (req, res, next) => {
  try {
    const processType = req.query.process_type;
    if (!processType) {
      return res.status(400).json({ error: 'process_type query parameter required' });
    }
    const ctx = await graphService.getProcessContext(processType);
    res.json(ctx);
  } catch (err) {
    next(err);
  }
});

router.get('/explorer', async (req, res, next) => {
  try {
    const processType = req.query.process_type;
    if (!processType) {
      return res.status(400).json({ error: 'process_type query parameter required' });
    }
    const data = await graphService.getExplorer(processType);
    res.json(data);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.post('/sync-sap', roles('admin'), async (req, res, next) => {
  try {
    const processType = req.body?.process_type || req.query.process_type || null;
    const report = await graphService.syncSapFromXSteps(processType, req.user.id);
    res.json(report);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.get('/edges', async (req, res, next) => {
  try {
    const edges = await graphService.listEdges({
      process_type: req.query.process_type || undefined,
      edge_type: req.query.edge_type || undefined,
    });
    res.json(edges);
  } catch (err) {
    next(err);
  }
});

const edgeSchema = Joi.object({
  process_type: Joi.string().max(100).required(),
  edge_type: Joi.string()
    .valid(...graphService.EDGE_TYPES)
    .required(),
  from_kind: Joi.string()
    .valid(...graphService.REF_KINDS)
    .default('xstep'),
  from_ref: Joi.string().max(100).required(),
  to_kind: Joi.string()
    .valid(...graphService.REF_KINDS)
    .default('xstep'),
  to_ref: Joi.string().max(100).required(),
  sort_order: Joi.number().integer().allow(null),
  metadata: Joi.object().default({}),
});

router.post('/edges', roles('admin'), async (req, res, next) => {
  try {
    const { error, value } = edgeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const edge = await graphService.createEdge(value, req.user.id);
    res.status(201).json(edge);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'This edge already exists.' });
    }
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.get('/suggestions', roles('admin'), async (req, res, next) => {
  try {
    const suggestions = await graphRagService.listSuggestions({
      status: req.query.status || 'pending',
      process_type: req.query.process_type || undefined,
    });
    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

router.post('/suggestions/:id/approve', roles('admin'), async (req, res, next) => {
  try {
    const result = await graphRagService.approveSuggestion(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Edge already exists in graph.' });
    }
    next(err);
  }
});

router.post('/suggestions/:id/reject', roles('admin'), async (req, res, next) => {
  try {
    const suggestion = await graphRagService.rejectSuggestion(req.params.id, req.user.id);
    res.json(suggestion);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.delete('/edges/:id', roles('admin'), async (req, res, next) => {
  try {
    const ok = await graphService.deleteEdge(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Edge not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
