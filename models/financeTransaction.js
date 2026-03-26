const mongoose = require("mongoose");

const financeTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["cash_in", "cash_out", "income", "expense"], required: true },
    category: { type: String, enum: ["offering", "tithe", "thanksgiving", "aob", "food", "transport", "bills", "others"], default: null },
    amount: { type: Number, required: true },
    source: { type: String, enum: ["mpesa", "cash"], required: true },
    phone: { type: String },
    payer_name: { type: String },
    description: { type: String },
    receipt_url: { type: String },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "finance_transactions" }
);

module.exports = mongoose.model("FinanceTransaction", financeTransactionSchema);
