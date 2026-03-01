const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bsUsers = require('../models/biblestudy'); 
const bsAdmin = require('../models/bsAdmin');
const Residence = require('../models/residence');

// User signup
exports.signup = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        const existingUser = await bsAdmin.findOne({ $or: [{ email }, { phone }] });

        if (existingUser) {
            return res.status(400).json({ message: 'Email/Phone already exists' });
        }

        if (!password || !email || !phone) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new bsAdmin({
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

        const user = await bsAdmin.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_USER_SECRET, { expiresIn: '1h' });

        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
        
        // Clear user session cookies to avoid conflicts
        res.clearCookie('user_s');
        res.clearCookie('socket_token');

        res.cookie('bs_token', token, {
            httpOnly: true,
            secure: !isDevelopment, // false in development, true in production
            maxAge: 1 * 60 * 60 * 1000, // 1 hour
            sameSite: isDevelopment ? 'lax' : 'None', // lax in development, None in production
        });

        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

exports.getSoulsSaved = async (req, res) => {
    try {
        const User = await bsUsers.find();  // Fetch all saved souls from the database
        res.status(200).json(User);  // Send back the data as JSON
      } catch (error) {
        console.error('Error fetching saved souls:', error);
        res.status(500).json({ error: 'Failed to fetch saved souls' });
      }
};

// Update pastor status for a Bible Study user (admin only)
exports.updatePastorStatus = async (req, res) => {
    try {
        const { phone } = req.params;
        const { isPastor } = req.body;
        
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        if (typeof isPastor !== 'boolean') {
            return res.status(400).json({ message: 'Pastor status must be true or false' });
        }

        const updatedUser = await bsUsers.findOneAndUpdate(
            { phone },
            { isPastor },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`Bible Study user pastor status updated: ${updatedUser.name} (${updatedUser.phone}) - Pastor: ${isPastor}`);
        res.status(200).json({ 
            message: `User ${isPastor ? 'marked as pastor' : 'unmarked as pastor'} successfully`,
            user: {
                name: updatedUser.name,
                phone: updatedUser.phone,
                isPastor: updatedUser.isPastor
            }
        });
    } catch (error) {
        console.error('Error updating pastor status:', error);
        res.status(500).json({ 
            error: 'Failed to update pastor status',
            message: error.message 
        });
    }
};

// Delete a Bible Study user (admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { phone } = req.params;
        
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const deletedUser = await bsUsers.findOneAndDelete({ phone });

        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`Bible Study user deleted: ${deletedUser.name} (${deletedUser.phone})`);
        res.status(200).json({ 
            message: 'User removed from Bible Study successfully',
            deletedUser: {
                name: deletedUser.name,
                phone: deletedUser.phone
            }
        });
    } catch (error) {
        console.error('Error deleting Bible Study user:', error);
        res.status(500).json({ 
            error: 'Failed to delete user',
            message: error.message 
        });
    }
};

exports.logout = async (req, res) => {
    try {
      res.clearCookie('token'); 
      res.clearCookie('bs_token'); 
      return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Error during logout:', error);
      return res.status(500).json({ message: 'An error occurred while processing your request' });
    }
};

// Get all residences (public route for user side)
exports.getResidences = async (req, res) => {
    try {
        const residences = await Residence.find({ isActive: true }).sort({ name: 1 });
        console.log(`Fetching residences: Found ${residences.length} active residences`);
        res.status(200).json(residences);
    } catch (error) {
        console.error('Error fetching residences:', error);
        res.status(500).json({ 
            error: 'Failed to fetch residences',
            message: error.message 
        });
    }
};

// Add new residence (admin only)
exports.addResidence = async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Residence name is required' });
        }

        const existingResidence = await Residence.findOne({ 
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
        });

        if (existingResidence) {
            return res.status(400).json({ message: 'Residence with this name already exists' });
        }

        const newResidence = new Residence({
            name: name.trim(),
            description: description || ''
        });

        await newResidence.save();
        res.status(201).json({ message: 'Residence added successfully', residence: newResidence });
    } catch (error) {
        console.error('Error adding residence:', error);
        res.status(500).json({ error: 'Failed to add residence' });
    }
};

// Update residence (admin only)
exports.updateResidence = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Residence name is required' });
        }

        const existingResidence = await Residence.findOne({ 
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingResidence) {
            return res.status(400).json({ message: 'Residence with this name already exists' });
        }

        const updatedResidence = await Residence.findByIdAndUpdate(
            id,
            { 
                name: name.trim(),
                description: description || '',
                isActive: isActive !== undefined ? isActive : true
            },
            { new: true }
        );

        if (!updatedResidence) {
            return res.status(404).json({ message: 'Residence not found' });
        }

        res.status(200).json({ message: 'Residence updated successfully', residence: updatedResidence });
    } catch (error) {
        console.error('Error updating residence:', error);
        res.status(500).json({ error: 'Failed to update residence' });
    }
};

// Delete residence (admin only)
exports.deleteResidence = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedResidence = await Residence.findByIdAndDelete(id);

        if (!deletedResidence) {
            return res.status(404).json({ message: 'Residence not found' });
        }

        res.status(200).json({ message: 'Residence deleted successfully' });
    } catch (error) {
        console.error('Error deleting residence:', error);
        res.status(500).json({ error: 'Failed to delete residence' });
    }
};
