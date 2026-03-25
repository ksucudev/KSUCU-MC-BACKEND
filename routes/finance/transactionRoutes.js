const express = require("express");
const router = express.Router();
const { uploadReceipt } = require("../../middlewares/financeUpload");
const controller = require("../../controllers/finance/transactionController");
const authorize = require("../../middlewares/financeAuthorize");
const transactionValidator = require("../../validators/finance/transactionValidator");
const validateRequest = require("../../middlewares/validateRequest");

router.post("/", authorize("treasurer"), uploadReceipt.single("receipt"), transactionValidator.create, validateRequest, controller.create);
router.get("/", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson", "patron"), controller.getAll);
router.get("/balance", authorize("admin", "treasurer", "chair_accounts", "chairperson", "patron"), controller.getBalance);
router.get("/:id", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson"), controller.getById);

module.exports = router;
