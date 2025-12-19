const db = require('../config/db');

// Ensure we always expose election-related roles even if the DB seed missed them
async function ensureElectionRoles() {
    const requiredRoles = [
        { name: 'Election Candidate', category: 'other', description: 'Eligible to stand as a candidate in elections' },
        { name: 'Election Panel Member', category: 'other', description: 'Eligible to review/approve election matters' }
    ];

    const roleNames = requiredRoles.map(r => r.name);
    const placeholders = roleNames.map(() => '?').join(',');

    const [existing] = await db.query(
        `SELECT role_name FROM roles WHERE role_name IN (${placeholders})`,
        roleNames
    );

    const existingNames = new Set(existing.map(r => r.role_name));
    const missing = requiredRoles.filter(r => !existingNames.has(r.name));

    if (missing.length > 0) {
        const values = missing.map(r => [r.name, r.category, r.description, true]);
        await db.query(
            'INSERT INTO roles (role_name, role_category, description, is_active) VALUES ? ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = TRUE',
            [values]
        );
    }
}

// Get all available roles grouped by category
exports.getAllRoles = async (req, res) => {
    try {
        // Backfill election roles if they were not seeded
        await ensureElectionRoles();

        const userId = req.query.userId; // Optional: to show current user's roles

        const [roles] = await db.query(
            'SELECT id, role_name, role_category, description FROM roles WHERE is_active = TRUE ORDER BY role_category, role_name'
        );
        
        // Get counts for each committee role
        const [roleCounts] = await db.query(`
            SELECT role_id, COUNT(*) as current_count
            FROM user_roles
            WHERE is_active = TRUE
            GROUP BY role_id
        `);
        
        const countMap = {};
        roleCounts.forEach(rc => {
            countMap[rc.role_id] = rc.current_count;
        });
        
        // Group roles by category
        const groupedRoles = {};
        roles.forEach(role => {
            if (!groupedRoles[role.role_category]) {
                groupedRoles[role.role_category] = [];
            }
            
            const roleData = {
                id: role.id,
                role_name: role.role_name,
                description: role.description,
                current_count: countMap[role.id] || 0,
                is_available: true
            };
            
            // Check availability for committee roles
            if (role.role_category === 'committee') {
                const currentCount = countMap[role.id] || 0;
                if (role.role_name === 'Executive Member') {
                    roleData.max_count = 8;
                    roleData.is_available = currentCount < 8;
                } else {
                    roleData.max_count = 1;
                    roleData.is_available = currentCount < 1;
                }
            }
            
            groupedRoles[role.role_category].push(roleData);
        });
        
        res.json({
            success: true,
            data: groupedRoles
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching roles',
            error: error.message
        });
    }
};

// Get roles for a specific user
exports.getUserRoles = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [userRoles] = await db.query(`
            SELECT 
                r.id,
                r.role_name,
                r.role_category,
                r.description,
                ur.assigned_at,
                ur.valid_from,
                ur.valid_until,
                ur.is_active
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = ? AND ur.is_active = TRUE
            ORDER BY r.role_category, r.role_name
        `, [userId]);
        
        res.json({
            success: true,
            data: userRoles
        });
    } catch (error) {
        console.error('Error fetching user roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user roles',
            error: error.message
        });
    }
};

