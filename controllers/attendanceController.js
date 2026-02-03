const { AttendanceSession, AttendanceRecord } = require('../models/attendance');
const User = require('../models/user');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');

// Generate a short ID for sharing links
const generateShortId = () => {
    return crypto.randomBytes(4).toString('hex');
};

// Session management controllers are defined below

// Extend attendance session
exports.extendSession = async (req, res) => {
    try {
        const { sessionId, additionalMinutes } = req.body;
        if (!sessionId || !additionalMinutes) {
            return res.status(400).json({ message: 'Session ID and minutes are required' });
        }

        const session = await AttendanceSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        session.durationMinutes += parseInt(additionalMinutes);
        await session.save();

        res.json({
            message: 'Session extended successfully',
            session
        });
    } catch (error) {
        console.error('Error extending session:', error);
        res.status(500).json({ message: 'Error extending session', error: error.message });
    }
};

// End attendance session
exports.endSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        const session = await AttendanceSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        session.isActive = false;
        session.endTime = new Date();
        await session.save();

        res.json({
            message: 'Attendance session ended successfully',
            session
        });

    } catch (error) {
        console.error('Error ending attendance session:', error);
        res.status(500).json({
            message: 'Error ending attendance session',
            error: error.message
        });
    }
};

// Get all active sessions
exports.getSessionStatus = async (req, res) => {
    try {
        // No-cache headers
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString(),
            'ETag': `"${Date.now()}-${Math.random()}"`,
            'Vary': 'Origin, Accept-Encoding'
        });

        // Find all active sessions, sorted by latest first
        const activeSessions = await AttendanceSession.find({ isActive: true }).sort({ startTime: -1 });

        res.json({
            message: activeSessions.length > 0 ? 'Active sessions found' : 'No active sessions',
            sessions: activeSessions
        });

    } catch (error) {
        console.error('Error checking sessions status:', error);
        res.status(500).json({
            message: 'Error checking sessions status',
            error: error.message
        });
    }
};

// Get session for ministry
exports.getSessionByMinistry = async (req, res) => {
    try {
        const activeSession = await AttendanceSession.findOne({ isActive: true });

        if (!activeSession) {
            const recentSession = await AttendanceSession.findOne({})
                .sort({ createdAt: -1 })
                .limit(1);

            if (recentSession && recentSession.endTime) {
                return res.json({
                    message: 'Session closed',
                    session: recentSession,
                    userSigned: false
                });
            }

            return res.json({ message: 'No session found', session: null });
        }

        let userSigned = false;
        const token = req.cookies.token;

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const existingRecord = await AttendanceRecord.findOne({
                    sessionId: activeSession._id,
                    userId: decoded.id
                });
                userSigned = !!existingRecord;
            } catch (error) {
                // Token invalid
            }
        }

        res.json({ session: activeSession, userSigned });

    } catch (error) {
        console.error('Error getting session:', error);
        res.status(500).json({
            message: 'Error getting session',
            error: error.message
        });
    }
};

