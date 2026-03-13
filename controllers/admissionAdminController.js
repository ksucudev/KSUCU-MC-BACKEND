const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const AdmissionAdmin = require('../models/admissionAdmin');

// Admin login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const admin = await AdmissionAdmin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ adminId: admin._id }, process.env.JWT_ADMISSION_ADMIN_SECRET, { expiresIn: '2h' });

        // Clear user session cookies to avoid conflicts
        res.clearCookie('user_s');
        res.clearCookie('socket_token');

        res.cookie('admission_admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 2 * 60 * 60 * 1000, // 2 hours
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        });

        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error logging in', error });
    }
};

// Admin logout
exports.logout = (req, res) => {
    res.clearCookie('admission_admin_token', { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax'
    });
    res.status(200).json({ message: 'Logout successful' });
};

// Admit new user (equivalent to the old signup functionality)
exports.admitUser = async (req, res) => {
    try {
        const { username, email, yos, et, phone, ministry, course, reg } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { phone }, { reg }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Email/Phone/REG already exists' });
        }

        // Validate required fields (removed password from validation)
        if (!username || !email || !phone || !et || !yos || !reg || !ministry || !course) {
            return res.status(401).json({ message: 'All fields are required' });
        }

        console.log('Admitting new user:', {
            username,
            phone,
            ministry,
            reg,
            et,
            yos,
            email,
            course
        });

        // Use phone number as default password and hash it
        const hashedPassword = await bcrypt.hash(phone, 10);
        
        // Create new user directly (no email verification needed for admin admission)
        const newUser = new User({
            username,
            password: hashedPassword,
            email: email.toLowerCase(),
            et,
            phone,
            yos,
            reg,
            course,
            ministry
        });

        await newUser.save();
        
        res.status(201).json({ message: 'User admitted successfully!' });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error admitting user', error });
    }
};

// Get all users for management
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, 'username email phone course reg yos et ministry profilePhoto').sort({ username: 1 });
        res.status(200).json(users);
    } catch (error) {
        console.log('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

// Reset user password to their phone number
exports.resetUserPassword = async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        
        if (!userId || !newPassword) {
            return res.status(400).json({ message: 'User ID and new password are required' });
        }

        // Hash the new password (phone number)
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { password: hashedPassword },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User found' });
        }

        console.log(`Password reset for user ${updatedUser.username} (${updatedUser.email}) to: ${newPassword}`);
        
        res.status(200).json({ 
            message: 'Password reset successfully',
            newPassword: newPassword
        });
    } catch (error) {
        console.log('Error resetting password:', error);
        res.status(500).json({ message: 'Error resetting password', error });
    }
};

// Update user details (Admission Admin only)
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, email, phone, course, reg, yos, et, ministry } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Validate required fields
        if (!username || !email || !phone || !reg) {
            return res.status(400).json({ message: 'Name, Email, Phone, and REG number are required' });
        }

        // Check if email/phone/reg already exists for other users
        const existingUser = await User.findOne({
            _id: { $ne: userId },
            $or: [{ email: email.toLowerCase() }, { phone }, { reg }]
        });

        if (existingUser) {
            let conflictField = '';
            if (existingUser.email === email.toLowerCase()) conflictField = 'Email';
            else if (existingUser.phone === phone) conflictField = 'Phone';
            else if (existingUser.reg === reg) conflictField = 'REG number';
            
            return res.status(400).json({ message: `${conflictField} already exists for another user` });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                username,
                email: email.toLowerCase(),
                phone,
                course,
                reg,
                yos,
                et,
                ministry
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`User details updated by admin: ${updatedUser.username} (${updatedUser.email})`);
        
        res.status(200).json({ 
            message: 'User details updated successfully!',
            user: updatedUser
        });
    } catch (error) {
        console.log('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user details', error: error.message });
    }
};

// Create admission admin (for initial setup)
exports.createAdmin = async (req, res) => {
    try {
        const { email, password, phone } = req.body;
        
        if (!email || !password || !phone) {
            return res.status(400).json({ message: 'Email, password, and phone are required' });
        }

        // Check if admin already exists
        const existingAdmin = await AdmissionAdmin.findOne({ $or: [{ email }, { phone }] });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin with this email or phone already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new admin
        const newAdmin = new AdmissionAdmin({
            email,
            password: hashedPassword,
            phone
        });

        await newAdmin.save();
        
        res.status(201).json({ message: 'Admission admin created successfully' });
        
    } catch (error) {
        console.log('Error creating admin:', error);
        res.status(500).json({ message: 'Error creating admin', error });
    }
};