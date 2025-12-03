const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const minutesController = require('../controllers/minutesController');
const superAdminMiddleware = require('../middlewares/superAdmin');

const router = express.Router();

// Set up multer for minutes uploads
const uploadDir = process.env.NODE_ENV === 'production'
  ? '/home/ken/ksucu-uploads/minutes/'
  : path.join(__dirname, '../uploads/minutes/');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'minutes-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types for minutes (PDF and Word documents)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX'));
    }
  }
});

// PIN routes (require super admin authentication)
router.get('/pin/status', superAdminMiddleware, minutesController.checkPinStatus);
router.post('/pin/setup', superAdminMiddleware, minutesController.setupPin);
router.post('/pin/verify', superAdminMiddleware, minutesController.verifyPin);

// All other routes require super admin authentication
router.use(superAdminMiddleware);

// Upload minutes document
router.post('/upload', upload.single('document'), minutesController.uploadMinutes);

// Get all minutes with optional filters
router.get('/', minutesController.getMinutes);

// Get minutes statistics
router.get('/stats/overview', minutesController.getMinutesStats);

// Get a single minute
router.get('/:id', minutesController.getMinuteById);

// Download minutes document
router.get('/:id/download', minutesController.downloadMinute);

// Update minutes (title, date, description, status)
router.put('/:id', minutesController.updateMinute);

// Archive minutes (soft delete)
router.post('/:id/archive', minutesController.archiveMinute);

// Delete minutes permanently
router.delete('/:id', minutesController.deleteMinute);

module.exports = router;
