const express = require('express');
const router = express.Router();
const overseerController = require('../controllers/overseerController');
const { overseerAuth } = require('../middlewares/overseerAuthMiddleware');

router.post('/login', overseerController.login);
router.get('/verify', overseerAuth, overseerController.verify);
router.post('/logout', overseerAuth, overseerController.logout);

module.exports = router;
