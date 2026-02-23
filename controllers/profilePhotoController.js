const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const User = require('../models/user');

// Configure multer for memory storage (we'll process before saving)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|heic/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files (JPEG, PNG, WebP) are allowed!'));
    }
}).single('profilePhoto');

// Upload and process profile photo
exports.uploadProfilePhoto = async (req, res) => {
    try {
        // Handle file upload
        upload(req, res, async (err) => {
            if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const userId = req.userId || req.body.userId;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            try {
                // Generate filename
                const filename = `${userId}.webp`;
                const uploadDir = path.join(__dirname, '../uploads/profile-photos');
                const filepath = path.join(uploadDir, filename);

                // Ensure directory exists
                await fs.mkdir(uploadDir, { recursive: true });

                // Process and compress image
                await sharp(req.file.buffer)
                    .resize(300, 300, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .webp({ quality: 80 })
                    .toFile(filepath);

                // Update user document
                const photoUrl = `/uploads/profile-photos/${filename}`;
                await User.findByIdAndUpdate(userId, {
                    profilePhoto: photoUrl
                });

                res.json({
                    success: true,
                    message: 'Profile photo uploaded successfully',
                    photoUrl: photoUrl
                });

            } catch (processError) {
                console.error('Image processing error:', processError);
                res.status(500).json({
                    success: false,
                    message: 'Error processing image'
                });
            }
        });

    } catch (error) {
        console.error('Upload controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error uploading photo'
        });
    }
};

// Get user profile photo
exports.getProfilePhoto = async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId).select('profilePhoto');

        if (!user || !user.profilePhoto) {
            return res.status(404).json({
                success: false,
                message: 'Profile photo not found'
            });
        }

        res.json({
            success: true,
            photoUrl: user.profilePhoto
        });

    } catch (error) {
        console.error('Get profile photo error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving profile photo'
        });
    }
};

// Delete profile photo
exports.deleteProfilePhoto = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const user = await User.findById(userId);

        if (!user || !user.profilePhoto) {
            return res.status(404).json({
                success: false,
                message: 'No profile photo to delete'
            });
        }

        // Delete file
        const filename = `${userId}.webp`;
        const filepath = path.join(__dirname, '../uploads/profile-photos', filename);

        try {
            await fs.unlink(filepath);
        } catch (fileError) {
            console.log('File already deleted or not found');
        }

        // Update user document
        await User.findByIdAndUpdate(userId, {
            profilePhoto: null
        });

        res.json({
            success: true,
            message: 'Profile photo deleted successfully'
        });

    } catch (error) {
        console.error('Delete profile photo error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting profile photo'
        });
    }
};