// Assign role(s) to a user (user self-assignment with simple roles)
exports.assignRolesToUser = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { userId } = req.params;
        const { roleIds } = req.body;
        
        // Validate input - allow empty array so users can remove all roles
        if (!Array.isArray(roleIds)) {
            return res.status(400).json({
                success: false,
                message: 'roleIds must be an array'
            });
        }
        
        // Check if user exists
        const [users] = await connection.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Start transaction with row locking to prevent race conditions
        await connection.beginTransaction();
        
        // Verify all roles exist (only if roleIds has items)
        if (roleIds.length > 0) {
            const placeholders = roleIds.map(() => '?').join(',');
            const [roles] = await connection.query(
                `SELECT id, role_name, role_category FROM roles WHERE id IN (${placeholders}) AND is_active = TRUE`,
                roleIds
            );
            
            if (roles.length !== roleIds.length) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'One or more roles are invalid or inactive'
                });
            }
            
            // Check committee role limits with row locking
            for (const role of roles) {
                if (role.role_category === 'committee') {
                    // Lock the role row first to prevent race conditions
                    await connection.query(
                        'SELECT id FROM roles WHERE id = ? FOR UPDATE',
                        [role.id]
                    );
                    
                    // Now count how many users currently have this role (excluding current user)
                    const [roleCount] = await connection.query(
                        `SELECT COUNT(*) as count FROM user_roles ur 
                         WHERE ur.role_id = ? AND ur.user_id != ? AND ur.is_active = TRUE`,
                        [role.id, userId]
                    );
                    
                    const currentCount = roleCount[0].count;
                    
                    // Executive Member can have up to 8 members
                    if (role.role_name === 'Executive Member') {
                        if (currentCount >= 8) {
                            await connection.rollback();
                            return res.status(400).json({
                                success: false,
                                message: `The role "${role.role_name}" is full (maximum 8 members). Please wait for a vacancy.`
                            });
                        }
                    } else {
                        // All other committee roles: only 1 member allowed
                        if (currentCount >= 1) {
                            await connection.rollback();
                            return res.status(400).json({
                                success: false,
                                message: `The role "${role.role_name}" is already assigned to another member. Only one member can hold this role at a time.`
                            });
                        }
                    }
                }
            }
            
            // Check if user is trying to select multiple committee roles
            const committeeRoles = roles.filter(r => r.role_category === 'committee');
            if (committeeRoles.length > 1) {
                // Check if all are Executive Member (allowed)
                const nonExecutiveRoles = committeeRoles.filter(r => r.role_name !== 'Executive Member');
                if (nonExecutiveRoles.length > 1 || (nonExecutiveRoles.length === 1 && committeeRoles.length > 1)) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'You can only hold one committee role at a time (except Executive Member).'
                    });
                }
            }
        }
        
        // Remove old roles for this user
        await connection.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
        
        // Add new roles
        for (const roleId of roleIds) {
            await connection.query(
                'INSERT INTO user_roles (user_id, role_id, is_active) VALUES (?, ?, TRUE)',
                [userId, roleId]
            );
        }
        
        // Update labels field in users table with role names
        if (roleIds.length > 0) {
            const placeholders = roleIds.map(() => '?').join(',');
            const [assignedRoles] = await connection.query(
                `SELECT role_name FROM roles WHERE id IN (${placeholders}) AND is_active = TRUE`,
                roleIds
            );
            const roleNames = assignedRoles.map(r => r.role_name).join(', ');
            await connection.query(
                'UPDATE users SET labels = ? WHERE id = ?',
                [roleNames, userId]
            );
        } else {
            // If no roles, clear labels
            await connection.query(
                'UPDATE users SET labels = NULL WHERE id = ?',
                [userId]
            );
        }
        
        // Commit transaction
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Roles assigned successfully'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error assigning roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning roles',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// Add a single role to user
exports.addRoleToUser = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { userId } = req.params;
        // Accept both roleId and role_id for flexibility
        const roleId = req.body.roleId || req.body.role_id;
        
        if (!roleId) {
            return res.status(400).json({
                success: false,
                message: 'roleId is required'
            });
        }
        
        // Start transaction
        await connection.beginTransaction();
        
        // Check if user exists
        const [users] = await connection.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if role exists and get details with row lock
        const [roles] = await connection.query(
            'SELECT id, role_name, role_category FROM roles WHERE id = ? AND is_active = TRUE', 
            [roleId]
        );
        if (roles.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Role not found or inactive'
            });
        }
        
        const role = roles[0];
        
        // Check committee role limits with row locking
        if (role.role_category === 'committee') {
            // Lock the role row first to prevent race conditions
            await connection.query(
                'SELECT id FROM roles WHERE id = ? FOR UPDATE',
                [roleId]
            );
            
            // Now count how many users currently have this role (excluding current user)
            const [roleCount] = await connection.query(
                `SELECT COUNT(*) as count FROM user_roles ur 
                 WHERE ur.role_id = ? AND ur.user_id != ? AND ur.is_active = TRUE`,
                [roleId, userId]
            );
            
            const currentCount = roleCount[0].count;
            
            // Executive Member can have up to 8 members
            if (role.role_name === 'Executive Member') {
                if (currentCount >= 8) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `The role "${role.role_name}" is full (maximum 8 members). Please wait for a vacancy.`
                    });
                }
            } else {
                // All other committee roles: only 1 member allowed
                if (currentCount >= 1) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `The role "${role.role_name}" is already assigned to another member. Only one member can hold this role at a time.`
                    });
                }
            }
        }
        
        // Check if user already has this role
        const [existingRole] = await connection.query(
            'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
            [userId, roleId]
        );
        
        if (existingRole.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: 'User already has this role'
            });
        }
        
        // Add role
        await connection.query(
            'INSERT INTO user_roles (user_id, role_id, is_active) VALUES (?, ?, TRUE)',
            [userId, roleId]
        );
        
        // Get the role name and update user labels
        const [roleDetails] = await connection.query(
            'SELECT role_name FROM roles WHERE id = ?',
            [roleId]
        );
        
        if (roleDetails.length > 0) {
            const roleName = roleDetails[0].role_name;
            // Get current labels and append new role
            const [userDetails] = await connection.query(
                'SELECT labels FROM users WHERE id = ?',
                [userId]
            );
            
            let newLabels = roleName;
            if (userDetails.length > 0 && userDetails[0].labels) {
                const existingLabels = userDetails[0].labels.split(',').map(l => l.trim());
                if (!existingLabels.includes(roleName)) {
                    newLabels = [...existingLabels, roleName].join(', ');
                } else {
                    newLabels = userDetails[0].labels;
                }
            }
            
            await connection.query(
                'UPDATE users SET labels = ? WHERE id = ?',
                [newLabels, userId]
            );
        }
        
        // Commit transaction
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Role added successfully'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error adding role:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding role',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// Remove role from user
exports.removeRoleFromUser = async (req, res) => {
    try {
        const { userId, roleId } = req.params;
        
        // Check if user has this role
        const [userRole] = await db.query(
            'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
            [userId, roleId]
        );
        
        if (userRole.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User does not have this role'
            });
        }
        
        // Remove role
        await db.query(
            'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
            [userId, roleId]
        );
        
        // Get role name to remove from labels
        const [roleDetails] = await db.query(
            'SELECT role_name FROM roles WHERE id = ?',
            [roleId]
        );
        
        if (roleDetails.length > 0) {
            const roleName = roleDetails[0].role_name;
            // Get remaining user roles and update labels
            const [remainingRoles] = await db.query(
                `SELECT r.role_name FROM user_roles ur
                 JOIN roles r ON ur.role_id = r.id
                 WHERE ur.user_id = ? AND ur.is_active = TRUE`,
                [userId]
            );
            
            if (remainingRoles.length > 0) {
                const newLabels = remainingRoles.map(r => r.role_name).join(', ');
                await db.query(
                    'UPDATE users SET labels = ? WHERE id = ?',
                    [newLabels, userId]
                );
            } else {
                // No roles left, clear labels
                await db.query(
                    'UPDATE users SET labels = NULL WHERE id = ?',
                    [userId]
                );
            }
        }
        
        res.json({
            success: true,
            message: 'Role removed successfully'
        });
    } catch (error) {
        console.error('Error removing role:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing role',
            error: error.message
        });
    }
};

// Get users by specific role(s)
exports.getUsersByRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        
        const [users] = await db.query(`
            SELECT DISTINCT
                u.id,
                u.username,
                u.name,
                u.email,
                u.organization,
                u.created_at
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            WHERE ur.role_id = ? AND ur.is_active = TRUE
            ORDER BY u.name
        `, [roleId]);
        
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users by role:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users by role',
            error: error.message
        });
    }
};

// Get role statistics
exports.getRoleStats = async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                r.role_category,
                r.role_name,
                COUNT(ur.id) as user_count
            FROM roles r
            LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = TRUE
            WHERE r.is_active = TRUE
            GROUP BY r.id, r.role_category, r.role_name
            ORDER BY r.role_category, r.role_name
        `);
        
        const groupedStats = {};
        stats.forEach(stat => {
            if (!groupedStats[stat.role_category]) {
                groupedStats[stat.role_category] = [];
            }
            groupedStats[stat.role_category].push({
                role_name: stat.role_name,
                user_count: stat.user_count
            });
        });
        
        res.json({
            success: true,
            data: groupedStats
        });
    } catch (error) {
        console.error('Error fetching role stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching role stats',
            error: error.message
        });
    }
};
