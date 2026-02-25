const mongoose = require('mongoose');
require('dotenv').config();

const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';

async function verifyFix() {
    try {
        await mongoose.connect(dbUri);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('ministryregistrations');

        // Clean up any test data
        await collection.deleteMany({ registrationNumber: 'VERIFY_TEST_123' });

        console.log('Testing multi-ministry registration...');

        // 1. First registration (Choir)
        await collection.insertOne({
            fullName: 'Verify Test',
            registrationNumber: 'VERIFY_TEST_123',
            phoneNumber: '0711111111',
            ministry: 'Choir',
            assigned_role: 'Worship Coordinator'
        });
        console.log('✅ Successfully registered for Choir');

        // 2. Second registration (Ushers) - SAME regNo, DIFFERENT ministry
        try {
            await collection.insertOne({
                fullName: 'Verify Test',
                registrationNumber: 'VERIFY_TEST_123',
                phoneNumber: '0711111111',
                ministry: 'Ushers',
                assigned_role: 'Ushering Head'
            });
            console.log('✅ Successfully registered for Ushers (Multi-ministry works!)');
        } catch (err) {
            console.error('❌ Failed to register for a second ministry:', err.message);
        }

        // 3. Third registration (Choir again) - SHOULD FAIL
        try {
            await collection.insertOne({
                fullName: 'Verify Test',
                registrationNumber: 'VERIFY_TEST_123',
                phoneNumber: '0711111111',
                ministry: 'Choir',
                assigned_role: 'Worship Coordinator'
            });
            console.log('❌ Error: Registered for Choir twice! (Unique constraint failed)');
        } catch (err) {
            console.log('✅ Correctly blocked duplicate registration for SAME ministry');
        }

    } catch (err) {
        console.error('Connection error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

verifyFix();
