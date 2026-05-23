const express = require('express');
const Joi = require('joi');
const settingsService = require('../services/settings.service');
const llmSettings = require('../services/llmSettings.service');
const { invalidate: invalidateLlmModelCache, isAllowedModel } = require('../utils/llmModel');
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

router.get('/llm', async (req, res, next) => {
  try {
    const overview = await llmSettings.getOverview(req.user.id, req.user.role);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

router.put('/:key', async (req, res, next) => {
  try {
    const schema = Joi.object({ value: Joi.alternatives().try(Joi.string(), Joi.boolean(), Joi.number()).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const key = String(req.params.key);
    if (key.startsWith('llm_model_') && !isAllowedModel(value.value)) {
      return res.status(400).json({ error: 'Invalid Claude model id' });
    }
    if (key.startsWith('llm_max_tokens_')) {
      const n = Number(value.value);
      if (!Number.isFinite(n) || n < 256 || n > 8000) {
        return res.status(400).json({ error: 'Max tokens must be between 256 and 8000' });
      }
    }
    if (key === 'llm_token_budget_daily_per_user') {
      const n = Number(value.value);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: 'Daily token budget must be >= 0 (0 = unlimited)' });
      }
    }

    const row = await settingsService.set(key, value.value, req.user.id);
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
