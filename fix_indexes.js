const mongoose = require('mongoose');

async function fixIndices() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ksucu-mc');
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collName = 'ministryregistrations';
        const collection = db.collection(collName);

        console.log(`Checking indexes for ${collName}...`);
        const indexesBefore = await collection.indexes();
        console.log('Indexes before:', JSON.stringify(indexesBefore, null, 2));

        // Drop legacy index
        try {
            await collection.dropIndex('registrationNumber_1');
            console.log('Dropped registrationNumber_1');
        } catch (e) {
            console.log('Index registrationNumber_1 not found or already dropped');
        }

        // Create compound index
        await collection.createIndex(
            { registrationNumber: 1, ministry: 1 },
            { unique: true, name: 'registrationNumber_1_ministry_1' }
        );
        console.log('Created compound index registrationNumber_1_ministry_1');

        const indexesAfter = await collection.indexes();
        console.log('Indexes after:', JSON.stringify(indexesAfter, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixIndices();
