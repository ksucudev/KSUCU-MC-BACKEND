const mongoose = require("mongoose");

const financeAssetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    valuation: { type: Number, required: true },
    condition: { type: String, enum: ["good", "fair", "poor", "new"], default: "good" },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "finance_assets" }
);

module.exports = mongoose.model("FinanceAsset", financeAssetSchema);
