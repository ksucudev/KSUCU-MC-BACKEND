const express = require('express');
const router = express.Router();
const superAdmin = require('../controllers/superAdmin');
const superAdminMiddleware = require('../middlewares/superAdmin');
const adminManager = require('../controllers/adminManager');

// Authentication routes
router.post('/signup', superAdmin.signup);
router.post('/login', superAdmin.login);
router.get('/verify', superAdminMiddleware, superAdmin.verify);

router.post('/logout', superAdminMiddleware, superAdmin.logout);

router.get('/users', superAdminMiddleware, superAdmin.getUsers);
router.get('/feedback', superAdminMiddleware, superAdmin.getFeedback);
router.get('/messages', superAdminMiddleware, superAdmin.getMessages);
router.post('/reset-polling', superAdminMiddleware, superAdmin.resetPollingData);

// Admin management routes
router.get('/admins/:type', superAdminMiddleware, adminManager.getAll);
router.post('/admins/:type', superAdminMiddleware, adminManager.create);
router.put('/admins/:type/:id/reset-password', superAdminMiddleware, adminManager.resetPassword);
router.delete('/admins/:type/:id', superAdminMiddleware, adminManager.deleteAdmin);

module.exports = router;

