const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { verifyToken } = require('../middleware/auth');

// Public routes - Get all roles and role stats (MUST be before :userId pattern)
router.get('/all', roleController.getAllRoles);
router.get('/stats', roleController.getRoleStats);
router.get('/category/:roleId/users', roleController.getUsersByRole);

// User-specific role routes (with userId parameter)
router.get('/:userId', roleController.getUserRoles);
router.post('/:userId/assign', verifyToken, roleController.assignRolesToUser);
router.post('/:userId/add', verifyToken, roleController.addRoleToUser);
router.delete('/:userId/role/:roleId', verifyToken, roleController.removeRoleFromUser);

module.exports = router;
