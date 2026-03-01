const express = require('express');
const router = express.Router();
const compassionController = require('../controllers/compassionController');
const { overseerAuth } = require('../middlewares/overseerAuthMiddleware');

// ===== PUBLIC ROUTES (User-facing) =====

// Help Request Routes
router.post('/help-request', compassionController.createHelpRequest);
router.get('/user-requests', compassionController.getUserRequests);

// Donation Routes
router.post('/donation', compassionController.createDonation);

// Public Settings (Payment Methods & Contact Info)
router.get('/settings', compassionController.getSettings);

// ===== ADMIN ROUTES (Protected) =====

// Help Request Admin Routes
router.get('/admin/help-requests', overseerAuth, compassionController.getAllHelpRequests);
router.get('/admin/help-request/:id', overseerAuth, compassionController.getHelpRequest);
router.put('/admin/help-request', overseerAuth, compassionController.updateHelpRequest);
router.delete('/admin/help-request/:id', overseerAuth, compassionController.deleteHelpRequest);

// Donation Admin Routes
router.get('/admin/donations', overseerAuth, compassionController.getAllDonations);
router.get('/admin/donation/:id', overseerAuth, compassionController.getDonation);
router.put('/admin/donation', overseerAuth, compassionController.updateDonation);
router.delete('/admin/donation/:id', overseerAuth, compassionController.deleteDonation);

// Dashboard Statistics
router.get('/admin/stats', overseerAuth, compassionController.getDashboardStats);

// Admin Settings Routes
router.get('/admin/settings', overseerAuth, compassionController.getAllSettings);
router.put('/admin/settings/payment-methods', overseerAuth, compassionController.updatePaymentMethods);
router.put('/admin/settings/contact-info', overseerAuth, compassionController.updateContactInfo);
router.post('/admin/settings/payment-method', overseerAuth, compassionController.addPaymentMethod);
router.post('/admin/settings/contact-info', overseerAuth, compassionController.addContactInfo);

module.exports = router;
