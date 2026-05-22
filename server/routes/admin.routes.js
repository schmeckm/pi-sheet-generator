const express = require('express');
const Joi = require('joi');
const { Op, fn, col } = require('sequelize');
const { User, XStep, PISheet, AuditLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');
const { logAudit } = require('../services/audit.service');
const promptRoutes = require('./prompt.routes');

const router = express.Router();

/** Prompt CRUD — before admin-only gate (admin + prompt_editor). */
router.use('/prompts', promptRoutes);

router.use(authMiddleware, roles('admin'));

router.get('/stats', async (req, res, next) => {
  try {
    const xstepTotal = await XStep.count();
    const xstepsByProcess = await XStep.findAll({
      attributes: ['process_type', [fn('COUNT', col('id')), 'count']],
      group: ['process_type'],
      raw: true,
    });
    const xstepsByCategory = await XStep.findAll({
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      group: ['category'],
      raw: true,
    });
    const gmpRelevant = await XStep.count({ where: { gmp_relevant: true } });

    const templateTotal = await PISheet.count();
    const templatesByStatus = await PISheet.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = await PISheet.count({
      where: { created_at: { [Op.gte]: weekAgo } },
    });

    const userTotal = await User.count();
    const admins = await User.count({ where: { role: 'admin' } });
    const operators = await User.count({ where: { role: 'operator' } });

    const recentActivity = await AuditLog.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [{ association: 'user', attributes: ['email', 'name'] }],
    });

    res.json({
      xsteps: {
        total: xstepTotal,
        byProcessType: Object.fromEntries(
          xstepsByProcess.map((r) => [r.process_type, Number(r.count)])
        ),
        byCategory: Object.fromEntries(
          xstepsByCategory.map((r) => [r.category, Number(r.count)])
        ),
        gmpRelevant,
      },
      templates: {
        total: templateTotal,
        byStatus: Object.fromEntries(
          templatesByStatus.map((r) => [r.status, Number(r.count)])
        ),
        thisWeek,
      },
      users: { total: userTotal, admins, operators },
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-log', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 25);
    const offset = (page - 1) * limit;
    const where = {};
    if (req.query.action) where.action = req.query.action;
    if (req.query.user_id) where.user_id = req.query.user_id;

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [{ association: 'user', attributes: ['email', 'name'] }],
    });

    res.json({ items: rows, total: count, page, limit });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
