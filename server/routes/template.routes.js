const express = require('express');
const Joi = require('joi');
const templateService = require('../services/template.service');
const lifecycle = require('../services/lifecycle.service');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const sheets = await templateService.findAll(
      req.user.id,
      req.user.role,
      req.query
    );
    res.json(sheets);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const pdf = await templateService.generatePDF(
      req.params.id,
      req.user.id,
      req.user.role
    );
    if (!pdf) return res.status(404).json({ error: 'PI Sheet not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pi-sheet-${req.params.id.slice(0, 8)}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sheet = await templateService.findById(
      req.params.id,
      req.user.id,
      req.user.role
    );
    if (!sheet) return res.status(404).json({ error: 'PI Sheet not found' });
    res.json(sheet);
  } catch (err) {
    next(err);
  }
});

const metaSchema = Joi.object({
  plant: Joi.string().max(20),
  order_number: Joi.string().max(50).allow('', null),
  batch_number: Joi.string().max(50).allow('', null),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { error, value } = metaSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const sheet = await templateService.updateSheetMeta(
      req.params.id,
      value,
      req.user.id,
      req.user.role
    );
    if (!sheet) return res.status(404).json({ error: 'PI Sheet not found' });
    res.json(sheet);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

const workflowSchema = Joi.object({
  comment: Joi.string().max(2000).allow('', null),
  batch_number: Joi.string().max(50).allow('', null),
  order_number: Joi.string().max(50).allow('', null),
});

async function runWorkflow(action, req, res, next) {
  try {
    const { error, value } = workflowSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const sheet = await lifecycle.transition(
      req.params.id,
      action,
      req.user.id,
      req.user.role,
      value
    );
    res.json(sheet);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

router.post('/:id/submit', (req, res, next) => runWorkflow('submit', req, res, next));
router.post('/:id/reject', roles('admin'), (req, res, next) => runWorkflow('reject', req, res, next));
router.post('/:id/approve', roles('admin'), (req, res, next) => runWorkflow('approve', req, res, next));
router.post('/:id/archive', roles('admin'), (req, res, next) => runWorkflow('archive', req, res, next));

router.put('/:id/status', async (req, res, next) => {
  try {
    const schema = Joi.object({
      status: Joi.string().valid('draft', 'review', 'in_review', 'approved', 'archived').required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const sheet = await templateService.updateStatus(
      req.params.id,
      value.status,
      req.user.id,
      req.user.role
    );
    if (!sheet) return res.status(404).json({ error: 'PI Sheet not found' });
    res.json(sheet);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const sheet = await templateService.findById(
      req.params.id,
      req.user.id,
      req.user.role
    );
    if (!sheet) return res.status(404).json({ error: 'PI Sheet not found' });
    if (req.user.role !== 'admin' && sheet.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await templateService.deleteSheet(req.params.id, req.user.id, req.user.role);
    res.status(204).end();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
