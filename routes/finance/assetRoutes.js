const express = require("express");
const router = express.Router();
const controller = require("../../controllers/finance/assetController");
const authorize = require("../../middlewares/financeAuthorize");
const assetValidator = require("../../validators/finance/assetValidator");
const validateRequest = require("../../middlewares/validateRequest");

router.post("/", authorize("treasurer", "chairperson", "admin", "chair_accounts"), assetValidator.create, validateRequest, controller.create);
router.get("/", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson", "patron"), controller.getAll);
router.get("/:id", authorize("admin", "treasurer", "auditor", "chair_accounts", "chairperson", "patron"), controller.getById);
router.put("/:id", authorize("treasurer", "chairperson", "admin", "chair_accounts"), controller.update);
router.delete("/:id", authorize("admin"), controller.remove);

module.exports = router;
