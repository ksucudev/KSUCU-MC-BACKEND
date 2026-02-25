const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    ministryId: {
        type: String,
        required: false // Optional for general feedback
    },
    ministryName: {
        type: String,
        required: false
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional for truly anonymous messages
    },
    assignedRole: {
        type: String,
        required: false // Mapped from ministryRoleMapping.js
    },
    senderInfo: {
        username: { type: String },
        email: { type: String },
        ministry: { type: String },
        yos: { type: Number }
    },
    replyText: {
        type: String
    },
    repliedAt: {
        type: Date
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isRead: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['new', 'read', 'replied', 'archived'],
        default: 'new'
    }
});

module.exports = mongoose.model('messages', MessageSchema);