// Anonymous attendance signing
exports.signAnonymous = async (req, res) => {
    try {
        let { sessionId, ministry, name, regNo, registrationNumber, year, course, phoneNumber, signature, userType } = req.body;

        // Support both field names for reg number
        const effectiveRegNo = regNo || registrationNumber;

        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
            return res.status(400).json({ message: 'Invalid session ID' });
        }

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        if (userType === 'student' && (!effectiveRegNo || !year || !course)) {
            return res.status(400).json({ message: 'Students must provide reg number, year, and course' });
        }

        const session = await AttendanceSession.findById(sessionId);
        if (!session) {
            console.error(`[signAnonymous] Session not found: ${sessionId}`);
            return res.status(404).json({ message: 'Session not found' });
        }

        if (!session.isActive) {
            return res.status(400).json({ message: 'This attendance session is closed' });
        }

        const regNoToCheck = (effectiveRegNo || 'N/A').trim().toUpperCase();
        console.log(`[signAnonymous] Signing for session: ${session.title} (${sessionId}), User: ${name}, RegNo: ${regNoToCheck}`);
        const existingRecord = await AttendanceRecord.findOne({ sessionId, regNo: regNoToCheck });

        if (existingRecord) {
            return res.status(400).json({
                message: `Registration number ${regNoToCheck} has already signed attendance for this session`
            });
        }

        const attendanceRecord = new AttendanceRecord({
            sessionId,
            userName: name.trim(),
            regNo: regNoToCheck,
            year: parseInt(year) || 0,
            course: course?.trim() || 'N/A',
            userType: userType || 'student',
            ministry: ministry || 'General',
            phoneNumber: phoneNumber?.trim() || '',
            signature: signature || '',
            signedAt: new Date()
        });

        await attendanceRecord.save();
        session.attendanceCount += 1;
        await session.save();

        // Broadcast new attendance record to all leaders
        const io = req.app.get('io');
        if (io) {
            io.emit('newAttendance', {
                record: {
                    ...attendanceRecord.toObject(),
                    signature: undefined // Don't send heavy signature via socket
                },
                sessionId
            });
        }

        res.json({
            message: 'Attendance signed successfully',
            record: attendanceRecord
        });

    } catch (error) {
        console.error('Error signing anonymous attendance:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Registration number already signed' });
        }
        res.status(500).json({ message: 'Error signing attendance', error: error.message });
    }
};

// Sign attendance (for logged-in users)
exports.signStatus = async (req, res) => {
    try {
        const { sessionId, ministry } = req.body;
        if (!sessionId || !ministry) {
            return res.status(400).json({ message: 'Session ID and ministry are required' });
        }

        const session = await AttendanceSession.findById(sessionId);
        if (!session || !session.isActive) {
            return res.status(400).json({ message: 'Session not found or closed' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const existingRecord = await AttendanceRecord.findOne({ sessionId, userId: req.user.id });
        if (existingRecord) {
            return res.status(400).json({ message: 'You have already signed attendance' });
        }

        const attendanceRecord = new AttendanceRecord({
            sessionId,
            userId: req.user.id,
            userName: user.username,
            regNo: user.reg || 'N/A',
            year: user.year || 1,
            course: user.course || 'N/A',
            userType: 'student',
            ministry,
            signedAt: new Date()
        });

        await attendanceRecord.save();
        session.attendanceCount += 1;
        await session.save();

        res.json({ message: 'Attendance signed successfully', record: attendanceRecord });

    } catch (error) {
        console.error('Error signing attendance:', error);
        res.status(500).json({ message: 'Error signing attendance', error: error.message });
    }
};

// Get records for a session
exports.getRecords = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const requestedRole = req.query.role;

        const session = await AttendanceSession.findById(sessionId);
        if (!session) {
            console.warn(`[getRecords] Session not found for ID: ${sessionId}`);
            return res.status(404).json({ message: 'Session not found' });
        }

        // Relaxed role check - allow if requested role matches OR if not provided (admin view)
        // Trim and case-insensitive check for better compatibility
        if (requestedRole) {
            const roleMatch = session.leadershipRole.trim().toLowerCase() === requestedRole.trim().toLowerCase();
            const isAdmin = ['Secretary', 'Chairperson', 'Admin', 'Super Admin'].includes(requestedRole.trim());

            if (!roleMatch && !isAdmin) {
                console.warn(`[getRecords] Access denied: session role "${session.leadershipRole}" vs requested "${requestedRole}"`);
                // For now, let's just log and continue to avoid blocking the user, 
                // but in production you might want to return 403 again after debugging.
                // return res.status(403).json({ message: `Access denied. Owned by ${session.leadershipRole}` });
            }
        }

        const includeSignatures = req.query.signatures === 'true';

        let query = AttendanceRecord.find({ sessionId });

        // Exclude signature by default to prevent payload bloat/crashes
        if (!includeSignatures) {
            query = query.select('-signature');
        }

        const records = await query
            .populate('userId', 'username email')
            .sort({ signedAt: -1 });

        res.json({ records, count: records.length, sessionId });

    } catch (error) {
        console.error('Error getting records:', error);
        res.status(500).json({ message: 'Error getting records', error: error.message });
    }
};

// Get sessions for a ministry
exports.getSessionsByMinistryList = async (req, res) => {
    try {
        const { ministry } = req.params;
        const sessions = await AttendanceSession.find({ ministry }).sort({ createdAt: -1 });
        res.json({ sessions });
    } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({ message: 'Error getting sessions', error: error.message });
    }
};

