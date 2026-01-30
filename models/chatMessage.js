const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false,
    default: null
  },
  senderName: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    default: '' 
  },
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'video', 'audio', 'file'], 
    default: 'text' 
  },
  mediaUrl: { 
    type: String, 
    default: null 
  },
  mediaFileName: { 
    type: String, 
    default: null 
  },
  mediaSize: { 
    type: Number, 
    default: null 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  edited: { 
    type: Boolean, 
    default: false 
  },
  editedAt: { 
    type: Date, 
    default: null 
  },
  deleted: { 
    type: Boolean, 
    default: false 
  },
  deletedFor: [{
    userId: { 
      type: mongoose.Schema.Types.Mixed,  // Allow both ObjectId and string
      required: false
    },
    username: {
      type: String,
      required: false
    },
    deletedAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read'],
    default: 'sending'
  },
  replyTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ChatMessage', 
    default: null 
  },
  reactions: {
    likes: [{
      userId: { 
        type: mongoose.Schema.Types.Mixed,
        required: false
      },
      username: {
        type: String,
        required: false
      },
      timestamp: { 
        type: Date, 
        default: Date.now 
      }
    }],
    dislikes: [{
      userId: { 
        type: mongoose.Schema.Types.Mixed,
        required: false
      },
      username: {
        type: String,
        required: false
      },
      timestamp: { 
        type: Date, 
        default: Date.now 
      }
    }]
  }
}, { timestamps: true });

// Indexes for query optimization
chatMessageSchema.index({ timestamp: -1 });
chatMessageSchema.index({ senderId: 1 });
// Compound index for the main messages query: find({ deleted: false }).sort({ timestamp: -1 })
chatMessageSchema.index({ deleted: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);