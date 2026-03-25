const mongoose = require("mongoose");

const financeUserSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["treasurer", "auditor", "chair_accounts", "chairperson"],
      required: true,
    },
    phone: { type: String },
  },
  { timestamps: true, collection: "finance_users" }
);

module.exports = mongoose.model("FinanceUser", financeUserSchema);
