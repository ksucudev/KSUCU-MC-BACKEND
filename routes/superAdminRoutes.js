const express = require('express');
const router = express.Router();
const superAdmin = require('../controllers/superAdmin');
const superAdminMiddleware = require('../middlewares/superAdmin');

// Authentication routes
router.post('/signup', superAdmin.signup);
router.post('/login', superAdmin.login);
router.get('/verify', superAdminMiddleware, superAdmin.verify);

router.post('/logout', superAdminMiddleware, superAdmin.logout);

router.get('/users', superAdminMiddleware, superAdmin.getUsers);
router.get('/feedback', superAdminMiddleware, superAdmin.getFeedback);
router.get('/messages', superAdminMiddleware, superAdmin.getMessages);
router.post('/reset-polling', superAdminMiddleware, superAdmin.resetPollingData);

module.exports = router;

