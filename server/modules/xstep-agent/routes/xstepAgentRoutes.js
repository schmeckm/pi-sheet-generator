'use strict';

const express = require('express');
const Joi = require('joi');
const { retrieve } = require('../services/retrievalService');
const { composeTemplate, validateTemplate } = require('../services/templateComposerService');
const { exportTemplateToXml, importTemplateFromXml } = require('../services/sapExportService');
const { saveProposal, getProposal, listProposals, transition, auditLogForProposal } = require('../services/approvalService');
const { getBtpStatus } = require('../services/btpIntegrationService');
const { validateTemplateShape } = require('../utils/schemaValidator');
const { getLlmProvider } = require('../config');
const { authMiddleware } = require('../../../middleware/auth');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    module: 'xstep-agent',
    version: '0.3.0-phase8',
    llmProvider: getLlmProvider(),
    sapWriteBack: false,
    sapBtp: getBtpStatus(),
    autonomousGmpApproval: false,
    features: {
      retrieval: 'database+mock',
      knowledgeGraph: true,
      piSheetExamples: true,
      sapXmlExport: true,
      approvalWorkflow: true,
      auditTrail: true,
    },
  });
});

router.use(authMiddleware);

const retrieveSchema = Joi.object({
  query: Joi.string().allow('').default(''),
  processArea: Joi.string().allow('').optional(),
  packagingType: Joi.string().allow('').optional(),
  topK: Joi.number().integer().min(1).max(50).default(10),
});

const composeSchema = Joi.object({
  prompt: Joi.string().min(10).required(),
  processArea: Joi.string().optional(),
  packagingType: Joi.string().optional(),
});

// --- Retrieval ---

router.post('/retrieve', async (req, res, next) => {
  try {
    const { value, error } = retrieveSchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.message });
    const result = await retrieve(value);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// --- Template Composition ---

router.post('/compose-template', async (req, res, next) => {
  try {
    const { value, error } = composeSchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.message });
    const template = await composeTemplate(value);
    const shapeErrors = validateTemplateShape(template);
    if (shapeErrors.length) {
      return res.status(500).json({ error: 'Schema validation failed', details: shapeErrors });
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
      return res.status(400).json({ error: 'Schema validation failed', details: shapeErrors });
    }
    return res.json(validateTemplate(template));
  } catch (err) {
    return next(err);
  }
});

// --- SAP XML Export / Import ---

router.post('/export-xml', async (req, res, next) => {
  try {
    const template = req.body?.template || req.body;
    if (!template || !Array.isArray(template.steps)) {
      return res.status(400).json({ error: 'Template with steps is required' });
    }
    const xml = exportTemplateToXml(template);
    res.set('Content-Type', 'application/xml');
    return res.send(xml);
  } catch (err) {
    return next(err);
  }
});

router.post('/import-xml', (req, res, next) => {
  try {
    const xml = req.body?.xml;
    if (!xml || typeof xml !== 'string') {
      return res.status(400).json({ error: 'xml string is required' });
    }
    const template = importTemplateFromXml(xml);
    return res.json(template);
  } catch (err) {
    return next(err);
  }
});

// --- Approval Workflow ---

router.post('/proposals', async (req, res, next) => {
  try {
    const { value, error } = composeSchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.message });
    const template = await composeTemplate(value);
    const proposal = saveProposal(template, req.user.id);
    try {
      const { logAudit } = require('../../../services/audit.service');
      await logAudit({
        userId: req.user.id,
        action: 'agent_proposal_created',
        entityType: 'xstep_agent_proposal',
        entityId: proposal.id,
        details: { prompt: value.prompt, status: proposal.status },
      });
    } catch { /* audit is best-effort */ }
    return res.status(201).json(proposal);
  } catch (err) {
    return next(err);
  }
});

router.get('/proposals', (req, res) => {
  const { status } = req.query;
  const list = listProposals({ status, userId: req.user.role === 'admin' ? undefined : req.user.id });
  return res.json({ proposals: list, total: list.length });
});

router.get('/proposals/:id', (req, res) => {
  const proposal = getProposal(req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  return res.json(proposal);
});

router.post('/proposals/:id/:action', async (req, res, next) => {
  try {
    const { id, action } = req.params;
    const { comment } = req.body || {};
    const entry = transition(id, action, req.user.id, comment);
    try {
      const { logAudit } = require('../../../services/audit.service');
      await logAudit({
        userId: req.user.id,
        action: `agent_proposal_${action}`,
        entityType: 'xstep_agent_proposal',
        entityId: id,
        details: { action, status: entry.status, comment },
      });
    } catch { /* audit is best-effort */ }
    return res.json(entry);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not allowed')) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

// --- Audit Trail ---

router.get('/proposals/:id/audit', (req, res) => {
  const proposal = getProposal(req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  return res.json({ audit: auditLogForProposal(proposal) });
});

module.exports = router;
