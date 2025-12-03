const mongoose = require('mongoose');

const minutesPinSchema = new mongoose.Schema({
    pinHash: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Only allow one PIN document
minutesPinSchema.statics.getPin = async function() {
    return this.findOne();
};

module.exports = mongoose.model('MinutesPin', minutesPinSchema);
