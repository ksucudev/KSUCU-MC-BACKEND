const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const superAdminMiddleware = require('../middlewares/superAdmin');
const userAuthMiddleware = require('../middlewares/userAuthMiddleware');
const optionalAuth = require('../middlewares/optionalAuth');

// Public route - anyone can submit messages (anonymous or identified)
router.post('/', optionalAuth, messageController.submitMessage);

// User specific routes
router.get('/my-messages', userAuthMiddleware, messageController.getUserMessages);

// Overseer routes (Role-based)
router.get('/overseer/:role', messageController.getOverseerMessages);
router.put('/:id/reply', userAuthMiddleware, messageController.replyToMessage);
router.get('/:id/conversation', userAuthMiddleware, messageController.getConversation);

// Protected routes - maintain existing super admin functionality
router.get('/', superAdminMiddleware, messageController.getAllMessages);
router.put('/:id', superAdminMiddleware, messageController.updateMessageStatus);
router.delete('/:id', superAdminMiddleware, messageController.deleteMessage);

module.exports = router;
