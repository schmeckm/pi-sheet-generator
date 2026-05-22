const { PISheet, User } = require('../models');
const { logAudit } = require('./audit.service');

const STATUSES = ['draft', 'in_review', 'approved', 'archived'];

/** @param {import('../models').PISheet} sheet */
function canAccessSheet(sheet, userId, userRole) {
  if (!sheet) return false;
  if (userRole === 'admin') return true;
  if (sheet.created_by === userId) return true;
  if (['approved', 'archived'].includes(sheet.status)) return true;
  return false;
}

function isReadOnly(sheet) {
  return sheet && ['approved', 'archived'].includes(sheet.status);
}

async function loadSheet(id, userId, userRole) {
  const sheet = await PISheet.findByPk(id, {
    include: [
      { association: 'steps', separate: true, order: [['sort_order', 'ASC']] },
      { association: 'creator', attributes: ['id', 'email', 'name'] },
      { association: 'submitter', attributes: ['id', 'email', 'name'] },
      { association: 'approver', attributes: ['id', 'email', 'name'] },
    ],
  });
  if (!sheet || !canAccessSheet(sheet, userId, userRole)) return null;
  if (sheet.status === 'review') {
    await sheet.update({ status: 'in_review' });
    sheet.status = 'in_review';
  }
  return sheet;
}

async function transition(id, action, userId, userRole, options = {}) {
  const sheet = await loadSheet(id, userId, userRole);
  if (!sheet) {
    const err = new Error('PI Sheet not found');
    err.statusCode = 404;
    throw err;
  }

  const comment = options.comment?.trim() || null;
  const updates = { review_comment: comment };
  const currentStatus = sheet.status === 'review' ? 'in_review' : sheet.status;

  switch (action) {
    case 'submit': {
      if (currentStatus !== 'draft') {
        throw badRequest('Nur Entwürfe können zur Prüfung eingereicht werden.');
      }
      if (userRole !== 'admin' && sheet.created_by !== userId) {
        throw forbidden();
      }
      updates.status = 'in_review';
      updates.submitted_at = new Date();
      updates.submitted_by = userId;
      break;
    }
    case 'reject': {
      if (currentStatus !== 'in_review') {
        throw badRequest('Nur Sheets in Prüfung können abgelehnt werden.');
      }
      if (userRole !== 'admin') throw forbidden();
      if (!comment) {
        throw badRequest('Bitte einen Kommentar für die Ablehnung angeben.');
      }
      updates.status = 'draft';
      updates.submitted_at = null;
      updates.submitted_by = null;
      break;
    }
    case 'approve': {
      if (currentStatus !== 'in_review') {
        throw badRequest('Nur Sheets in Prüfung können freigegeben werden.');
      }
      if (userRole !== 'admin') throw forbidden();
      updates.status = 'approved';
      updates.approved_at = new Date();
      updates.approved_by = userId;
      break;
    }
    case 'archive': {
      if (currentStatus !== 'approved') {
        throw badRequest('Nur freigegebene Sheets können archiviert werden.');
      }
      if (userRole !== 'admin') throw forbidden();
      updates.status = 'archived';
      break;
    }
    default:
      throw badRequest(`Unknown action: ${action}`);
  }

  if (options.batch_number !== undefined) updates.batch_number = options.batch_number || null;
  if (options.order_number !== undefined) updates.order_number = options.order_number || null;

  await sheet.update(updates);
  await logAudit({
    userId,
    action: `pi_sheet_${action}`,
    entityType: 'pi_sheet',
    entityId: sheet.id,
    details: { status: updates.status, comment },
  });

  return loadSheet(id, userId, userRole);
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function forbidden() {
  const err = new Error('Insufficient permissions');
  err.statusCode = 403;
  return err;
}

module.exports = {
  STATUSES,
  canAccessSheet,
  isReadOnly,
  loadSheet,
  transition,
};
