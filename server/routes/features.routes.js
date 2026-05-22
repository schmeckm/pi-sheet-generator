const express = require('express');
const settingsService = require('../services/settings.service');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (_req, res, next) => {
  try {
    const plant_explorer_enabled = await settingsService.isFeatureEnabled('plant_explorer_enabled');
    res.json({ plant_explorer_enabled });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
