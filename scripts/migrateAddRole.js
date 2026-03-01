const mongoose = require('mongoose');
const User = require('../models/user');
require('dotenv').config();

async function migrateAddRole() {
  try {
    let dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
    if (dbUri.includes('localhost')) {
      dbUri = dbUri.replace('localhost', '127.0.0.1');
    }

    await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Set role='student' for all users that don't have a role
    const result = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'student' } }
    );

    console.log(`Updated ${result.modifiedCount} users with default role 'student'`);

    // Also set users with null role
    const result2 = await User.updateMany(
      { role: null },
      { $set: { role: 'student' } }
    );

    console.log(`Updated ${result2.modifiedCount} additional users with null role`);

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateAddRole();
