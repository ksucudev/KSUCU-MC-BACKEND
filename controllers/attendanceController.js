const { AttendanceSession, AttendanceRecord } = require('../models/attendance');
const User = require('../models/user');
const jwt = require('jsonwebtoken');

// Start attendance session
exports.startSession = async (req, res) => {
    try {
        const { ministry } = req.body;
        if (!ministry) {
            return res.status(400).json({ message: 'Ministry is required' });
        }

        const existingSession = await AttendanceSession.findOne({
            ministry,
            isActive: true
        });

        if (existingSession) {
            return res.status(400).json({
                message: 'There is already an active session for this ministry'
            });
        }

        const session = new AttendanceSession({
            ministry,
            isActive: true,
            startTime: new Date()
        });

        await session.save();
        res.status(201).json({
            message: 'Attendance session started successfully',
            session
        });

    } catch (error) {
        console.error('Error starting attendance session:', error);
        res.status(500).json({
            message: 'Error starting attendance session',
            error: error.message
        });
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

// Get current active session status
exports.getSessionStatus = async (req, res) => {
    try {
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

        const activeSession = await AttendanceSession.findOne({ isActive: true });

        if (!activeSession) {
            return res.json({ message: 'No active session', session: null });
        }

        if (requestedRole) {
            const normalizedRequested = requestedRole.trim().toLowerCase();
            const normalizedOwner = activeSession.leadershipRole.trim().toLowerCase();

            if (normalizedRequested !== normalizedOwner) {
                return res.json({
                    message: 'Active session exists but not owned by you',
                    session: {
                        _id: activeSession._id,
                        leadershipRole: activeSession.leadershipRole,
                        isActive: activeSession.isActive,
                        startTime: activeSession.startTime,
                        isOwnedByRequester: false
                    }
                });
            }
        }

        const attendanceCount = await AttendanceRecord.countDocuments({
            sessionId: activeSession._id
        });

        res.json({
            message: 'Active session found',
            session: {
                _id: activeSession._id,
                leadershipRole: activeSession.leadershipRole,
                ministry: activeSession.ministry,
                isActive: activeSession.isActive,
                startTime: activeSession.startTime,
                endTime: activeSession.endTime,
                attendanceCount: attendanceCount,
                isOwnedByRequester: true
            }
        });

    } catch (error) {
        console.error('Error checking session status:', error);
        res.status(500).json({
            message: 'Error checking session status',
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
        const { sessionId, ministry, name, regNo, year, course, phoneNumber, signature, userType } = req.body;

        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
            return res.status(400).json({ message: 'Invalid session ID' });
        }

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        if (userType === 'student' && (!regNo || !year || !course)) {
            return res.status(400).json({ message: 'Students must provide reg number, year, and course' });
        }

        const session = await AttendanceSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        if (!session.isActive) {
            return res.status(400).json({ message: 'This attendance session is closed' });
        }

        const regNoToCheck = regNo.trim().toUpperCase();
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
            return res.status(404).json({ message: 'Session not found' });
        }

        if (requestedRole && session.leadershipRole !== requestedRole) {
            return res.status(403).json({ message: `Access denied. Owned by ${session.leadershipRole}` });
        }

        const records = await AttendanceRecord.find({ sessionId })
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
        const { leadershipRole, ministry = 'General' } = req.body;
        if (!leadershipRole) {
            return res.status(400).json({ message: 'Leadership role is required' });
        }

        const existingActiveSession = await AttendanceSession.findOne({ isActive: true });
        if (existingActiveSession) {
            return res.status(409).json({
                message: 'Another session is already active',
                activeSession: existingActiveSession
            });
        }

        const mostRecentOwnSession = await AttendanceSession.findOne({ leadershipRole: leadershipRole.trim() })
            .sort({ createdAt: -1 });

        let session;
        if (mostRecentOwnSession && !mostRecentOwnSession.isActive) {
            mostRecentOwnSession.isActive = true;
            mostRecentOwnSession.ministry = ministry;
            mostRecentOwnSession.startTime = new Date();
            mostRecentOwnSession.endTime = undefined;
            session = await mostRecentOwnSession.save();
        } else {
            session = new AttendanceSession({
                ministry,
                leadershipRole: leadershipRole.trim(),
                isActive: true,
                startTime: new Date()
            });
            await session.save();
        }

        res.status(201).json({ message: 'Session opened successfully', session });

    } catch (error) {
        console.error('Error opening session:', error);
        res.status(500).json({ message: 'Error opening session', error: error.message });
    }
};

// Close session (admin)
exports.closeSession = async (req, res) => {
    try {
        const { leadershipRole, totalAttendees } = req.body;
        const session = await AttendanceSession.findOne({ isActive: true });

        if (!session) {
            return res.status(404).json({ message: 'No active session found' });
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
