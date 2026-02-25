const express = require("express");
const {
  submitCommitment,
  getUserDetails,
  getMinistryCommitments,
  approveCommitment,
  revokeCommitment,
  getWorshipCoordinatorCommitments,
  getCommitmentsByRole
} = require("../controllers/commitmentController");
const authMiddleware = require("../middlewares/userAuthMiddleware");

const router = express.Router();

// User routes
router.post("/submit-commitment", authMiddleware, submitCommitment);
router.get("/user-details", authMiddleware, getUserDetails);

// Admin routes
router.get("/ministry/:ministry", authMiddleware, getMinistryCommitments);
router.put("/approve/:commitmentId", authMiddleware, approveCommitment);
router.put("/revoke/:commitmentId", authMiddleware, revokeCommitment);

// Worship Coordinator route (no user auth required - accessed via role-based page)
router.get("/worship-coordinator", getWorshipCoordinatorCommitments);

// Generic Role-based route
router.get("/by-role/:role", getCommitmentsByRole);

module.exports = router;
