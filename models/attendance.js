const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    ministry: {
        type: String,
        required: true,
        enum: ['Praise and Worship', 'Choir', 'Wananzambe', 'Ushering', 'Creativity', 'Compassion', 'Intercessory', 'High School', 'Church School', 'General'],
        default: 'General'
    },
    leadershipRole: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    durationMinutes: {
        type: Number,
        default: 60 // Default 1 hour
    },
    shortId: {
        type: String,
        unique: true,
        sparse: true // Allow null for old sessions but unique for new ones
    },
    attendanceCount: {
        type: Number,
        default: 0
    },
    forcedClosedBy: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

const attendanceRecordSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceSession',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow null for anonymous attendance
    },
    userName: {
        type: String,
        required: true
    },
    regNo: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        enum: ['student', 'visitor'],
        default: 'student'
    },
    ministry: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: false
    },
    signature: {
        type: String,
        required: false
    },
    signedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Ensure a registration number can only sign once per session
attendanceRecordSchema.index({ sessionId: 1, regNo: 1 }, { unique: true });

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);
const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);

// FIX PRODUCTION DATABASE: Remove incorrect index and ensure correct one exists
async function fixDatabaseIndexes() {
    try {
        console.log('Checking and fixing database indexes...');

        // Get all indexes
        const indexes = await AttendanceRecord.collection.getIndexes();
        console.log('Current indexes:', Object.keys(indexes));

        // Remove the incorrect sessionId_1_userId_1 index if it exists
        const wrongIndexName = 'sessionId_1_userId_1';
        if (indexes[wrongIndexName]) {
            console.log(`Dropping incorrect index: ${wrongIndexName}`);
            await AttendanceRecord.collection.dropIndex(wrongIndexName);
            console.log(`Dropped incorrect index: ${wrongIndexName}`);
        }

        // Ensure the correct index exists
        try {
            await AttendanceRecord.collection.createIndex(
                { sessionId: 1, regNo: 1 },
                { unique: true, name: 'sessionId_1_regNo_1' }
            );
            console.log('Correct index (sessionId + regNo) ensured');
        } catch (error) {
            if (error.code === 85) { // Index already exists
                console.log('Correct index already exists');
            } else {
                console.error('Error creating correct index:', error);
            }
        }

        console.log('Database indexes fixed!');
    } catch (error) {
        console.error('Error fixing database indexes:', error);
    }
}

// Run the fix when the model is loaded
const runIndexFix = async () => {
    // If not connected, wait a bit and try again
    if (mongoose.connection.readyState !== 1) {
        console.log('Waiting for MongoDB connection before fixing indexes...');
        setTimeout(runIndexFix, 5000);
        return;
    }
    await fixDatabaseIndexes();
};

runIndexFix();

module.exports = {
    AttendanceSession,
    AttendanceRecord
};