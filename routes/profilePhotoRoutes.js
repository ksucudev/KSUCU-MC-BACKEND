const express = require('express');
const router = express.Router();
const profilePhotoController = require('../controllers/profilePhotoController');
const verifyToken = require('../middlewares/userAuthMiddleware');

// Upload profile photo (authenticated users)
router.post('/upload-profile-photo', verifyToken, profilePhotoController.uploadProfilePhoto);

// Get user profile photo
router.get('/profile-photo/:userId', profilePhotoController.getProfilePhoto);

// Delete profile photo (authenticated users)
router.delete('/profile-photo', verifyToken, profilePhotoController.deleteProfilePhoto);

module.exports = router;
