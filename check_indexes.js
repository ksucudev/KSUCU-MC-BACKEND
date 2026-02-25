const mongoose = require('mongoose');

async function checkCollections() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ksucu-mc');
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:');
        console.log(JSON.stringify(collections.map(c => c.name), null, 2));

        for (const coll of collections) {
            const indexes = await mongoose.connection.db.collection(coll.name).indexes();
            console.log(`Indexes on ${coll.name}:`);
            console.log(JSON.stringify(indexes, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkCollections();
