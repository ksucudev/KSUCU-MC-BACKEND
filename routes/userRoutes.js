const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const userAuthMiddleware = require('../middlewares/userAuthMiddleware')
const superAdminMiddleware = require('../middlewares/superAdmin')

router.post('/login', userController.login);
router.post('/signup', userController.signup);
router.post('/check-exists', userController.checkUserExists);
router.post('/save-soul', userAuthMiddleware, userController.saveSoul);
router.post('/bibleStudy', userController.bibleStudy);
router.get('/countSaved', userController.countSaved);
router.get('/data', userAuthMiddleware, userController.getUserData);
router.put('/update', userAuthMiddleware, userController.updateUserData);
router.post('/verify-password', userAuthMiddleware, userController.verifyPassword);
router.post('/logout', userController.logout)
router.post('/forget-password', userController.forgetPassword);
router.post('/reset-password', userController.resetPassword)
router.post('/recomendations', userAuthMiddleware, userController.feedback)

router.get('/search', userController.searchUsers);
router.post('/advance-years', superAdminMiddleware, userController.advanceYears);

module.exports = router;
