const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { overseerAuth } = require('../middlewares/overseerAuthMiddleware');

router.get('/media-items', mediaController.getAllMediaItems);

router.post('/media-items', overseerAuth, mediaController.createMediaItem);

router.put('/media-items/:id', overseerAuth, mediaController.updateMediaItem);

router.delete('/media-items/:id', overseerAuth, mediaController.deleteMediaItem);

router.post('/media-items/migrate', overseerAuth, mediaController.migrateFromLocalStorage);

router.post('/media-items/upload-image', overseerAuth, mediaController.uploadImage);

module.exports = router;
