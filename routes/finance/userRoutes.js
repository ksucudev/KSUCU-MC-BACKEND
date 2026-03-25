const express = require("express");
const router = express.Router();
const controller = require("../../controllers/finance/userController");
const authorize = require("../../middlewares/financeAuthorize");

router.get("/", authorize("admin"), controller.getAll);
router.post("/", authorize("admin"), controller.create);
router.delete("/:id", authorize("admin"), controller.deleteUser);

module.exports = router;
