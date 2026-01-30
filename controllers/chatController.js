const jwt = require('jsonwebtoken');
const ChatMessage = require('../models/chatMessage');
const OnlineUsers = require('../models/onlineUsers');
const User = require('../models/user');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
      // Videos
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/mkv', 'video/flv', 'video/3gp',
      // Audio
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/mpeg',
      // Documents
      'application/pdf', 'text/plain', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  }
}).single('media');

// Get recent messages
exports.getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    console.log(`📊 Getting messages: page=${page}, limit=${limit}, skip=${skip}`);
    const startTime = Date.now();

    const messages = await ChatMessage.find({ deleted: false })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('replyTo', 'message senderName timestamp')
      .lean();
    
    const queryTime = Date.now() - startTime;
    console.log(`📊 Query completed in ${queryTime}ms, found ${messages.length} messages`);

    res.json({
      success: true,
      messages: messages.reverse(),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { message, messageType = 'text', replyTo } = req.body;
    const userId = req.user.userId;

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newMessage = new ChatMessage({
      senderId: userId,
      senderName: user.username,
      message: message || '',
      messageType,
      replyTo: replyTo || null,
    });

    await newMessage.save();

    // Populate replyTo field for response
    await newMessage.populate('replyTo', 'message senderName timestamp');

    // Broadcast new message to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.to('community-chat').emit('newMessage', newMessage);
      console.log('💬 New message broadcasted:', newMessage._id);
    }

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// Upload media
exports.uploadMedia = async (req, res) => {
  try {
    console.log('📁 Chat Upload: Request received');
    console.log('📁 Chat Upload: Headers:', req.headers);
    console.log('📁 Chat Upload: User:', req.user);
    
    upload(req, res, async (err) => {
      if (err) {
        console.error('📁 Chat Upload: Multer error:', err);
        return res.status(400).json({ success: false, message: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const userId = req.user.userId;
      const { message: textMessage, replyTo } = req.body;

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Determine message type based on file mimetype
      let messageType = 'file';
      if (req.file.mimetype.startsWith('image/')) messageType = 'image';
      else if (req.file.mimetype.startsWith('video/')) messageType = 'video';
      else if (req.file.mimetype.startsWith('audio/')) messageType = 'audio';

      const mediaUrl = `/uploads/chat/${req.file.filename}`;

      console.log('📁 Chat Upload: File details:', {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        mediaUrl: mediaUrl
      });

      const newMessage = new ChatMessage({
        senderId: userId,
        senderName: user.username,
        message: textMessage || '',
        messageType,
        mediaUrl,
        mediaFileName: req.file.originalname,
        mediaSize: req.file.size,
        replyTo: replyTo || null,
      });

      await newMessage.save();
      console.log('📁 Chat Upload: Message saved successfully:', newMessage._id);

      // Populate replyTo field for response
      await newMessage.populate('replyTo', 'message senderName timestamp');

      // Broadcast the uploaded media message to all connected clients
      const io = req.app.get('io');
      if (io) {
        io.to('community-chat').emit('newMessage', newMessage);
        console.log('📁 Chat Upload: Message broadcasted to community-chat');
      }

      res.json({ success: true, message: newMessage });
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ success: false, message: 'Failed to upload media' });
  }
};

// Edit message
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    const chatMessage = await ChatMessage.findById(messageId);
    if (!chatMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (chatMessage.senderId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this message' });
    }

    chatMessage.message = message;
    chatMessage.edited = true;
    chatMessage.editedAt = new Date();
    await chatMessage.save();

    await chatMessage.populate('replyTo', 'message senderName timestamp');

    res.json({ success: true, message: chatMessage });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ success: false, message: 'Failed to edit message' });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const chatMessage = await ChatMessage.findById(messageId);
    if (!chatMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check if user is super admin
    const User = require('../models/user');
    const user = await User.findById(userId);
    const isSuperAdmin = user && user.role === 'super_admin';

    // Allow deletion if user is the sender OR is a super admin
    if (chatMessage.senderId.toString() !== userId && !isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
    }

    chatMessage.deleted = true;
    await chatMessage.save();

    // Broadcast deletion to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.to('community-chat').emit('messageDeleted', messageId);
      console.log('🗑️ Message deleted and broadcasted:', messageId);
    }

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

// Delete message for specific user only
exports.deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user ? req.user.userId : req.body.userId;

    const chatMessage = await ChatMessage.findById(messageId);
    if (!chatMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Add user to deletedFor array if not already there
    if (!chatMessage.deletedFor.some(del => del.userId.toString() === userId)) {
      chatMessage.deletedFor.push({ userId, deletedAt: new Date() });
      await chatMessage.save();
    }

    res.json({ success: true, message: 'Message deleted for user' });
  } catch (error) {
    console.error('Error deleting message for user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

// Update message status
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;
    const userId = req.user ? req.user.userId : null;

    const chatMessage = await ChatMessage.findById(messageId);
    if (!chatMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Only allow sender to update status or specific status updates
    if (userId && chatMessage.senderId.toString() !== userId && 
        !['delivered', 'read'].includes(status)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this message status' });
    }

    chatMessage.status = status;
    await chatMessage.save();

    res.json({ success: true, message: 'Message status updated' });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ success: false, message: 'Failed to update message status' });
  }
};

// Get online users
exports.getOnlineUsers = async (req, res) => {
  try {
    const onlineUsers = await OnlineUsers.find({ status: 'online' })
      .populate('userId', 'username email')
      .select('username status lastSeen')
      .lean();

    res.json({ success: true, users: onlineUsers });
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch online users' });
  }
};

// Add reaction to message
exports.addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reactionType } = req.body; // 'like' or 'dislike'
    let userId = null;
    let username = null;

    // Handle both authenticated and guest users
    if (req.user) {
      userId = req.user.userId;
      const user = await User.findById(userId);
      username = user ? user.username : null;
    } else if (req.body.guestUsername) {
      username = req.body.guestUsername;
      userId = 'guest';
    }

    if (!username) {
      return res.status(400).json({ success: false, message: 'User identification required' });
    }

    if (!['like', 'dislike'].includes(reactionType)) {
      return res.status(400).json({ success: false, message: 'Invalid reaction type' });
    }

    const chatMessage = await ChatMessage.findById(messageId);
    if (!chatMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Initialize reactions if not present
    if (!chatMessage.reactions) {
      chatMessage.reactions = { likes: [], dislikes: [] };
    }

    const reactionArray = reactionType === 'like' ? chatMessage.reactions.likes : chatMessage.reactions.dislikes;
    const oppositeArray = reactionType === 'like' ? chatMessage.reactions.dislikes : chatMessage.reactions.likes;

    // Check if user already reacted
    const existingReactionIndex = reactionArray.findIndex(reaction => 
      (userId && reaction.userId && reaction.userId.toString() === userId.toString()) ||
      (username && reaction.username === username)
    );

    const oppositeReactionIndex = oppositeArray.findIndex(reaction => 
      (userId && reaction.userId && reaction.userId.toString() === userId.toString()) ||
      (username && reaction.username === username)
    );

    // Remove opposite reaction if exists
    if (oppositeReactionIndex > -1) {
      oppositeArray.splice(oppositeReactionIndex, 1);
    }

    // Always add reaction (don't toggle - allow multiple likes)
    if (existingReactionIndex === -1) {
      // Add new reaction only if user hasn't reacted before
      reactionArray.push({
        userId: userId,
        username: username,
        timestamp: new Date()
      });
    }
    // If user already reacted, do nothing (keep the existing reaction)

    await chatMessage.save();

    // Return updated message with reaction counts
    const updatedMessage = await ChatMessage.findById(messageId)
      .populate('replyTo', 'message senderName timestamp')
      .lean();

    res.json({ 
      success: true, 
      message: updatedMessage,
      reaction: {
        type: reactionType,
        added: existingReactionIndex === -1,
        likesCount: chatMessage.reactions.likes.length,
        dislikesCount: chatMessage.reactions.dislikes.length
      }
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ success: false, message: 'Failed to add reaction' });
  }
};

// Get reactions for a message
exports.getMessageReactions = async (req, res) => {
  try {
    const { messageId } = req.params;

    const chatMessage = await ChatMessage.findById(messageId)
      .select('reactions')
      .lean();

    if (!chatMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const reactions = chatMessage.reactions || { likes: [], dislikes: [] };

    res.json({
      success: true,
      reactions: {
        likes: reactions.likes,
        dislikes: reactions.dislikes,
        likesCount: reactions.likes.length,
        dislikesCount: reactions.dislikes.length
      }
    });
  } catch (error) {
    console.error('Error getting reactions:', error);
    res.status(500).json({ success: false, message: 'Failed to get reactions' });
  }
};