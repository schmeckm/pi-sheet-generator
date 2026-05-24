'use strict';

const express = require('express');
const Joi = require('joi');
const { retrieve } = require('../services/retrievalService');
const { composeTemplate, validateTemplate } = require('../services/templateComposerService');
const { validateTemplateShape } = require('../utils/schemaValidator');
const { getLlmProvider } = require('../config');

const router = express.Router();

const retrieveSchema = Joi.object({
  query: Joi.string().allow('').default(''),
  processArea: Joi.string().allow('').optional(),
  packagingType: Joi.string().allow('').optional(),
  topK: Joi.number().integer().min(1).max(20).default(5),
});

const composeSchema = Joi.object({
  prompt: Joi.string().min(10).required(),
  processArea: Joi.string().optional(),
  packagingType: Joi.string().optional(),
});

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    module: 'xstep-agent',
    version: '0.1.0-mvp',
    llmProvider: getLlmProvider(),
    sapWriteBack: false,
    autonomousGmpApproval: false,
  });
});

router.post('/retrieve', (req, res, next) => {
  try {
    const { value, error } = retrieveSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    const result = retrieve(value);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/compose-template', async (req, res, next) => {
  try {
    const { value, error } = composeSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    const template = await composeTemplate(value);
    const shapeErrors = validateTemplateShape(template);
    if (shapeErrors.length) {
      return res.status(500).json({
        error: 'Generated template failed schema validation',
        details: shapeErrors,
      });
    }
    return res.json(template);
  } catch (err) {
    return next(err);
  }
});

router.post('/validate-template', (req, res, next) => {
  try {
    const template = req.body?.template || req.body;
    if (!template || typeof template !== 'object') {
      return res.status(400).json({ error: 'template object is required' });
    }
    const shapeErrors = validateTemplateShape(template);
    if (shapeErrors.length) {
      return res.status(400).json({
        error: 'Template schema validation failed',
        details: shapeErrors,
      });
    }
    const validated = validateTemplate(template);
    return res.json(validated);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