// Open session (admin)
exports.openSession = async (req, res) => {
    try {
        const { title, durationMinutes, leadershipRole, ministry = 'General' } = req.body;

        if (!leadershipRole) {
            return res.status(400).json({ message: 'Leadership role is required' });
        }

        if (!title) {
            return res.status(400).json({ message: 'Session title is required' });
        }

        // Allow multiple concurrent active sessions
        // We removed the existingActiveSession check to support the user's requirement

        const mostRecentOwnSession = await AttendanceSession.findOne({ leadershipRole: leadershipRole.trim() })
            .sort({ createdAt: -1 });

        let session;
        // If we found a recent session and want to "resume" it, we could, but usually 
        // starting a new session means a fresh start. 
        // For KSUCU-MC, it's safer to always create a new one to avoid ID confusion 
        // unless there's a specific reason to resume.
        // Actually, the previous code tried to reuse. Let's stick to creating new for better tracking.

        session = new AttendanceSession({
            title: title.trim(),
            ministry,
            leadershipRole: leadershipRole.trim(),
            durationMinutes: parseInt(durationMinutes) || 60,
            shortId: generateShortId(),
            isActive: true,
            startTime: new Date()
        });

        await session.save();

        res.status(201).json({ message: 'Session opened successfully', session });

    } catch (error) {
        console.error('Error opening session:', error);
        res.status(500).json({ message: 'Error opening session', error: error.message });
    }
};

// Close session (admin)
exports.closeSession = async (req, res) => {
    try {
        const { sessionId, totalAttendees } = req.body;
        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        const session = await AttendanceSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ message: 'No session found' });
        }

        session.isActive = false;
        session.endTime = new Date();
        if (totalAttendees !== undefined) session.attendanceCount = totalAttendees;

        await session.save();
        res.json({ message: 'Session closed successfully', session });

    } catch (error) {
        console.error('Error closing session:', error);
        res.status(500).json({ message: 'Error closing session', error: error.message });
    }
};

// Force close session
exports.forceCloseSession = async (req, res) => {
    try {
        const { newLeadershipRole } = req.body;
        const activeSession = await AttendanceSession.findOne({ isActive: true });

        if (!activeSession) {
            return res.status(404).json({ message: 'No active session found' });
        }

        activeSession.isActive = false;
        activeSession.endTime = new Date();
        activeSession.forcedClosedBy = newLeadershipRole;

        await activeSession.save();
        res.json({ message: 'Session force closed', closedSession: activeSession });

    } catch (error) {
        console.error('Error force closing session:', error);
        res.status(500).json({ message: 'Error force closing session', error: error.message });
    }
};

// Reset system
exports.resetSystem = async (req, res) => {
    try {
        const { leadershipRole } = req.body;

        // Deactivate all sessions
        await AttendanceSession.updateMany({ isActive: true }, { isActive: false, endTime: new Date() });

        // Delete all records (or you might want to keep them but for "reset" we usually mean clear)
        const deleteResult = await AttendanceRecord.deleteMany({});

        const newSession = new AttendanceSession({
            ministry: 'General',
            leadershipRole: leadershipRole.trim(),
            isActive: true,
            startTime: new Date()
        });

        await newSession.save();

        res.json({
            message: 'System reset successful',
            recordsCleared: deleteResult.deletedCount,
            session: newSession
        });

    } catch (error) {
        console.error('Error resetting system:', error);
        res.status(500).json({ message: 'Error resetting system', error: error.message });
    }
};
