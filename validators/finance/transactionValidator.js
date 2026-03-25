const { body } = require("express-validator");

exports.create = [
  body("amount").notEmpty().withMessage("Amount is required").isNumeric().withMessage("Amount must be numeric").custom((value) => value > 0).withMessage("Amount must be greater than 0"),
  body("category").optional({ nullable: true }).isIn(["offering", "tithe", "thanksgiving", "aob", "food", "transport", "bills", "others"]).withMessage("Invalid category"),
  body("type").notEmpty().withMessage("Type is required").isIn(["cash_in", "cash_out", "income", "expense"]).withMessage("Invalid type"),
  body("source").notEmpty().withMessage("Source is required").isIn(["mpesa", "cash"]).withMessage("Invalid source"),
];
