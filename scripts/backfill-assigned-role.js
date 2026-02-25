/**
 * One-time migration: backfill assigned_role on Commitment and MinistryRegistration records
 * that were created before the assigned_role field was added.
 *
 * Run with: node scripts/backfill-assigned-role.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Commitment = require('../models/commitment');
const MinistryRegistration = require('../models/MinistryRegistration');

const ministryRoleMapping = {
    'Wananzambe': 'Worship Coordinator',
    'Wanazambe': 'Worship Coordinator',
    'Wananzambe (Instrumentalists)': 'Worship Coordinator',
    'Praise and Worship': 'Worship Coordinator',
    'Choir': 'Worship Coordinator',
    'Choir Ministry': 'Worship Coordinator',
    'High School Ministry': 'Missions Coordinator',
    'Compassion and Counselling Ministry': 'Missions Coordinator',
    'Creativity Ministry': 'Boards Coordinator',
    'Intercessory Ministry': 'Prayer Coordinator',
    'Intercessory Prayer': 'Prayer Coordinator',
    'Ushering and Hospitality Ministry': 'Vice Chair',
    'Ushering': 'Vice Chair',
    'Church School Ministry': 'Vice Chair',
};

async function backfill() {
    const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
    await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB:', dbUri);

    // --- Commitments ---
    const commitmentsToUpdate = await Commitment.find({
        $or: [{ assigned_role: { $exists: false } }, { assigned_role: null }, { assigned_role: '' }]
    });
    console.log(`Found ${commitmentsToUpdate.length} commitment(s) missing assigned_role`);

    let commitmentUpdated = 0;
    for (const c of commitmentsToUpdate) {
        const role = ministryRoleMapping[c.ministry] || 'Overseer';
        await Commitment.findByIdAndUpdate(c._id, { assigned_role: role });
        console.log(`  Commitment ${c._id} | ministry="${c.ministry}" → assigned_role="${role}"`);
        commitmentUpdated++;
    }
    console.log(`Updated ${commitmentUpdated} commitment record(s)\n`);

    // --- Ministry Registrations ---
    const regsToUpdate = await MinistryRegistration.find({
        $or: [
            { assigned_role: { $exists: false } },
            { assigned_role: null },
            { assigned_role: '' },
            { assigned_role: 'Vice Chairperson' }
        ]
    });
    console.log(`Found ${regsToUpdate.length} registration(s) missing or needing role update`);

    let regUpdated = 0;
    for (const r of regsToUpdate) {
        let role = ministryRoleMapping[r.ministry] || 'Overseer';
        if (r.assigned_role === 'Vice Chairperson') {
            role = 'Vice Chair';
        }
        await MinistryRegistration.findByIdAndUpdate(r._id, { assigned_role: role });
        console.log(`  Registration ${r._id} | ministry="${r.ministry}" | oldRole="${r.assigned_role}" → assigned_role="${role}"`);
        regUpdated++;
    }
    console.log(`Updated ${regUpdated} registration record(s)\n`);

    console.log('Migration complete.');
    await mongoose.disconnect();
}

backfill().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
