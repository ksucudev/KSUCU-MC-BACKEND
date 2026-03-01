const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { overseerAuth } = require('../middlewares/overseerAuthMiddleware');

// Get all settings
router.get('/settings', settingsController.getAllSettings);

// Get single setting
router.get('/settings/:key', settingsController.getSetting);

// Update or create setting (admin)
router.put('/settings/:key', overseerAuth, settingsController.updateSetting);

// Delete setting (admin)
router.delete('/settings/:key', overseerAuth, settingsController.deleteSetting);

module.exports = router;
