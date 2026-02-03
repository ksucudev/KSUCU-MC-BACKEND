const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token specifically for attendance
const verifyToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// --- Attendance Session Routes ---

// Get current active session status
router.get('/session/status', attendanceController.getSessionStatus);

// Get session for ministry
router.get('/session/:ministry', attendanceController.getSessionByMinistry);

// Open new session (admin)
router.post('/session/open', attendanceController.openSession);

// Close active session (admin)
router.post('/session/close', attendanceController.closeSession);

// Extend session duration (admin)
router.post('/session/extend', attendanceController.extendSession);

// Force close any active session
router.post('/session/force-close', attendanceController.forceCloseSession);

// Reset session and clear records
router.post('/session/reset', attendanceController.resetSystem);


// --- Attendance Signing Routes ---

// Anonymous attendance signing
router.post('/sign-anonymous', attendanceController.signAnonymous);

// Sign attendance (for logged-in users)
router.post('/sign', verifyToken, attendanceController.signStatus);


// --- Attendance Record Routes ---

// Get attendance records for a session
router.get('/records/:sessionId', attendanceController.getRecords);

// Get all sessions for a ministry
router.get('/sessions/:ministry', attendanceController.getSessionsByMinistryList);

module.exports = router;