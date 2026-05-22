const express = require('express');
const Joi = require('joi');
const { EquipmentConfig, WeighingRecord } = require('../models');
const gateway = require('../services/equipment/gateway.service');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');
const {
  EQUIPMENT_TYPES,
  CONNECTION_TYPES,
  SCALE_PROCESS_PARAMETERS,
  TEMPERATURE_PROCESS_PARAMETERS,
} = require('../services/equipment/constants');

const router = express.Router();

const configSchema = Joi.object({
  equipment_id: Joi.string().max(50).required(),
  name: Joi.string().max(255).required(),
  equipment_type: Joi.string()
    .valid(...EQUIPMENT_TYPES)
    .required(),
  location: Joi.string().max(255).allow('', null),
  connection_type: Joi.string()
    .valid(...CONNECTION_TYPES)
    .default('simulation'),
  connection_config: Joi.object().default({}),
  scale_config: Joi.object().default({}),
  process_parameters: Joi.array().items(Joi.object()).default([]),
  is_active: Joi.boolean().default(true),
});

router.use(authMiddleware);

router.get('/types', roles('admin'), (_req, res) => {
  res.json({
    equipment_types: EQUIPMENT_TYPES,
    connection_types: CONNECTION_TYPES,
    defaults: {
      scale: { process_parameters: SCALE_PROCESS_PARAMETERS },
      temperature: { process_parameters: TEMPERATURE_PROCESS_PARAMETERS },
    },
  });
});

router.get('/by-location/:location', roles('admin'), async (req, res, next) => {
  try {
    const list = await gateway.getEquipmentByLocation(req.params.location);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/by-type/:type', roles('admin'), async (req, res, next) => {
  try {
    const list = await gateway.getEquipmentByType(req.params.type);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/', roles('admin'), async (req, res, next) => {
  try {
    const list = await gateway.getEquipmentList(req.query);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/namespace-search', roles('admin'), async (req, res, next) => {
  try {
    const schema = Joi.object({
      query: Joi.string().min(2).max(200).required(),
      equipment_id: Joi.string().max(50).optional(),
      connection_types: Joi.array()
        .items(Joi.string().valid('opcua', 'mqtt', 'uns_sparkplug'))
        .optional(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (value.equipment_id) {
      const nodes = await gateway.discoverNamespace(value.equipment_id, { query: value.query });
      return res.json(nodes);
    }
    const matches = await gateway.searchNamespaceAcrossEquipment({
      query: value.query,
      connection_types: value.connection_types,
    });
    res.json(matches);
  } catch (err) {
    next(err);
  }
});

router.get('/debug/log', roles('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 80);
    const equipmentId = req.query.equipment_id || req.query.equipmentId || null;
    res.json({
      items: gateway.getDebugLog({ equipmentId, limit }),
      equipment_id: equipmentId,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/status', async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    res.json({
      equipment_id: config.equipment_id,
      name: config.name,
      equipment_type: config.equipment_type,
      location: config.location,
      status: gateway.getStatus(config.equipment_id),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/parameters', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    const data = await gateway.getEquipmentParameters(config.equipment_id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/discover', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    const data = await gateway.discoverNamespace(config.equipment_id, {
      query: req.query.q || req.query.query || null,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/snapshot', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    if (!gateway.getStatus(config.equipment_id).online) {
      await gateway.connect(config.equipment_id);
    }
    const snapshot = await gateway.getLiveSnapshot(config.equipment_id);
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    res.json({
      ...config.toJSON(),
      status: gateway.getStatus(config.equipment_id),
      live: gateway.getCurrentValue(config.equipment_id),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', roles('admin'), async (req, res, next) => {
  try {
    const { error, value } = configSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const created = await EquipmentConfig.create(value);
    if (created.is_active) {
      await gateway.connect(created.equipment_id).catch(() => {});
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });

    const { error, value } = configSchema
      .fork(['equipment_id'], (f) => f.optional())
      .validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await gateway.disconnect(config.equipment_id).catch(() => {});
    await config.update(value);
    if (config.is_active) await gateway.connect(config.equipment_id).catch(() => {});

    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });

    const refs = await WeighingRecord.count({ where: { equipment_id: config.equipment_id } });
    if (refs > 0) {
      return res.status(409).json({
        error: 'Cannot delete equipment with existing weighing records',
        weighing_count: refs,
      });
    }

    await gateway.disconnect(config.equipment_id).catch(() => {});
    await config.destroy();
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/connect', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    const result = await gateway.connect(config.equipment_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/disconnect', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    await gateway.disconnect(config.equipment_id);
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/test', roles('admin'), async (req, res, next) => {
  try {
    const config = await gateway.findConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Equipment not found' });
    const result = await gateway.runConnectionTest(config.equipment_id, 3000);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
