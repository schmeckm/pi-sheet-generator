const { Op } = require('sequelize');
const { XStep } = require('../models');
const { logAudit } = require('./audit.service');
const embeddingService = require('./embedding.service');

const CATEGORIES = ['Warenbewegung', 'Rückmeldung', 'Prozess', 'Qualität', 'Dokumentation'];

async function findAll(filters = {}) {
  const {
    process_type,
    category,
    gmp_relevant,
    is_active,
    search,
    page = 1,
    limit = 50,
  } = filters;

  const where = {};
  if (process_type) where.process_type = process_type;
  if (category) where.category = category;
  if (gmp_relevant !== undefined && gmp_relevant !== '') {
    where.gmp_relevant = gmp_relevant === 'true' || gmp_relevant === true;
  }
  if (is_active !== undefined && is_active !== '') {
    where.is_active = is_active === 'true' || is_active === true;
  }
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { xstep_id: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const { rows, count } = await XStep.findAndCountAll({
    where,
    order: [
      ['process_type', 'ASC'],
      ['sort_order', 'ASC'],
    ],
    limit: Number(limit),
    offset,
  });

  return { items: rows, total: count, page: Number(page), limit: Number(limit) };
}

async function findById(id) {
  return XStep.findByPk(id);
}

async function create(data, userId) {
  const xstep = await XStep.create({ ...data, created_by: userId });
  await logAudit({
    userId,
    action: 'xstep_created',
    entityType: 'xstep',
    entityId: xstep.id,
    details: { xstep_id: xstep.xstep_id },
  });
  embeddingService.embedXStep(xstep.id).catch(console.error);
  return xstep;
}

async function update(id, data, userId) {
  const xstep = await XStep.findByPk(id);
  if (!xstep) return null;

  const nextVersion = (xstep.version || 1) + 1;
  await xstep.update({ ...data, version: nextVersion });
  await logAudit({
    userId,
    action: 'xstep_updated',
    entityType: 'xstep',
    entityId: xstep.id,
    details: { xstep_id: xstep.xstep_id, version: nextVersion },
  });
  embeddingService.embedXStep(xstep.id).catch(console.error);
  return xstep;
}

async function softDelete(id, userId) {
  const xstep = await XStep.findByPk(id);
  if (!xstep) return null;
  await xstep.update({ is_active: false });
  await logAudit({
    userId,
    action: 'xstep_deactivated',
    entityType: 'xstep',
    entityId: xstep.id,
    details: { xstep_id: xstep.xstep_id },
  });
  return xstep;
}

async function bulkAction(action, ids, userId) {
  const results = { updated: 0 };
  for (const id of ids) {
    const xstep = await XStep.findByPk(id);
    if (!xstep) continue;
    if (action === 'activate') await xstep.update({ is_active: true });
    else if (action === 'deactivate' || action === 'delete') await xstep.update({ is_active: false });
    results.updated += 1;
  }
  await logAudit({
    userId,
    action: `xstep_bulk_${action}`,
    entityType: 'xstep',
    entityId: null,
    details: { ids, count: results.updated },
  });
  return results;
}

module.exports = {
  CATEGORIES,
  findAll,
  findById,
  create,
  update,
  softDelete,
  bulkAction,
};
