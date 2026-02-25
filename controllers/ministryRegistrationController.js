const MinistryRegistration = require('../models/MinistryRegistration');
const Commitment = require('../models/commitment');
const User = require('../models/user');
const { getRoleForMinistry } = require('../utils/ministryRoleMapping');

// Submit a new registration
exports.submitRegistration = async (req, res) => {
    try {
        const { fullName, registrationNumber, phoneNumber, gender, yearOfStudy, course, reasonForJoining, ministry } = req.body;
        const userId = req.userId;

        // Basic validation
        if (!fullName || !registrationNumber || !phoneNumber || !gender || !yearOfStudy || !course || !reasonForJoining || !ministry) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // 1. Authenticated User Verification
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userReg = (user.regNo || user.reg || '').toUpperCase().trim();
        if (registrationNumber.toUpperCase().trim() !== userReg) {
            return res.status(400).json({ error: 'Invalid registration number. Please use your registered account.' });
        }

        // 2. Phone number validation: numeric and at least 10 digits
        const isNumeric = /^\d+$/.test(phoneNumber.replace(/\s/g, ''));
        if (!isNumeric || phoneNumber.replace(/\s/g, '').length < 10) {
            return res.status(400).json({ error: 'Phone number must be at least 10 digits and contain only numbers.' });
        }

        // 3. Gender field restriction
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ error: 'Gender must be either Male or Female.' });
        }

        // 4. Multiple Ministry Memberships: uniqueness check on (registrationNumber + ministry)
        const normalizedMinistry = ministry.trim();
        const existingRegistration = await MinistryRegistration.findOne({
            registrationNumber: registrationNumber.toUpperCase().trim(),
            ministry: normalizedMinistry
        });

        if (existingRegistration) {
            return res.status(409).json({
                error: `You are already registered for the ${normalizedMinistry} ministry.`
            });
        }

        // Determine assigned_role based on ministry using central utility
        const assigned_role = getRoleForMinistry(normalizedMinistry);

        if (!assigned_role || assigned_role === 'Overseer') {
            // Log warning if role mapping is missing
            console.warn(`Warning: No specific role mapping found for ministry: "${normalizedMinistry}"`);
        }

        const newRegistration = new MinistryRegistration({
            fullName,
            registrationNumber: registrationNumber.toUpperCase().trim(),
            phoneNumber,
            gender,
            yearOfStudy,
            course,
            reasonForJoining,
            ministry: normalizedMinistry,
            assigned_role: assigned_role || 'Overseer', // Ensure not null
            form_type: 'join'
        });

        await newRegistration.save();

        res.status(201).json({ message: 'Registration submitted successfully', registration: newRegistration });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'You have already registered for this ministry.' });
        }
        res.status(500).json({ message: 'Error submitting registration', error: error.message });
    }
};

// Get registrations (Role-based access to be handled via middleware or checks here)
// For now, checks if user is overseer of the specific ministry
exports.getRegistrations = async (req, res) => {
    try {
        const { ministry } = req.params; // or req.query

        // TODO: Add role-based check here based on req.user (from auth middleware)
        // Example: if (req.user.role !== 'admin' && req.user.ministry !== ministry) return res.status(403).json(...)

        const registrations = await MinistryRegistration.find({ ministry }).sort({ createdAt: -1 });
        res.json(registrations);
    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Get all registrations (for admin/overseer dashboard)
exports.getAllRegistrations = async (req, res) => {
    try {
        // TODO: Add admin authentication check here

        const registrations = await MinistryRegistration.find()
            .sort({ createdAt: -1 });

        res.json(registrations);
    } catch (error) {
        console.error('Fetch All Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Get registrations by assigned role
exports.getRegistrationsByRole = async (req, res) => {
    try {
        const { role } = req.params;
        const decodedRole = decodeURIComponent(role);

        console.log(`Fetching registrations for role: ${decodedRole}`);

        const registrations = await MinistryRegistration.find({ assigned_role: decodedRole })
            .sort({ createdAt: -1 });

        res.json(registrations);
    } catch (error) {
        console.error('Fetch By Role Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Approve a registration
exports.approveRegistration = async (req, res) => {
    try {
        const { id } = req.params;

        const registration = await MinistryRegistration.findByIdAndUpdate(
            id,
            { status: 'approved', reviewedAt: new Date() },
            { new: true }
        );

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        res.json({ success: true, message: 'Registration approved.', registration });
    } catch (error) {
        console.error('Approve Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Reject a registration
exports.rejectRegistration = async (req, res) => {
    try {
        const { id } = req.params;

        const registration = await MinistryRegistration.findByIdAndUpdate(
            id,
            { status: 'rejected', reviewedAt: new Date() },
            { new: true }
        );

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        res.json({ success: true, message: 'Registration rejected.', registration });
    } catch (error) {
        console.error('Reject Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Check if user is already registered for a specific ministry
exports.checkRegistration = async (req, res) => {
    try {
        const { registrationNumber, ministry } = req.query;
        if (!registrationNumber || !ministry) {
            return res.status(400).json({ message: 'Registration number and ministry are required' });
        }

        const normalizedMinistry = ministry.trim();
        const searchRegNo = registrationNumber.toUpperCase().trim();

        // 1. Check specialized Commitment model
        let registration = await Commitment.findOne({
            regNo: searchRegNo,
            ministry: normalizedMinistry
        });

        // 2. If not found, check standard MinistryRegistration model
        if (!registration) {
            registration = await MinistryRegistration.findOne({
                registrationNumber: searchRegNo,
                ministry: normalizedMinistry
            });
        }

        res.json({
            registered: !!registration,
            status: registration ? registration.status : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Error checking registration', error: error.message });
    }
};
