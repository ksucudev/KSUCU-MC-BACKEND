const express = require("express");
const router = express.Router();
const { uploadVoucher } = require("../../middlewares/financeUpload");
const controller = require("../../controllers/finance/requisitionController");
const authorize = require("../../middlewares/financeAuthorize");
const requisitionValidator = require("../../validators/finance/requisitionValidator");
const validateRequest = require("../../middlewares/validateRequest");

router.post("/", authorize("treasurer"), requisitionValidator.create, validateRequest, controller.create);
router.get("/", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson", "patron"), controller.getAll);
router.get("/:id", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson", "patron"), controller.getById);
router.put("/:id/approve", authorize("chairperson", "patron"), controller.approve);
router.put("/:id/reject", authorize("chairperson", "patron"), controller.reject);
router.put("/:id/complete", authorize("treasurer"), uploadVoucher.single("voucher"), controller.complete);

module.exports = router;
