const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const AdmissionAdmin = require('../models/admissionAdmin');
require('dotenv').config();

const createAdmissionAdmin = async () => {
  try {
    // Connect to MongoDB
    const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if admission admin already exists
    const existingAdmin = await AdmissionAdmin.findOne({
      email: 'admin@ksucumcadmissionadmin.co.ke'
    });

    if (existingAdmin) {
      console.log('Admission admin already exists in the database');
      await mongoose.connection.close();
      return;
    }

    // Hash the password
    const password = 'Admin01q7';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the admission admin
    const admissionAdmin = new AdmissionAdmin({
      email: 'admin@ksucumcadmissionadmin.co.ke',
      password: hashedPassword,
      phone: '0700000001' // Default phone number
    });

    // Save to database
    await admissionAdmin.save();

    console.log('Admission admin created successfully!');
    console.log('Email: admin@ksucumcadmissionadmin.co.ke');
    console.log('Password: Admin01q7');
    console.log('Phone: 0700000001');

  } catch (error) {
    console.error('Error creating admission admin:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
createAdmissionAdmin();