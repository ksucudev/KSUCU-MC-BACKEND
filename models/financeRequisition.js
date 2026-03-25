const mongoose = require("mongoose");

const financeRequisitionSchema = new mongoose.Schema(
  {
    requested_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
    amount_requested: { type: Number, required: true },
    amount_spent: { type: Number, default: null },
    voucher_url: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "finance_requisitions" }
);

module.exports = mongoose.model("FinanceRequisition", financeRequisitionSchema);
