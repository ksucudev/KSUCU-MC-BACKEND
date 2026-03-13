const express = require('express');
const router = express.Router();
const admissionAdminController = require('../controllers/admissionAdminController');
const admissionAdminMiddleware = require('../middlewares/admissionAdminMiddleware');

router.post('/login', admissionAdminController.login);
router.post('/create-admin', admissionAdminController.createAdmin);
router.post('/admit-user', admissionAdminMiddleware, admissionAdminController.admitUser);
router.get('/users', admissionAdminMiddleware, admissionAdminController.getAllUsers);
router.post('/reset-password', admissionAdminMiddleware, admissionAdminController.resetUserPassword);
router.put('/update-user/:userId', admissionAdminMiddleware, admissionAdminController.updateUser);
router.post('/logout', admissionAdminMiddleware, admissionAdminController.logout);

module.exports = router;