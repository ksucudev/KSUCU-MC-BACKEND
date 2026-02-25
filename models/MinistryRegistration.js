const mongoose = require('mongoose');

const MinistryRegistrationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    registrationNumber: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    phoneNumber: { type: String, required: true },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true
    },
    yearOfStudy: {
        type: String,
        enum: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
        required: true
    },
    course: { type: String, required: true },
    ministry: { type: String, required: true }, // e.g., "Choir", "Ushers"
    reasonForJoining: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'revoked'],
        default: 'pending'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    assigned_role: { type: String, required: true },
    form_type: { type: String, enum: ['join', 'commitment'], default: 'join' }
}, { timestamps: true });

// Comprehensive fix for database indexes and data normalization
async function performDatabaseMaintenance() {
    try {
        const Registration = mongoose.model('MinistryRegistration');
        const collection = Registration.collection;
        const indexes = await collection.indexes();
        console.log('--- MinistryRegistration Maintenance Started ---');

        // 1. Drop many common legacy unique index names if they exist
        const legacyIndexNames = ['registrationNumber_1', 'registrationNumber'];
        for (const name of legacyIndexNames) {
            const exists = indexes.some(idx => idx.name === name);
            if (exists) {
                console.log(`Dropping legacy index: ${name}`);
                await collection.dropIndex(name);
            }
        }

        // Also drop any unique index that IS NOT the compound one but targets registrationNumber
        for (const idx of indexes) {
            if (idx.unique && idx.name !== 'registrationNumber_1_ministry_1' && idx.key.registrationNumber === 1 && Object.keys(idx.key).length === 1) {
                console.log(`Dropping unnamed unique legacy index: ${idx.name}`);
                await collection.dropIndex(idx.name);
            }
        }

        // 2. Ensure the correct compound unique index exists
        await collection.createIndex(
            { registrationNumber: 1, ministry: 1 },
            { unique: true, name: 'registrationNumber_1_ministry_1' }
        );
        console.log('✅ Multi-ministry compound index ensured.');

        // 3. Normalize existing data (Migration)
        const normalizationMap = {
            'Choir Ministry': 'Choir',
            'Wananzambe (Instrumentalists)': 'Wananzambe',
            'Praise & Worship': 'Praise and Worship',
            'Compassion and Counseling Ministry': 'Compassion',
            'High School Ministry': 'High School',
            'Ushering and Hospitality Ministry': 'Ushering',
            'Creativity Ministry': 'Creativity',
            'Intercessory Prayer': 'Intercessory',
            'Intercessory Ministry': 'Intercessory'
        };

        for (const [oldName, newName] of Object.entries(normalizationMap)) {
            const result = await Registration.updateMany(
                { ministry: oldName },
                { $set: { ministry: newName } }
            );
            if (result.modifiedCount > 0) {
                console.log(`Normalized ${result.modifiedCount} records: "${oldName}" -> "${newName}"`);
            }
        }

        console.log('--- MinistryRegistration Maintenance Completed ---');

    } catch (error) {
        console.error('❌ Error during MinistryRegistration maintenance:', error);
    }
}

// Run maintenance with a delay to ensure DB connection is ready
setTimeout(performDatabaseMaintenance, 5000);

module.exports = mongoose.model('MinistryRegistration', MinistryRegistrationSchema);
