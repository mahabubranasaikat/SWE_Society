const express = require('express');
const router = express.Router();
const societyNoticeController = require('../controllers/societyNoticeController');
const { verifyToken, optionalAuth } = require('../middleware/auth');

// Public listing (no auth required to view)
router.get('/', societyNoticeController.listNotices);

// Get single notice
router.get('/:id', societyNoticeController.getNoticeById);

// Create notice (society members only)
router.post('/', verifyToken, societyNoticeController.createNotice);

// Delete notice (creator only)
router.delete('/:id', verifyToken, societyNoticeController.deleteNotice);

module.exports = router;
