const mongoose = require("mongoose");

const overseerSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true, collection: "overseers" }
);

module.exports = mongoose.model("Overseer", overseerSchema);
