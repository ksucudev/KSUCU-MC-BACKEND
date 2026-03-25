const FinanceAuditLog = require("../models/financeAuditLog");

async function logFinanceAction(userId, action, entity, entityId, details) {
  await FinanceAuditLog.create({
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    details,
  });
}

module.exports = { logFinanceAction };
