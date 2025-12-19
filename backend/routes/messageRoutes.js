const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

// All routes require authentication
// Global messaging settings (must be before parameterized routes)
router.get('/messages/settings', verifyToken, messageController.getSettings);
router.patch('/messages/settings', verifyToken, messageController.updateSettings);
router.get('/messages/unread', verifyToken, messageController.getUnreadCount);

// Search and list
router.get('/messages/search', verifyToken, messageController.searchUsers);
router.get('/messages', verifyToken, messageController.listConversations);
router.post('/messages/start', verifyToken, messageController.startConversation);

// Conversation operations
router.get('/messages/:conversationId/messages', verifyToken, messageController.getMessages);
router.post('/messages/:conversationId/messages', verifyToken, messageController.sendMessage);
router.post('/messages/:conversationId/mute', verifyToken, messageController.setMute);
router.post('/messages/:conversationId/read', verifyToken, messageController.markAsRead);

module.exports = router;