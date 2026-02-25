const express = require('express');
const router = express.Router();
const ministryRegistrationController = require('../controllers/ministryRegistrationController');
const authMiddleware = require('../middlewares/userAuthMiddleware');

// Submit a new registration
router.post('/submit', authMiddleware, ministryRegistrationController.submitRegistration);

// Check if user is already registered (must be before wildcard routes)
router.get('/check', authMiddleware, ministryRegistrationController.checkRegistration);

// Get all registrations (must be before /:ministry wildcard)
router.get('/all', ministryRegistrationController.getAllRegistrations);

// Get registrations filtered by assigned role (must be before /:ministry wildcard)
router.get('/by-role/:role', ministryRegistrationController.getRegistrationsByRole);

// Approve / reject a registration (must be before /:ministry wildcard)
router.patch('/:id/approve', ministryRegistrationController.approveRegistration);
router.patch('/:id/reject', ministryRegistrationController.rejectRegistration);

// Get registrations for a specific ministry (wildcard — keep last)
router.get('/:ministry', ministryRegistrationController.getRegistrations);

module.exports = router;
