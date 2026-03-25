const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String },
  phone: { type: String },
  email: { type: String, required: true, unique: true },
  reg: { type: String },
  yos: { type: String },
  ministry: { type: String },
  course: { type: String },
  et: { type: String },
  password: { type: String },
  profilePhoto: { type: String, default: null }, // URL path to profile photo
  role: { type: String, enum: ['student', 'associate'], default: 'student' },
  graduationYear: { type: Number, default: null },
  hasVoted: { type: Boolean, default: false },
  votedAt: { type: Date },
  votedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PollingOfficer' },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PollingOfficer' },
  financeRole: {
    type: String,
    enum: ['treasurer', 'auditor', 'chair_accounts', 'chairperson', null],
    default: null
  }
});

module.exports = mongoose.model('User', userSchema);
