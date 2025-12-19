const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { verifyToken } = require('../middleware/auth');

// Get all users for member selection
router.get('/users', verifyToken, groupController.getAllUsers);

// Get users by role for batch selection
router.get('/users/role/:role', verifyToken, groupController.getUsersByRole);

// Get committee members for discussion creation
router.get('/committee-members', verifyToken, groupController.getCommitteeMembers);

// Get discussions for society page
router.get('/discussions', verifyToken, groupController.getDiscussions);

// Create a new group
router.post('/', verifyToken, groupController.createGroup);

// Get all groups for current user
router.get('/', verifyToken, groupController.getMyGroups);

// Get group details
router.get('/:groupId', verifyToken, groupController.getGroupDetails);

// Get group messages
router.get('/:groupId/messages', verifyToken, groupController.getGroupMessages);

// Send message to group
router.post('/:groupId/messages', verifyToken, groupController.sendGroupMessage);

// Add members to group (any member can add)
router.post('/:groupId/members', verifyToken, groupController.addMembers);

// Remove member from group (creator only)
router.delete('/:groupId/members/:memberId', verifyToken, groupController.removeMember);

// Delete group (creator only)
router.delete('/:groupId', verifyToken, groupController.deleteGroup);

// Leave group (any member except creator)
router.post('/:groupId/leave', verifyToken, groupController.leaveGroup);

module.exports = router;
