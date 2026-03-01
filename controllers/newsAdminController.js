const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const User = require('../models/adminNews'); // Adjust the path to your model
const fs = require('fs');

// Dynamic upload directory based on environment
const uploadDir = process.env.NODE_ENV === 'production'
  ? '/var/www/uploads'
  : path.join(__dirname, '..', 'uploads');


// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Save file with current timestamp
    }
});


const upload = multer({ storage: storage }).single('image');

// User signup
exports.signup = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });

        if (existingUser) {
            return res.status(400).json({ message: 'Email/Phone already exists' });
        }

        if (!password || !email || !phone) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            password: hashedPassword,
            email,
            phone,
        });

        await newUser.save();

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

// User login
exports.login = async (req, res) => {
    try {
        let { email, password } = req.body;
        // email = email.toLowerCase();

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({email});
        if (!user) {
            console.log('No user found in the db', email);
            
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('Invalid pswd');
            
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_USER_SECRET, { expiresIn: '1h' });

        // Clear user session cookies to avoid conflicts
        res.clearCookie('user_s');
        res.clearCookie('socket_token');

        res.cookie('admins_token', token, {
            httpOnly: true,
            secure: true, // Set to true in production
            maxAge: 1 * 60 * 60 * 1000, // 3 hours
            sameSite: 'None', // Required for cross-site cookies
        });

        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

// File upload (photo, title, and body text)
    exports.uploadFile = (req, res) => {
        upload(req, res, async (err) => {
            if (err) {
                console.log(err);
                
                return res.status(500).json({ message: 'Error uploading file' });
            }

            const { title, body } = req.body;
            const image = req.file;

            if (!title || !body || !image) {
                return res.status(400).json({ message: 'All fields are required (title, body, and image)' });
            }

            try {
                const userId = req.userId;  // Extracted from JWT in the middleware
                
                // Find the user by ID
                const user = await User.findById(userId);

                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }

                // Check if user already has an image and delete it
                if (user.imageUrl) {
                    const oldImagePath = path.join(__dirname, '..', 'uploads', path.basename(user.imageUrl));
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);  // Delete the old image file
                    }
                }

                // Create the new image URL
                const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${image.filename}`;

                // Update the user with new title, body, and image URL
                user.title = title;
                user.body = body;
                user.imageUrl = imageUrl;
                await user.save();

                // Return a success response with the new image URL
                res.status(201).json({
                    message: 'File uploaded and previous image deleted successfully!',
                    imageUrl: imageUrl
                });
            } catch (error) {
                console.log(error);
                
                res.status(500).json({ message: 'Error saving data to the database' });
            }
        });
};

// exports.uploadFile = (req, res) => {
//     upload(req, res, async (err) => {
//         if (err) {
//             console.log(err);
//             return res.status(500).json({ message: 'Error uploading file' });
//         }

//         const { title, body } = req.body;
//         const image = req.file;

//         if (!title || !body || !image) {
//             return res.status(400).json({ message: 'All fields are required (title, body, and image)' });
//         }

//         try {
//             const userId = req.userId;  // Extracted from JWT in the middleware

//             // Find the user by ID
//             const user = await User.findById(userId);

//             if (!user) {
//                 return res.status(404).json({ message: 'User not found' });
//             }

//             // Check if user already has an image and delete it
//             if (user.imageUrl) {
//                 const oldImagePath = path.join(__dirname, '..', 'uploads', path.basename(user.imageUrl));
//                 if (fs.existsSync(oldImagePath)) {
//                     fs.unlinkSync(oldImagePath);  // Delete the old image file
//                 }
//             }

//             // Always create the image URL with HTTPS
//             const imageUrl = `http://${req.get('host')}/uploads/${image.filename}`;

//             // Update the user with new title, body, and image URL
//             user.title = title;
//             user.body = body;
//             user.imageUrl = imageUrl;
//             await user.save();

//             // Return a success response with the new image URL
//             res.status(201).json({
//                 message: 'File uploaded and previous image deleted successfully!',
//                 imageUrl: imageUrl
//             });
//         } catch (error) {
//             console.log(error);
//             res.status(500).json({ message: 'Error saving data to the database' });
//         }
//     });
// };


// Update news data via JSON (for the new admin interface)
exports.updateNewsData = async (req, res) => {
    try {
        const { title, body, eventDate, eventTime } = req.body;

        // Trim whitespace and check for empty values
        const trimmedTitle = title ? title.trim() : '';
        const trimmedBody = body ? body.trim() : '';
        
        if (!trimmedTitle || !trimmedBody) {
            return res.status(400).json({ message: 'Title and body are required' });
        }

        // Find existing news record or create a new one
        let user = await User.findOne();
        
        if (!user) {
            // Create new news record if none exists
            user = new User({
                email: 'admin@ksucu.com', // Placeholder
                phone: '0000000000', // Placeholder
                password: 'placeholder', // Placeholder
                title: trimmedTitle,
                body: trimmedBody,
                eventDate: eventDate ? new Date(eventDate) : null,
                eventTime: eventTime || null
            });
        } else {
            // Update existing record
            user.title = trimmedTitle;
            user.body = trimmedBody;
            user.eventDate = eventDate ? new Date(eventDate) : null;
            user.eventTime = eventTime || null;
        }

        await user.save();

        res.status(200).json({
            message: 'News updated successfully!',
            data: {
                title: user.title,
                body: user.body,
                eventDate: user.eventDate,
                eventTime: user.eventTime
            }
        });
    } catch (error) {
        console.error('Error updating news:', error);
        res.status(500).json({ message: 'Error updating news data' });
    }
};

// Fetch and send news data without verification
exports.getNewsData = async (req, res) => {
    try {
        // Fetch the user's news data (without verifying userId)
        const user = await User.findOne().select('title body eventDate eventTime');

        if (!user) {
            return res.status(404).json({ message: 'No news available' });
        }

        // Return the news data
        res.status(200).json({
            title: user.title,
            body: user.body,
            eventDate: user.eventDate,
            eventTime: user.eventTime
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching data' });
    }
};


exports.logout = async (req, res) => {
    try {
      res.clearCookie('token'); 
      res.clearCookie('admins_token'); 
      return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Error during logout:', error);
      return res.status(500).json({ message: 'An error occurred while processing your request' });
    }
  };