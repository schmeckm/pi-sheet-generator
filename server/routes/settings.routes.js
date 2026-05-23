const express = require('express');
const Joi = require('joi');
const settingsService = require('../services/settings.service');
const { invalidate: invalidateLlmModelCache } = require('../utils/llmModel');
const sapService = require('../services/sap.service');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

const router = express.Router();
router.use(authMiddleware, roles('admin'));

router.get('/', async (_req, res, next) => {
  try {
    const settings = await settingsService.getAll();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put('/:key', async (req, res, next) => {
  try {
    const schema = Joi.object({ value: Joi.alternatives().try(Joi.string(), Joi.boolean(), Joi.number()).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const row = await settingsService.set(req.params.key, value.value, req.user.id);
    if (String(req.params.key).startsWith('llm_')) {
      invalidateLlmModelCache();
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/sap/test-connection', async (_req, res, next) => {
  try {
    const result = await sapService.testConnection();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/sap/sync', async (req, res, next) => {
  try {
    const report = await sapService.syncXSteps(req.user.id);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.get('/sap/status', async (_req, res, next) => {
  try {
    const status = await sapService.getStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
