const express = require("express");
const router = express.Router();
const controller = require("../../controllers/finance/reportController");
const authorize = require("../../middlewares/financeAuthorize");

router.get("/statement", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson", "patron"), controller.getFinancialStatement);
router.get("/categories", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson"), controller.getCategoryBreakdown);

module.exports = router;
