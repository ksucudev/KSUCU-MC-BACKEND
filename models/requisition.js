const mongoose = require('mongoose');

const requisitionItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  description: String
});

const requisitionSchema = new mongoose.Schema({
  recipientName: {
    type: String,
    required: true
  },
  recipientPhone: {
    type: String,
    required: true
  },
  items: [requisitionItemSchema],
  timeReceived: {
    type: Date,
    required: true
  },
  timeToReturn: {
    type: Date,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  purpose: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'released', 'returned', 'rejected'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  releasedBy: String,
  releasedAt: Date,
  returnedAt: Date,
  comments: String,
  approvedBy: String,
  approvedAt: Date,
  approvalSignature: String,
  approvalSignatureDate: Date,
  notificationSent: {
    type: Boolean,
    default: false
  },
  pdfUrl: String,
  pdfGeneratedAt: Date,
  userAcknowledged: {
    type: Boolean,
    default: false
  },
  userAcknowledgedAt: Date,
  assetTransfer: {
    receivedByName: String,
    receivedBySignature: String,
    releasedByName: String,
    releasedBySignature: String,
    date: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Requisition', requisitionSchema);