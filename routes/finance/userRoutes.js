const express = require("express");
const router = express.Router();
const controller = require("../../controllers/finance/userController");
const authorize = require("../../middlewares/financeAuthorize");

router.get("/", authorize("admin"), controller.getAll);
router.get("/finance-users", authorize("admin"), controller.getFinanceUsers);
router.put("/:id/role", authorize("admin"), controller.assignRole);

module.exports = router;
