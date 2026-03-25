const { body } = require("express-validator");

exports.create = [
  body("reason").trim().notEmpty().withMessage("Reason is required"),
  body("amount_requested").notEmpty().withMessage("Amount is required").isNumeric().withMessage("Amount must be numeric").custom((value) => value > 0).withMessage("Amount must be greater than 0"),
];
