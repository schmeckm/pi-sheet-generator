const express = require('express');
const plantExplorer = require('../services/plant-explorer.service');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/** Plant list for werk dropdowns (Basel/Stein from settings). */
router.get('/', async (_req, res, next) => {
  try {
    const configured = await plantExplorer.getConfiguredPlants();
    res.json({
      plants: configured.map((p) => ({
        code: p.code,
        name: p.name,
        pi_sheet_count: 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
