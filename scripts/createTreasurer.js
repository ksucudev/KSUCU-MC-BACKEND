require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const FinanceUser = require('../models/financeUser');

async function createTreasurer() {
    try {
        const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        const email = 'treasurer@ksucu.ac.ke';
        const password = 'Treasurer@2026';
        const role = 'treasurer';

        const existingUser = await FinanceUser.findOne({ email });
        
        if (existingUser) {
            console.log('Finance User already exists with email:', email);
            console.log('Resetting password and ensuring role is correct...');

            const hashedPassword = await bcrypt.hash(password, 10);
            existingUser.password = hashedPassword;
            existingUser.role = role;
            await existingUser.save();

            console.log('Treasurer credentials reset successfully!');
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new FinanceUser({
                name: 'Chief Treasurer',
                email,
                password: hashedPassword,
                role,
                phone: '0700000000'
            });

            await newUser.save();
            console.log('Treasurer account created successfully!');
        }

        console.log('--- Credentials ---');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createTreasurer();
