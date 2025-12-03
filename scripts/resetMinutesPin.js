require('dotenv').config();
const mongoose = require('mongoose');
const MinutesPin = require('../models/minutesPin');

async function resetMinutesPin() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Delete all PIN documents
        const result = await MinutesPin.deleteMany({});

        if (result.deletedCount > 0) {
            console.log(`Minutes PIN reset successfully! Deleted ${result.deletedCount} PIN record(s).`);
            console.log('Next time you access Minutes, you will be prompted to set a new PIN.');
        } else {
            console.log('No Minutes PIN found to reset.');
        }

        // Close connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error resetting PIN:', error);
        process.exit(1);
    }
}

// Run the script
resetMinutesPin();
