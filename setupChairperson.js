
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const SAdminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    docket: String
}, { strict: false });
// Mongoose pluralizes 'SuperAdmin' to 'superadmins' by default. 
// We explicitly set the collection name to 'superadmins' to match the backend model.
const SAdmin = mongoose.model('SuperAdmin', SAdminSchema, 'superadmins');

async function setup() {
    await mongoose.connect(process.env.DB_CONNECTION_URI || 'mongodb://localhost:27017/ksucu-mc');
    
    const email = 'chairperson@ksucu.ac.ke';
    const password = 'Chair@2026';
    const phone = '0700000000'; // Required field in the backend model
    const hashedPassword = await bcrypt.hash(password, 10);
    
    let admin = await SAdmin.findOne({ email });
    if(admin) {
        admin.password = hashedPassword;
        admin.docket = 'Chairperson';
        admin.phone = admin.phone || phone;
        await admin.save();
        console.log('Updated chairperson in superadmins collection');
    } else {
        admin = new SAdmin({ email, password: hashedPassword, phone, docket: 'Chairperson' });
        await admin.save();
        console.log('Created chairperson in superadmins collection');
    }

    process.exit(0);
}
setup();

