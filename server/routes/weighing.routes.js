const express = require('express');
const Joi = require('joi');
const weighingService = require('../services/equipment/weighing.service');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const createSchema = Joi.object({
  equipment_id: Joi.string().required(),
  pi_sheet_id: Joi.string().uuid().allow(null),
  pi_sheet_step_id: Joi.string().uuid().allow(null),
  gross_weight: Joi.number(),
  tare_weight: Joi.number(),
  net_weight: Joi.number().required(),
  unit: Joi.string().default('kg'),
  target_weight: Joi.number().allow(null),
  tolerance_abs: Joi.number().allow(null),
  tolerance_pct: Joi.number().allow(null),
  material_number: Joi.string().allow('', null),
  material_name: Joi.string().allow('', null),
  batch_number: Joi.string().allow('', null),
  stable_reading: Joi.boolean(),
  reading_count: Joi.number().integer(),
  stability_duration_ms: Joi.number().integer(),
  raw_readings: Joi.array().items(Joi.object()),
  connection_source: Joi.string(),
  values: Joi.object(),
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await weighingService.getStats(req.query);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const list = await weighingService.getWeighingHistory({
      piSheetId: req.query.pi_sheet_id,
      equipmentId: req.query.equipment_id,
      inTolerance:
        req.query.in_tolerance === 'true'
          ? true
          : req.query.in_tolerance === 'false'
            ? false
            : undefined,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const record = await weighingService.createRecord(value, req.user.id);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.post('/start', async (req, res, next) => {
  try {
    const schema = Joi.object({
      equipment_id: Joi.string().required(),
      target_weight: Joi.number(),
      tolerance_abs: Joi.number(),
      tolerance_pct: Joi.number(),
      material_number: Joi.string(),
      material_name: Joi.string(),
      batch_number: Joi.string(),
      pi_sheet_id: Joi.string().uuid(),
      pi_sheet_step_id: Joi.string().uuid(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const session = await weighingService.startWeighing(value.equipment_id, {
      targetWeight: value.target_weight,
      toleranceAbs: value.tolerance_abs,
      tolerancePct: value.tolerance_pct,
      materialNumber: value.material_number,
      materialName: value.material_name,
      batchNumber: value.batch_number,
      piSheetId: value.pi_sheet_id,
      piSheetStepId: value.pi_sheet_step_id,
    });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.post('/confirm', async (req, res, next) => {
  try {
    const schema = Joi.object({
      session_id: Joi.string().required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const record = await weighingService.confirmWeighing(value.session_id, req.user.id, req.body);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/audit', async (req, res, next) => {
  try {
    const record = await weighingService.getWeighingAudit(req.params.id);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const record = await weighingService.getWeighingAudit(req.params.id);
    const json = record.toJSON();
    delete json.raw_readings;
    res.json(json);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/verify', async (req, res, next) => {
  try {
    const record = await weighingService.verifyWeighing(req.params.id, req.user.id);
    const json = record.toJSON();
    json.verified_by_name = req.user.name;
    res.json(json);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
