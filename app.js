const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path')
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const newsAdminRoutes = require('./routes/newsRoutes')
const missionAdminRoutes = require('./routes/missionRoutes')
const bsAdminRoutes = require('./routes/bsRoutes')
const superAdminRoutes = require('./routes/superAdminRoutes')
const admissionAdminRoutes = require('./routes/admissionAdminRoutes')
const commitmentRoutes = require('./routes/commitmentRoute.js')
const attendanceRoutes = require('./routes/attendanceRoutes')
const chatRoutes = require('./routes/chatRoutes')
const mediaRoutes = require('./routes/mediaRoutes')
const requisitionRoutes = require('./routes/requisitionRoutes')
const settingsRoutes = require('./routes/settingsRoutes')
const compassionRoutes = require('./routes/compassionRoutes')
const messageRoutes = require('./routes/messageRoutes')
const pollingOfficerRoutes = require('./routes/pollingOfficerRoutes')
const documentRoutes = require('./routes/documentRoutes')
const minutesRoutes = require('./routes/minutesRoutes')
require('dotenv').config();
const fs = require('fs');
const cors = require('cors')
const cookieParser = require ('cookie-parser');

// Ensure the 'uploads' folder exists
let uploadDir;

if (process.env.NODE_ENV === 'production') {
    // Use local uploads directory instead of /var/www/uploads for now
    uploadDir = path.join(__dirname, 'uploads');
} else {
    uploadDir = path.join(__dirname, 'uploads');
}

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

