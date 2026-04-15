require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Patron = require('../models/patron');

async function createPatron() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Patron credentials
        const email = 'patron@ksucu-mc.co.ke';
        const password = 'Patron@Patron';

        // Check if patron already exists
        const existingPatron = await Patron.findOne({ email });
        if (existingPatron) {
            console.log('Patron already exists with email:', email);
            console.log('Resetting password...');

            // Update the password
            const hashedPassword = await bcrypt.hash(password, 10);
            existingPatron.password = hashedPassword;
            await existingPatron.save();

            console.log('Patron password reset successfully!');
        } else {
            // Create new patron
            const hashedPassword = await bcrypt.hash(password, 10);
            const newPatron = new Patron({
                email,
                password: hashedPassword,
            });

            await newPatron.save();
            console.log('Patron created successfully!');
            console.log('Email:', email);
            console.log('Password:', password);
        }

        // Close connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the script
createPatron();
