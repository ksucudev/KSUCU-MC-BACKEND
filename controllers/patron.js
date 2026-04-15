const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Patron = require('../models/patron');
const Users = require('../models/user');
const Message = require('../models/message');
const MediaItem = require('../models/MediaItem');

// Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Patron Login attempt - Email:', email);

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const patron = await Patron.findOne({ email: email.toLowerCase() });
        if (!patron) {
            console.log('Patron not found with email:', email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, patron.password);
        if (!isPasswordValid) {
            console.log('Invalid password for patron:', email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        console.log('Patron login successful for:', email);

        const token = jwt.sign({ userId: patron._id }, process.env.JWT_ADMIN_SECRET, { expiresIn: '4h' });

        // Clear other session cookies to avoid conflicts
        res.clearCookie('user_s');
        res.clearCookie('socket_token');
        res.clearCookie('sadmin_token');

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('patron_token', token, {
            httpOnly: true,
            secure: isProduction,
            maxAge: 4 * 60 * 60 * 1000,
            sameSite: isProduction ? 'None' : 'Lax',
        });

        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Patron login error:', error);
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

// Logout
exports.logout = (req, res) => {
    res.clearCookie('patron_token', { httpOnly: true, secure: true, sameSite: 'None' });
    res.status(200).json({ message: 'Logout successful' });
};

// Verify session
exports.verify = (req, res) => {
    res.status(200).json({ valid: true, message: 'Session is valid' });
};

// Get all users
exports.getUsers = async (req, res) => {
    try {
        const users = await Users.find({}, { password: 0, googleId: 0 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

// Get all messages/feedback
exports.getMessages = async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: -1 }).lean();
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};

// Get media items
exports.getMedia = async (req, res) => {
    try {
        const media = await MediaItem.find().sort({ createdAt: -1 }).lean();
        res.status(200).json(media);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching media', error: error.message });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new passwords are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }

        const patron = await Patron.findById(req.userId);
        if (!patron) {
            return res.status(404).json({ message: 'Patron account not found' });
        }

        const isValid = await bcrypt.compare(currentPassword, patron.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        patron.password = hashedPassword;
        await patron.save();

        console.log('Patron password changed successfully');
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing patron password:', error);
        res.status(500).json({ message: 'Error changing password', error: error.message });
    }
};
