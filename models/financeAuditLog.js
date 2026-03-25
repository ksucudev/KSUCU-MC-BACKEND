const mongoose = require("mongoose");

const financeAuditLogSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entity_id: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "finance_audit_logs" }
);

module.exports = mongoose.model("FinanceAuditLog", financeAuditLogSchema);
