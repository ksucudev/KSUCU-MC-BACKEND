const express = require('express');
const router = express.Router();
const financeAuth = require('../../middlewares/financeAuth');
const financeMemberAuth = require('../../middlewares/financeMemberAuth');
const mpesaController = require('../../controllers/finance/mpesaController');
const transactionController = require('../../controllers/finance/transactionController');

// Member endpoints (uses user_s cookie, not admin auth)
router.get('/my-contributions', financeMemberAuth, transactionController.getMyContributions);
router.post('/member-pay', financeMemberAuth, mpesaController.memberPayment);
router.get('/mpesa/status/:checkoutRequestID', financeMemberAuth, mpesaController.checkStatus);

// M-Pesa callback (public, no auth - Safaricom calls this)
router.post('/mpesa/callback', mpesaController.callback);

// All other finance routes require admin/patron auth
router.use(financeAuth);

router.use('/transactions', require('./transactionRoutes'));
router.use('/requisitions', require('./requisitionRoutes'));
router.use('/assets', require('./assetRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/audit-logs', require('./auditRoutes'));
router.use('/mpesa', require('./mpesaRoutes'));
router.use('/users', require('./userRoutes'));

module.exports = router;
