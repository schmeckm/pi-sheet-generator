const { AuditLog } = require('../models');

async function logAudit({ userId, action, entityType, entityId, details = {} }) {
  await AuditLog.create({
    user_id: userId || null,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    details,
  });
}

module.exports = { logAudit };
