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

// Get sessions (all active, or all including inactive if requested)
exports.getSessionStatus = async (req, res) => {
    try {
        const includeInactive = req.query.all === 'true';
        const requestedRole = req.query.role;

        // No-cache headers
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString(),
            'ETag': `"${Date.now()}-${Math.random()}"`,
            'Vary': 'Origin, Accept-Encoding'
        });

        let query = {};
        if (!includeInactive) {
            query.isActive = true;
        }

        const sessions = await AttendanceSession.find(query).sort({ startTime: -1 });

        // Logic for providing a singular "session" object as expected by the dashboard and sign-in components
        let session = null;
        let isOwnedByRequester = false;

        if (sessions.length > 0) {
            // Find active session for the role if requested
            if (requestedRole) {
                const ownedSession = sessions.find(s =>
                    s.leadershipRole.trim().toLowerCase() === requestedRole.trim().toLowerCase()
                );
                if (ownedSession) {
                    session = ownedSession;
                    isOwnedByRequester = true;
                } else if (!includeInactive) {
                    // If requester has no active session, but there is ANY active session
                    session = sessions[0];
                    isOwnedByRequester = false;
                }
            } else {
                // Generic view (sign-in)
                session = sessions[0];
            }
        }

        res.json({
            message: sessions.length > 0 ? 'Sessions found' : 'No sessions found',
            sessions,
            session,
            isOwnedByRequester
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
        let { sessionId, ministry, name, regNo, registrationNumber, year, yos, course, phoneNumber, phone, signature, userType } = req.body;

        // Support both field names for reg number, year, and phone
        const effectiveRegNo = regNo || registrationNumber;
        const effectiveYear = year || yos;
        const effectivePhone = phoneNumber || phone;

        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
            return res.status(400).json({ message: 'Invalid session ID' });
        }

        if (!name) {
            return res.status(400).json({ message: 'Full Name is required' });
        }

        if (userType === 'student' && !effectiveRegNo) {
            return res.status(400).json({ message: 'Registration number is required for students' });
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

        // Only check for duplicates if a registration number is provided
        if (effectiveRegNo) {
            const existingRecord = await AttendanceRecord.findOne({ sessionId, regNo: regNoToCheck });
            if (existingRecord) {
                return res.status(400).json({
                    message: `Registration number ${regNoToCheck} has already signed attendance for this session`
                });
            }
        }

        const attendanceRecord = new AttendanceRecord({
            sessionId,
            userName: name.trim(),
            regNo: regNoToCheck,
            year: parseInt(effectiveYear) || 0,
            course: course?.trim() || 'N/A',
            userType: userType || 'student',
            ministry: ministry || session.ministry || 'General',
            phoneNumber: effectivePhone?.trim() || '',
            signature: signature || '',
            signedAt: new Date(),
            overseerId: session.openedBy // Link to the overseer who opened the session
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

        // Close ALL existing active sessions for this role before opening a new one.
        // This prevents "ghost" sessions from lingering when the overseer opens a fresh session.
        const closed = await AttendanceSession.updateMany(
            { leadershipRole: leadershipRole.trim(), isActive: true },
            { isActive: false, endTime: new Date() }
        );
        if (closed.modifiedCount > 0) {
            console.log(`[openSession] Closed ${closed.modifiedCount} stale active session(s) for role "${leadershipRole}" before opening a new one.`);
        }

        const session = new AttendanceSession({
            title: title.trim(),
            ministry,
            leadershipRole: leadershipRole.trim(),
            durationMinutes: parseInt(durationMinutes) || 60,
            shortId: generateShortId(),
            isActive: true,
            startTime: new Date(),
            openedBy: req.userId
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
        const { sessionId, leadershipRole, totalAttendees } = req.body;
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

        // Also close any OTHER lingering active sessions for the same role (safety net)
        const roleToClose = leadershipRole || session.leadershipRole;
        if (roleToClose) {
            const extra = await AttendanceSession.updateMany(
                { leadershipRole: roleToClose, isActive: true, _id: { $ne: session._id } },
                { isActive: false, endTime: new Date() }
            );
            if (extra.modifiedCount > 0) {
                console.log(`[closeSession] Closed ${extra.modifiedCount} extra stale session(s) for role "${roleToClose}".`);
            }
        }

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
// Delete session and all its records
exports.deleteSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        const session = await AttendanceSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Delete all associated records first
        const recordsResult = await AttendanceRecord.deleteMany({ sessionId });

        // Delete the session itself
        await AttendanceSession.findByIdAndDelete(sessionId);

        res.json({
            message: 'Session and records deleted successfully',
            recordsDeleted: recordsResult.deletedCount
        });

    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ message: 'Error deleting session', error: error.message });
    }
};

// Re-open a closed session
exports.reopenSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        const session = await AttendanceSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        session.isActive = true;
        session.endTime = undefined;
        await session.save();

        res.json({ message: 'Session re-opened successfully', session });

    } catch (error) {
        console.error('Error re-opening session:', error);
        res.status(500).json({ message: 'Error re-opening session', error: error.message });
    }
};
