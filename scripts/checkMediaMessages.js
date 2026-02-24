const mongoose = require('mongoose');
const ChatMessage = require('../models/chatMessage');

mongoose.connect('mongodb://127.0.0.1:27017/ksucu-mc').then(async () => {
  try {
    const msgs = await ChatMessage.find({messageType: {$in: ['image', 'video']}}).limit(5).lean();
    console.log('Media messages found:', msgs.length);
    console.log(JSON.stringify(msgs.map(m => ({
      _id: m._id,
      mediaUrl: m.mediaUrl,
      messageType: m.messageType,
      senderName: m.senderName
    })), null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
});
