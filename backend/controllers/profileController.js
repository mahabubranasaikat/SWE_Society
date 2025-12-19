const bcrypt = require('bcrypt');
const db = require('../config/db');
const { generateToken } = require('../middleware/auth');

// Helper function to get the correct total posts column name (total_posts or total_posts)
async function getTotalPostsCol() {
    try {
        const [dbNameRows] = await db.query('SELECT DATABASE() as db');
        const dbName = dbNameRows[0]?.db;
        const [rows] = await db.query(
            `SELECT COLUMN_NAME as col
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('total_posts','total_posts')
             LIMIT 1`,
            [dbName]
        );
        return rows[0]?.col || 'total_posts';
    } catch (e) {
        return 'total_posts';
    }
}

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const totalPostsCol = await getTotalPostsCol();
        
        const [users] = await db.query(
            `SELECT id, username, name, email, phone, organization, github_url, linkedin_url, labels, ${totalPostsCol} as total_posts, created_at, updated_at FROM users WHERE id = ?`,
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Get user roles
        const [userRoles] = await db.query(`
            SELECT 
                r.id as role_id,
                r.role_name,
                r.role_category,
                r.description
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = ? AND ur.is_active = TRUE
            ORDER BY r.role_category, r.role_name
        `, [userId]);
        
        // Add roles to user data
        const userData = {
            ...users[0],
            roles: userRoles
        };
        
        res.json({ 
            success: true, 
            data: userData 
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching profile',
            error: error.message 
        });
    }
};

// Get all users (for recipient selection in approvals)
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT id, username, name, email FROM users ORDER BY name ASC`
        );
        
        res.json({ 
            success: true, 
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching users',
            error: error.message 
        });
    }
};

// Create new profile
exports.createProfile = async (req, res) => {
    try {
        const { 
            username, 
            name, 
            email, 
            password, 
            phone, 
            organization, 
            github_url, 
            linkedin_url,
            roles = [],
            position
        } = req.body;
        
        // Validate required fields
        if (!username || !name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, name, email, and password are required' 
            });
        }
        
        // Check if username or email already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({ 
                success: false, 
                message: 'Username or email already exists' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Normalize position and provide sensible default if missing
        const normalizedPosition = typeof position === 'string' 
            ? position.trim().toLowerCase() 
            : 'other';
        const positionValue = ['student', 'teacher', 'other'].includes(normalizedPosition)
            ? normalizedPosition
            : 'other';
        
        // Insert new user (including position field)
        const [result] = await db.query(
            'INSERT INTO users (username, name, email, password, phone, organization, github_url, linkedin_url, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [username, name, email, hashedPassword, phone, organization, github_url, linkedin_url, positionValue]
        );
        
        const userId = result.insertId;
        
        // Assign roles to the new user
        let assignedRoles = Array.isArray(roles) ? roles.filter(r => !!r) : [];
        
        // If no roles provided, infer a default role from position
        if (assignedRoles.length === 0) {
            let defaultRoleName = 'Volunteer';
            if (positionValue === 'student') defaultRoleName = 'Student';
            else if (positionValue === 'teacher') defaultRoleName = 'Teacher';
            
            const [roleRows] = await db.query(
                'SELECT id FROM roles WHERE role_name = ? LIMIT 1',
                [defaultRoleName]
            );
            if (roleRows.length > 0) {
                assignedRoles = [roleRows[0].id];
            }
        }
        
        if (assignedRoles.length > 0) {
            const roleValues = assignedRoles.map(roleId => [userId, roleId, true, new Date()]);
            await db.query(
                'INSERT INTO user_roles (user_id, role_id, is_active, assigned_at) VALUES ?',
                [roleValues]
            );
        }
        
        // Generate JWT token for the new user
        const token = generateToken(userId, username, email);
        
        res.status(201).json({ 
            success: true, 
            message: 'Profile created successfully',
            data: { 
                userId: userId,
                username: username,
                name: name,
                email: email,
                rolesAssigned: assignedRoles.length
            },
            token: token
        });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating profile',
            error: error.message 
        });
    }
};

// Update profile (partial update)
exports.updateProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        
        // Check if the user is updating their own profile
        if (req.user.userId !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own profile'
            });
        }
        
        // Check if user exists
        const [users] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Fields that can be updated
        const allowedFields = [
            'username', 
            'name', 
            'email', 
            'password', 
            'phone', 
            'organization', 
            'github_url', 
            'linkedin_url'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                // Check for duplicate username/email if updating
                if (field === 'username' || field === 'email') {
                    const [existing] = await db.query(
                        `SELECT id FROM users WHERE ${field} = ? AND id != ?`,
                        [updates[field], userId]
                    );
                    if (existing.length > 0) {
                        return res.status(409).json({ 
                            success: false, 
                            message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
                        });
                    }
                }
                
                // Hash password if updating
                if (field === 'password') {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(await bcrypt.hash(updates[field], 10));
                } else {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No valid fields to update' 
            });
        }
        
        updateValues.push(userId);
        
        await db.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        res.json({ 
            success: true, 
            message: 'Profile updated successfully' 
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating profile',
            error: error.message 
        });
    }
};

// Delete profile and all associated posts
exports.deleteProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if the user is deleting their own profile
        if (req.user.userId !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own profile'
            });
        }
        
        // Check if user exists
        const [users] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Delete user (CASCADE will delete associated posts)
        await db.query('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ 
            success: true, 
            message: 'Profile and all associated posts deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting profile',
            error: error.message 
        });
    }
};
