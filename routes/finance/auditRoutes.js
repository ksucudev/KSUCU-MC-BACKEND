const express = require("express");
const router = express.Router();
const controller = require("../../controllers/finance/auditController");
const authorize = require("../../middlewares/financeAuthorize");

router.get("/", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson"), controller.getAll);

module.exports = router;
