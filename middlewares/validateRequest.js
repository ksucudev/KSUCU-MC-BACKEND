const { validationResult } = require("express-validator");

module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({ field: err.path, message: err.msg }));
    return res.status(400).json({ message: "Validation failed.", errors: formattedErrors });
  }
  next();
};
