const express = require('express');
const router = express.Router();
const financeAuth = require('../../middlewares/financeAuth');
const financeMemberAuth = require('../../middlewares/financeMemberAuth');
const mpesaController = require('../../controllers/finance/mpesaController');
const transactionController = require('../../controllers/finance/transactionController');

// Auth middleware that accepts member OR admin/patron tokens for status checks
const jwt = require('jsonwebtoken');
const anyAuth = (req, res, next) => {
  // Try sadmin_token
  const adminToken = req.cookies.sadmin_token;
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, process.env.JWT_ADMIN_SECRET);
      req.user = { id: decoded.userId, role: 'admin' };
      return next();
    } catch {}
  }
  // Try patron_token
  const patronToken = req.cookies.patron_token;
  if (patronToken) {
    try {
      const decoded = jwt.verify(patronToken, process.env.JWT_ADMIN_SECRET);
      req.user = { id: decoded.userId, role: 'patron' };
      return next();
    } catch {}
  }
  // Try user_s (member)
  const userToken = req.cookies.user_s;
  if (userToken) {
    try {
      const decoded = jwt.verify(userToken, process.env.JWT_USER_SECRET);
      req.user = { id: decoded.userId };
      return next();
    } catch {}
  }
  return res.status(401).json({ message: 'Authentication required.' });
};

// Member endpoints (uses user_s cookie, not admin auth)
router.get('/my-contributions', financeMemberAuth, transactionController.getMyContributions);
router.post('/member-pay', financeMemberAuth, mpesaController.memberPayment);
router.get('/mpesa/status/:checkoutRequestID', anyAuth, mpesaController.checkStatus);

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
