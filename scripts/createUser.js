require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

async function createUser() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB at:', dbUri);

        // User credentials and details
        const userData = {
            username: 'John Kamau',
            email: 'john.kamau646@students.ksu.ac.ke',
            password: 'user123',
            phone: '0710123456',
            reg: '20221234',
            yos: '3',
            ministry: 'Praise & Worship',
            course: 'Computer Science',
            et: 'baptised'
        };

        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            console.log('User already exists with email:', userData.email);
            console.log('Updating user details...');

            // Update the user
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            existingUser.username = userData.username;
            existingUser.password = hashedPassword;
            existingUser.phone = userData.phone;
            existingUser.reg = userData.reg;
            existingUser.yos = userData.yos;
            existingUser.ministry = userData.ministry;
            existingUser.course = userData.course;
            existingUser.et = userData.et;
            await existingUser.save();

            console.log('User updated successfully!');
        } else {
            // Create new user
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const newUser = new User({
                username: userData.username,
                email: userData.email,
                password: hashedPassword,
                phone: userData.phone,
                reg: userData.reg,
                yos: userData.yos,
                ministry: userData.ministry,
                course: userData.course,
                et: userData.et
            });

            await newUser.save();
            console.log('User created successfully!');
        }

        console.log('\n=== User Credentials ===');
        console.log('Email:', userData.email);
        console.log('Password:', userData.password);
        console.log('Username:', userData.username);
        console.log('Ministry:', userData.ministry);
        console.log('Year of Study:', userData.yos);
        console.log('========================\n');

        // Close connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the script
createUser();
