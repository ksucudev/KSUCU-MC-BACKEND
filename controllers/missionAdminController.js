const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Soul = require('../models/savedSouls'); 
const missionAdmin = require('../models/missionAdmin')

// User signup
exports.signup = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        const existingUser = await missionAdmin.findOne({ $or: [{ email }, { phone }] });

        if (existingUser) {
            return res.status(400).json({ message: 'Email/Phone already exists' });
        }

        if (!password || !email || !phone) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new missionAdmin({
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

        const user = await missionAdmin.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_USER_SECRET, { expiresIn: '1h' });

        // Clear user session cookies to avoid conflicts
        res.clearCookie('user_s');
        res.clearCookie('socket_token');

        res.cookie('missions_token', token, {
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

exports.getSoulsSaved = async (req, res) => {
    try {
        const savedSouls = await Soul.find();  // Fetch all saved souls from the database
        res.status(200).json(savedSouls);  // Send back the data as JSON
      } catch (error) {
        console.error('Error fetching saved souls:', error);
        res.status(500).json({ error: 'Failed to fetch saved souls' });
      }
};

exports.logout = async (req, res) => {
    try {
      res.clearCookie('token'); 
      res.clearCookie('missions_token'); 
      return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Error during logout:', error);
      return res.status(500).json({ message: 'An error occurred while processing your request' });
    }
};

