const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { verifyToken, optionalAuth } = require('../middleware/auth');

// Specific routes FIRST (before the :userId parameter route)
router.get('/users/all', verifyToken, profileController.getAllUsers); // Get all users
router.post('/', profileController.createProfile); // Registration - no auth needed

// Generic routes AFTER specific ones
router.get('/:userId', optionalAuth, profileController.getProfile); // Public view
router.patch('/:userId', verifyToken, profileController.updateProfile); // Protected
router.delete('/:userId', verifyToken, profileController.deleteProfile); // Protected

module.exports = router;
