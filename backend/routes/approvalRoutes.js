const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { verifyToken } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Create approval request
router.post('/create', approvalController.createApprovalRequest);

// Get all approval requests (with filters)
router.get('/list', approvalController.getAllApprovalRequests);

// Get specific approval request
router.get('/:id', approvalController.getApprovalRequestById);

// Get pending approvals for current user
router.get('/user/pending', approvalController.getPendingApprovalsForUser);

// Update approval request (creator only)
router.put('/:id/update', approvalController.updateApprovalRequest);

// Delete approval request (creator only)
router.delete('/:id/delete', approvalController.deleteApprovalRequest);

// Submit approval response (recipient only)
router.post('/:id/respond', approvalController.submitApprovalResponse);

// Complete approval request (creator only)
router.post('/:id/complete', approvalController.completeApprovalRequest);

// Cancel approval request (creator only)
router.post('/:id/cancel', approvalController.cancelApprovalRequest);

module.exports = router;
