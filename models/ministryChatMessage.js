const mongoose = require('mongoose');

const MinistryChatMessageSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'messages',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    messageContent: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isOverseer: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('MinistryChatMessage', MinistryChatMessageSchema);
