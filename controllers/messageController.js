const Message = require('../models/message');
const MinistryChatMessage = require('../models/ministryChatMessage');
const User = require('../models/user');
const { getRoleForMinistry } = require('../utils/ministryRoleMapping');

// Submit a message (anonymous or identified)
exports.submitMessage = async (req, res) => {
    try {
        const { subject, message, category, isAnonymous, senderInfo, timestamp, ministryId, ministryName } = req.body;
        const userId = req.userId; // From auth middleware if logged in

        // Validate required fields
        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message are required'
            });
        }

        // Determine assigned role if ministry is provided
        let assignedRole = null;
        if (ministryName) {
            assignedRole = getRoleForMinistry(ministryName);
        }

        // Create new message
        const newMessage = new Message({
            subject: subject.trim(),
            message: message.trim(),
            category: category || 'feedback',
            isAnonymous: isAnonymous !== undefined ? isAnonymous : true,
            senderId: userId || null,
            senderInfo: !isAnonymous && senderInfo ? senderInfo : null,
            ministryId: ministryId || null,
            ministryName: ministryName || null,
            assignedRole: assignedRole,
            timestamp: timestamp || new Date(),
            isRead: false,
            status: 'new'
        });

        await newMessage.save();

        // Also create the first entry in MinistryChatMessage for the continuous chat
        const firstChat = new MinistryChatMessage({
            messageId: newMessage._id,
            senderId: userId || null,
            senderName: isAnonymous ? 'Anonymous' : (senderInfo?.username || 'User'),
            messageContent: message.trim(),
            isOverseer: false,
            timestamp: newMessage.timestamp
        });

        await firstChat.save();

        res.status(201).json({
            success: true,
            message: 'Message submitted successfully',
            data: newMessage
        });
    } catch (error) {
        console.error('Error submitting message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit message',
            error: error.message
        });
    }
};

// Get user's active messages
exports.getUserMessages = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const messages = await Message.find({ senderId: userId })
            .sort({ timestamp: -1 })
            .lean();

        res.status(200).json({ success: true, messages });
    } catch (error) {
        console.error('Error fetching user messages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
};

// Get messages for a specific overseer role
exports.getOverseerMessages = async (req, res) => {
    try {
        const { role } = req.params;
        const decodedRole = decodeURIComponent(role);

        const messages = await Message.find({ assignedRole: decodedRole })
            .sort({ timestamp: -1 })
            .lean();

        res.status(200).json({ success: true, messages });
    } catch (error) {
        console.error('Error fetching overseer messages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
};

// Overseer or User reply to a message (adds to conversation)
exports.replyToMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { replyText, isOverseer } = req.body;
        const userId = req.userId;

        if (!replyText) {
            return res.status(400).json({ success: false, message: 'Message content is required' });
        }

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Thread not found' });
        }

        // Get user info if not overseer
        let senderName = "Overseer";
        if (!isOverseer) {
            const user = await User.findById(userId);
            senderName = user ? user.username : "User";
        }

        const newChatMessage = new MinistryChatMessage({
            messageId: id,
            senderId: userId,
            senderName: senderName,
            messageContent: replyText.trim(),
            isOverseer: !!isOverseer,
            timestamp: new Date()
        });

        await newChatMessage.save();

        // Update main message status/timestamp
        message.status = isOverseer ? 'replied' : 'new';
        message.isRead = !isOverseer; // If overseer replies, mark as read by overseer (true)
        if (isOverseer) {
            message.replyText = replyText.trim(); // Keep for legacy compatibility if needed
            message.repliedAt = new Date();
        }

        await message.save();

        // Real-time Notification
        if (isOverseer && message.senderId) {
            try {
                const io = req.app.get('io');
                const OnlineUsers = require('../models/onlineUsers');
                const onlineUser = await OnlineUsers.findOne({ userId: message.senderId });

                if (onlineUser && onlineUser.socketId) {
                    io.to(onlineUser.socketId).emit('overseerReply', {
                        messageId: message._id,
                        subject: message.subject,
                        ministryName: message.ministryName
                    });
                }
            } catch (socketErr) {
                console.error('Error sending socket notification:', socketErr);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Message sent successfully',
            data: newChatMessage
        });
    } catch (error) {
        console.error('Error in replyToMessage:', error);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
};

// Get full conversation history
exports.getConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const conversation = await MinistryChatMessage.find({ messageId: id })
            .sort({ timestamp: 1 })
            .lean();

        res.status(200).json({ success: true, conversation });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch conversation history' });
    }
};

// Get all messages (Super Admin only - maintains existing functionality)
exports.getAllMessages = async (req, res) => {
    try {
        const messages = await Message.find()
            .sort({ timestamp: -1 })
            .lean();

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages',
            error: error.message
        });
    }
};

// Update message status (Admin only)
exports.updateMessageStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, isRead } = req.body;

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        if (status) message.status = status;
        if (isRead !== undefined) message.isRead = isRead;

        await message.save();

        res.status(200).json({
            success: true,
            message: 'Message updated successfully',
            data: message
        });
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update message',
            error: error.message
        });
    }
};

// Delete a message (Admin only)
exports.deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;

        const message = await Message.findByIdAndDelete(id);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message',
            error: error.message
        });
    }
};
