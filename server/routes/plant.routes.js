const express = require('express');
const plantExplorer = require('../services/plant-explorer.service');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const plants = await plantExplorer.getPlantOverview();
    res.json({ plants });
  } catch (err) {
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const detail = await plantExplorer.getPlantDetail(req.params.code);
    res.json(detail);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
