const express = require('express');
const router = express.Router();
const patron = require('../controllers/patron');
const patronMiddleware = require('../middlewares/patron');

router.post('/login', patron.login);
router.post('/logout', patronMiddleware, patron.logout);
router.get('/verify', patronMiddleware, patron.verify);
router.get('/users', patronMiddleware, patron.getUsers);
router.get('/messages', patronMiddleware, patron.getMessages);
router.get('/media', patronMiddleware, patron.getMedia);
router.post('/change-password', patronMiddleware, patron.changePassword);

module.exports = router;
