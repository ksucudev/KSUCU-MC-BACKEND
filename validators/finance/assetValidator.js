const { body } = require("express-validator");

exports.create = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("valuation").notEmpty().withMessage("Valuation is required").isNumeric().withMessage("Valuation must be numeric"),
  body("condition").optional().isIn(["good", "fair", "poor", "new"]).withMessage("Invalid condition"),
];