const corsOptions = {
    origin: function(origin, callback) {
      const nodeEnv = (process.env.NODE_ENV || '').trim();
      console.log(`CORS Request from origin: "${origin}", NODE_ENV: "${nodeEnv}"`);

      // More permissive CORS for production debugging
      if (nodeEnv === 'development') {
        const devOrigins = ['http://localhost:5173','http://localhost:5174','http://localhost:5175','http://localhost:5176'];
        console.log(`Dev allowed origins:`, devOrigins);
        
        if (devOrigins.includes(origin) || !origin) {
          console.log(`CORS allowed for dev origin: ${origin}`);
          callback(null, true);
        } else {
          console.log(`CORS blocked for dev origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        // Production: be more permissive to fix the login issues
        const prodOrigins = [
          'https://www.ksucu-mc.co.ke', 
          'https://ksucu-mc.co.ke',
          'http://www.ksucu-mc.co.ke',
          'http://ksucu-mc.co.ke'
        ];
        
        console.log(`Production allowed origins:`, prodOrigins);
        console.log(`Checking if "${origin}" is in allowed origins...`);
        
        // More flexible matching for production
        if (!origin || 
            prodOrigins.includes(origin) ||
            (origin && origin.includes('ksucu-mc.co.ke'))) {
          console.log(`CORS allowed for production origin: ${origin}`);
          callback(null, true);
        } else {
          console.log(`CORS blocked for production origin: ${origin}`);
          console.log(`Origin type: ${typeof origin}, value: "${origin}"`);
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true, // Allow credentials (cookies) to be sent
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};
app.use(cors(corsOptions));

const dbUri = process.env.DB_CONNECTION_URI || 'mongodb://127.0.0.1:27017/ksucu-mc';
console.log('Attempting to connect to MongoDB at:', dbUri);

mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(()=>{
    console.log('MongoDB connected successfully');
}).catch((err)=>{
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', err);
});

app.use('/users', userRoutes);
app.use('/adminnews', newsAdminRoutes);
app.use('/news', newsAdminRoutes); // Add direct news route
app.use('/adminmission', missionAdminRoutes);
app.use('/adminBs', bsAdminRoutes);
app.use('/sadmin', superAdminRoutes);
app.use('/admissionadmin', admissionAdminRoutes);
app.use('/commitmentForm', commitmentRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/chat', chatRoutes);
app.use('/api', mediaRoutes);
app.use('/api', requisitionRoutes);
app.use('/api', settingsRoutes);
app.use('/api/compassion', compassionRoutes);
app.use('/messages', messageRoutes);
app.use('/polling-officer', pollingOfficerRoutes);
app.use('/documents', documentRoutes);
app.use('/minutes', minutesRoutes);

// Serve uploaded files statically
const uploadsPath = path.join(__dirname, 'uploads');
console.log('📁 Static files: Serving uploads from:', uploadsPath);
console.log('📁 Static files: Directory exists:', fs.existsSync(uploadsPath));

if (process.env.NODE_ENV === 'production') {
    app.use('/uploads', express.static(uploadsPath));
} else {
    app.use('/uploads', express.static(uploadsPath));
}

if(process.env.NODE_ENV === 'production'){
    app.use(express.static(path.join(__dirname, '../KSUCU-MC-FRONTEND/dist')));

    app.get('*', (req,res) => {
        res.sendFile(
            path.resolve(__dirname, '../', 'KSUCU-MC-FRONTEND', 'dist', 'index.html')
        )
    })
} else{
    app.get('/', (req, res) => res.send('Please set to production'))
}

// Setup Socket.IO
const io = socketIo(server, {
  cors: {
    origin: function(origin, callback) {
      const nodeEnv = (process.env.NODE_ENV || '').trim();
      if (nodeEnv === 'development') {
        const devOrigins = ['http://localhost:5173','http://localhost:5174','http://localhost:5175','http://localhost:5176'];
        if (devOrigins.includes(origin) || !origin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        if (!origin || 
            (origin && (origin.includes('localhost') || 
                       origin.includes('127.0.0.1') ||
                       origin.includes('ksucu-mc.co.ke')))) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true
  }
});

// Make io available to routes
app.set('io', io);

// Socket.IO chat functionality
const ChatMessage = require('./models/chatMessage');
const OnlineUsers = require('./models/onlineUsers');
const jwt = require('jsonwebtoken');
const User = require('./models/user');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    console.log(`🔐 Socket auth - Token received: ${token ? 'Yes' : 'No'}, Token value: ${token}`);
    
    // Require authentication - no guest access
    if (!token || token === 'guest') {
      console.log('❌ Socket auth - No valid token provided, rejecting connection');
      next(new Error('Authentication required'));
      return;
    }

    // Try to authenticate with JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_USER_SECRET);
      console.log('🔍 Socket auth - JWT decoded successfully, userId:', decoded.userId);
      
      const user = await User.findById(decoded.userId);
      if (user) {
        socket.userId = decoded.userId;
        socket.username = user.username;
        console.log(`✅ Socket auth - Authenticated user: ${user.username} (ID: ${decoded.userId})`);
        next();
      } else {
        console.log('❌ Socket auth - User not found in database');
        next(new Error('User not found'));
      }
    } catch (jwtError) {
      console.log('❌ Socket auth - JWT verification failed:', jwtError.message);
      next(new Error('Invalid token'));
    }
  } catch (err) {
    console.log('❌ Socket auth - Unexpected error:', err.message);
    next(new Error('Authentication failed'));
  }
});

io.on('connection', async (socket) => {
  console.log(`User ${socket.username} connected with socket ${socket.id}`);

  // Add user to online users (all users are now authenticated)
  try {
    await OnlineUsers.findOneAndUpdate(
      { userId: socket.userId },
      {
        userId: socket.userId,
        username: socket.username,
        socketId: socket.id,
        status: 'online',
        lastSeen: new Date()
      },
      { upsert: true, new: true }
    );

    // Broadcast updated online users
    const onlineUsers = await OnlineUsers.find({ status: 'online' })
      .populate('userId', 'username')
      .select('username status lastSeen');
    io.emit('onlineUsersUpdate', onlineUsers);
  } catch (error) {
    console.error('Error updating online users:', error);
  }

  // Join the general chat room
  socket.join('community-chat');

  // Handle new message
  socket.on('sendMessage', async (data) => {
    try {
      const { message, messageType = 'text', replyTo } = data;
      
      const newMessage = new ChatMessage({
        senderId: socket.userId,
        senderName: socket.username,
        message,
        messageType,
        replyTo: replyTo || null,
        status: 'sending'
      });

      await newMessage.save();
      await newMessage.populate('replyTo', 'message senderName timestamp');

      // Update status to 'sent' immediately after successful save
      newMessage.status = 'sent';
      await newMessage.save();

      // Broadcast message to all users in the chat
      io.to('community-chat').emit('newMessage', newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle message edit
  socket.on('editMessage', async (data) => {
    try {
      const { messageId, message } = data;
      
      const chatMessage = await ChatMessage.findById(messageId);
      if (!chatMessage || chatMessage.senderId.toString() !== socket.userId) {
        socket.emit('error', { message: 'Not authorized to edit this message' });
        return;
      }

      chatMessage.message = message;
      chatMessage.edited = true;
      chatMessage.editedAt = new Date();
      await chatMessage.save();

      await chatMessage.populate('replyTo', 'message senderName timestamp');

      // Broadcast updated message
      io.to('community-chat').emit('messageEdited', chatMessage);
    } catch (error) {
      console.error('Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  // Handle message delete
  socket.on('deleteMessage', async (data) => {
    try {
      const { messageId } = data;
      
      const chatMessage = await ChatMessage.findById(messageId);
      if (!chatMessage) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check authorization - only authenticated users
      const isAuthorized = socket.userId && chatMessage.senderId && chatMessage.senderId.toString() === socket.userId;
      
      if (!isAuthorized) {
        socket.emit('error', { message: 'Not authorized to delete this message' });
        return;
      }

      chatMessage.deleted = true;
      await chatMessage.save();

      // Broadcast deleted message
      io.to('community-chat').emit('messageDeleted', { messageId });
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  // Handle delete message for specific user
  socket.on('deleteMessageForMe', async (data) => {
    try {
      const { messageId } = data;
      
      const chatMessage = await ChatMessage.findById(messageId);
      if (!chatMessage) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check if message already deleted for this user
      const alreadyDeleted = chatMessage.deletedFor.some(del => 
        del.userId && del.userId.toString() === socket.userId
      );

      if (!alreadyDeleted) {
        // Add user to deletedFor array
        chatMessage.deletedFor.push({ 
          userId: socket.userId, 
          deletedAt: new Date() 
        });
        await chatMessage.save();
      }

      // Only notify the specific user
      socket.emit('messageDeletedForUser', { 
        messageId, 
        userId: socket.userId,
        username: socket.username 
      });
    } catch (error) {
      console.error('Error deleting message for user:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  // Handle message status update
  socket.on('updateMessageStatus', async (data) => {
    try {
      const { messageId, status } = data;
      
      const chatMessage = await ChatMessage.findById(messageId);
      if (!chatMessage) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Update message status
      chatMessage.status = status;
      await chatMessage.save();

      // Broadcast status update to all users
      io.to('community-chat').emit('messageStatusUpdated', { messageId, status });
    } catch (error) {
      console.error('Error updating message status:', error);
      socket.emit('error', { message: 'Failed to update message status' });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    socket.to('community-chat').emit('userTyping', {
      username: socket.username,
      isTyping: data.isTyping
    });
  });

  // Handle message reactions
  socket.on('addReaction', async (data) => {
    try {
      const { messageId, reactionType } = data;
      
      if (!['like', 'dislike'].includes(reactionType)) {
        socket.emit('error', { message: 'Invalid reaction type' });
        return;
      }

      const chatMessage = await ChatMessage.findById(messageId);
      if (!chatMessage) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Initialize reactions if not present
      if (!chatMessage.reactions) {
        chatMessage.reactions = { likes: [], dislikes: [] };
      }

      const reactionArray = reactionType === 'like' ? chatMessage.reactions.likes : chatMessage.reactions.dislikes;
      const oppositeArray = reactionType === 'like' ? chatMessage.reactions.dislikes : chatMessage.reactions.likes;

      // Check if user already reacted
      const existingReactionIndex = reactionArray.findIndex(reaction => 
        reaction.userId && reaction.userId.toString() === socket.userId.toString()
      );

      const oppositeReactionIndex = oppositeArray.findIndex(reaction => 
        reaction.userId && reaction.userId.toString() === socket.userId.toString()
      );

      // Remove opposite reaction if exists
      if (oppositeReactionIndex > -1) {
        oppositeArray.splice(oppositeReactionIndex, 1);
      }

      // Always add reaction (don't toggle - allow multiple likes)
      if (existingReactionIndex === -1) {
        // Add new reaction only if user hasn't reacted before
        reactionArray.push({
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date()
        });
      }
      // If user already reacted, do nothing (keep the existing reaction)

      await chatMessage.save();

      // Broadcast reaction update to all users
      io.to('community-chat').emit('reactionUpdate', { 
        messageId, 
        reactions: chatMessage.reactions 
      });

    } catch (error) {
      console.error('Error handling reaction:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User ${socket.username} disconnected`);

    try {
      // Update user status to offline
      await OnlineUsers.findOneAndUpdate(
        { userId: socket.userId },
        { 
          status: 'offline',
          lastSeen: new Date()
        }
      );

      // Remove from online users after a delay (in case of reconnection)
      setTimeout(async () => {
        try {
          const stillOnline = await OnlineUsers.findOne({
            userId: socket.userId,
            status: 'online'
          });

          if (!stillOnline) {
            await OnlineUsers.findOneAndDelete({ userId: socket.userId });
          }

          // Broadcast updated online users
          const onlineUsers = await OnlineUsers.find({ status: 'online' })
            .populate('userId', 'username')
            .select('username status lastSeen');
          io.emit('onlineUsersUpdate', onlineUsers);
        } catch (error) {
          console.error('Error cleaning up offline user:', error);
        }
      }, 30000); // 30 seconds delay

    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
