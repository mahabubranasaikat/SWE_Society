const db = require('../config/db');

// Helper function to check if user has committee role
async function hasCommitteeRole(userId) {
    const [roles] = await db.query(
        `SELECT 1 FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
        LIMIT 1`,
        [userId]
    );
    return roles.length > 0;
}

// Helper function to check if user is President or Treasurer
async function isPresidentOrTreasurer(userId) {
    const [roles] = await db.query(
        `SELECT r.role_name FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? AND r.role_name IN ('President', 'Treasurer') AND ur.is_active = TRUE
        LIMIT 1`,
        [userId]
    );
    return roles.length > 0;
}

// Helper function to ensure user has access to group (auto-joins committee members to discussions)
async function ensureGroupAccess(userId, groupId) {
    // Check if member
    const [membership] = await db.query(
        'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
    );

    if (membership.length > 0) {
        return { allowed: true, role: membership[0].role };
    }

    // Check if group is discussion and user is committee
    const [group] = await db.query(
        'SELECT is_discussion FROM group_conversations WHERE id = ?',
        [groupId]
    );

    if (group.length === 0) return { allowed: false };

    if (group[0].is_discussion) {
        const isCommittee = await hasCommitteeRole(userId);
        if (isCommittee) {
            // Auto-join
            await db.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                [groupId, userId, 'member']
            );
            return { allowed: true, role: 'member' };
        }
    }

    return { allowed: false };
}

// Initialize default discussion groups
async function initializeDefaultGroups() {
    try {
        // Check if default groups already exist
        const [existing] = await db.query(
            'SELECT COUNT(*) as count FROM group_conversations WHERE is_default = TRUE'
        );

        if (existing[0].count >= 2) {
            return; // Already initialized
        }

        // Get the first committee member as creator
        const [firstCommittee] = await db.query(
            `SELECT DISTINCT u.id FROM users u
            INNER JOIN user_roles ur ON u.id = ur.user_id
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE r.role_category = 'committee' AND ur.is_active = TRUE
            LIMIT 1`
        );

        if (firstCommittee.length === 0) {
            return; // No committee members yet
        }

        const creatorId = firstCommittee[0].id;

        // Create Society group (committee members except President and Treasurer)
        const [societyResult] = await db.query(
            `INSERT INTO group_conversations (name, creator_id, is_default, is_discussion, group_type) 
            VALUES ('Society', ?, TRUE, TRUE, 'society')`,
            [creatorId]
        );
        const societyGroupId = societyResult.insertId;

        // Create Committee group (all committee members)
        const [committeeResult] = await db.query(
            `INSERT INTO group_conversations (name, creator_id, is_default, is_discussion, group_type) 
            VALUES ('Committee', ?, TRUE, TRUE, 'committee')`,
            [creatorId]
        );
        const committeeGroupId = committeeResult.insertId;

        // Add creator to both groups
        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [societyGroupId, creatorId, 'creator']
        );
        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [committeeGroupId, creatorId, 'creator']
        );

        console.log('Default discussion groups initialized successfully');
    } catch (error) {
        console.error('Error initializing default groups:', error);
    }
}

// Get discussion groups for current user
exports.getDiscussions = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Check if user has committee role
        const hasCommittee = await hasCommitteeRole(userId);
        if (!hasCommittee) {
            return res.json({ success: true, data: [] });
        }

        // Initialize default groups if needed
        await initializeDefaultGroups();

        // Check if user is President or Treasurer
        const isPrezOrTreasurer = await isPresidentOrTreasurer(userId);

        let groups;
        if (isPrezOrTreasurer) {
            // President and Treasurer see only Committee group (not Society group)
            [groups] = await db.query(
                `SELECT 
                    gc.id, 
                    gc.name, 
                    gc.creator_id,
                    gc.is_default,
                    gc.is_discussion,
                    gc.group_type,
                    gc.created_at,
                    (SELECT COUNT(*) FROM group_members WHERE group_id = gc.id) as member_count,
                    (SELECT content FROM group_messages WHERE group_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM group_messages WHERE group_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message_at
                FROM group_conversations gc
                WHERE gc.is_discussion = TRUE 
                AND (gc.group_type = 'committee' OR gc.group_type = 'regular')
                ORDER BY gc.is_default DESC, COALESCE(last_message_at, gc.created_at) DESC, gc.created_at DESC`
            );
        } else {
            // Other committee members see both default groups + regular discussions
            [groups] = await db.query(
                `SELECT 
                    gc.id, 
                    gc.name, 
                    gc.creator_id,
                    gc.is_default,
                    gc.is_discussion,
                    gc.group_type,
                    gc.created_at,
                    (SELECT COUNT(*) FROM group_members WHERE group_id = gc.id) as member_count,
                    (SELECT content FROM group_messages WHERE group_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM group_messages WHERE group_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message_at
                FROM group_conversations gc
                WHERE gc.is_discussion = TRUE
                ORDER BY gc.is_default DESC, COALESCE(last_message_at, gc.created_at) DESC, gc.created_at DESC`
            );
        }

        res.json({ success: true, data: groups });
    } catch (error) {
        console.error('Error fetching discussions:', error);
        res.status(500).json({ success: false, message: 'Error fetching discussions', error: error.message });
    }
};

// Create a new group
exports.createGroup = async (req, res) => {
    try {
        const creatorId = req.user.userId;
        const { name, memberIds, isDiscussion } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Group name is required' });
        }

        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one member must be selected' });
        }

        // If creating a discussion, check if user has committee role
        if (isDiscussion) {
            const hasCommittee = await hasCommitteeRole(creatorId);
            if (!hasCommittee) {
                return res.status(403).json({ success: false, message: 'Only committee members can create discussions' });
            }
        }

        // Create the group
        const [result] = await db.query(
            'INSERT INTO group_conversations (name, creator_id, is_discussion, group_type) VALUES (?, ?, ?, ?)',
            [name.trim(), creatorId, isDiscussion || false, 'regular']
        );
        const groupId = result.insertId;

        // Add creator as a member with 'creator' role
        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, creatorId, 'creator']
        );

        // Add selected members
        const memberValues = memberIds
            .filter(id => Number(id) !== Number(creatorId)) // Don't add creator again
            .map(id => [groupId, id, 'member']);

        if (memberValues.length > 0) {
            await db.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES ?',
                [memberValues]
            );
        }

        res.status(201).json({
            success: true,
            data: { id: groupId, name: name.trim() },
            message: isDiscussion ? 'Discussion created successfully' : 'Group created successfully'
        });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ success: false, message: 'Error creating group', error: error.message });
    }
};

// Get all groups for current user
exports.getMyGroups = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [groups] = await db.query(
            `SELECT 
                gc.id, 
                gc.name, 
                gc.creator_id,
                gc.created_at,
                gc.is_default,
                gc.is_discussion,
                gm.role,
                IF(gc.creator_id = ?, 1, 0) as is_creator,
                (SELECT COUNT(*) FROM group_members WHERE group_id = gc.id) as member_count,
                (SELECT content FROM group_messages WHERE group_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM group_messages WHERE group_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message_at
            FROM group_conversations gc
            INNER JOIN group_members gm ON gc.id = gm.group_id
            WHERE gm.user_id = ?
            ORDER BY last_message_at DESC, gc.created_at DESC`,
            [userId, userId]
        );

        res.json({ success: true, data: groups });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ success: false, message: 'Error fetching groups', error: error.message });
    }
};

// Get group details including members
exports.getGroupDetails = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;

        // Check access
        const access = await ensureGroupAccess(userId, groupId);
        if (!access.allowed) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        // Get group info
        const [groupInfo] = await db.query(
            'SELECT id, name, creator_id, created_at, is_default FROM group_conversations WHERE id = ?',
            [groupId]
        );

        if (groupInfo.length === 0) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        // Get members
        const [members] = await db.query(
            `SELECT 
                u.id, 
                u.name, 
                u.username,
                u.position,
                gm.role,
                gm.joined_at
            FROM group_members gm
            INNER JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            ORDER BY gm.role DESC, u.name ASC`,
            [groupId]
        );

        res.json({
            success: true,
            data: {
                ...groupInfo[0],
                user_role: access.role,
                is_creator: Number(groupInfo[0].creator_id) === Number(userId),
                members
            }
        });
    } catch (error) {
        console.error('Error fetching group details:', error);
        res.status(500).json({ success: false, message: 'Error fetching group details', error: error.message });
    }
};

// Get group messages
exports.getGroupMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;

        // Check access
        const access = await ensureGroupAccess(userId, groupId);
        if (!access.allowed) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        // Get messages
        const [messages] = await db.query(
            `SELECT 
                gm.id,
                gm.content,
                gm.sender_id,
                gm.created_at,
                u.name as sender_name,
                u.username as sender_username
            FROM group_messages gm
            INNER JOIN users u ON gm.sender_id = u.id
            WHERE gm.group_id = ?
            ORDER BY gm.created_at ASC`,
            [groupId]
        );

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, message: 'Error fetching messages', error: error.message });
    }
};

// Send a message to group
exports.sendGroupMessage = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Message content is required' });
        }

        // Check access
        const access = await ensureGroupAccess(userId, groupId);
        if (!access.allowed) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        // Insert message
        const [result] = await db.query(
            'INSERT INTO group_messages (group_id, sender_id, content) VALUES (?, ?, ?)',
            [groupId, userId, content.trim()]
        );

        // Get the inserted message with sender info
        const [messages] = await db.query(
            `SELECT 
                gm.id,
                gm.content,
                gm.sender_id,
                gm.created_at,
                u.name as sender_name,
                u.username as sender_username
            FROM group_messages gm
            INNER JOIN users u ON gm.sender_id = u.id
            WHERE gm.id = ?`,
            [result.insertId]
        );

        res.status(201).json({ success: true, data: messages[0] });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Error sending message', error: error.message });
    }
};

// Add members to group (any member can add)
exports.addMembers = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;
        const { memberIds } = req.body;

        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Member IDs are required' });
        }

        // Check if user is a member
        const [membership] = await db.query(
            'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        // Get existing members to avoid duplicates
        const [existing] = await db.query(
            'SELECT user_id FROM group_members WHERE group_id = ?',
            [groupId]
        );
        const existingIds = existing.map(m => m.user_id);

        // Filter out already-existing members
        const newMemberIds = memberIds.filter(id => !existingIds.includes(Number(id)));

        if (newMemberIds.length === 0) {
            return res.json({ success: true, message: 'All selected users are already members' });
        }

        // Add new members
        const memberValues = newMemberIds.map(id => [groupId, id, 'member']);
        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES ?',
            [memberValues]
        );

        res.json({ success: true, message: `${newMemberIds.length} member(s) added successfully` });
    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ success: false, message: 'Error adding members', error: error.message });
    }
};

// Remove member from group (creator only)
exports.removeMember = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId, memberId } = req.params;

        // Check if user is the creator
        const [group] = await db.query(
            'SELECT creator_id FROM group_conversations WHERE id = ?',
            [groupId]
        );

        if (group.length === 0) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        if (Number(group[0].creator_id) !== Number(userId)) {
            return res.status(403).json({ success: false, message: 'Only the group creator can remove members' });
        }

        if (Number(memberId) === Number(userId)) {
            return res.status(400).json({ success: false, message: 'Cannot remove yourself from the group' });
        }

        // Remove member
        const [result] = await db.query(
            'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, memberId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Member not found in group' });
        }

        res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ success: false, message: 'Error removing member', error: error.message });
    }
};

// Delete group (creator only)
exports.deleteGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;

        // Check if user is the creator and if group is default
        const [group] = await db.query(
            'SELECT creator_id, is_default FROM group_conversations WHERE id = ?',
            [groupId]
        );

        if (group.length === 0) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        // Prevent deletion of default groups
        if (group[0].is_default) {
            return res.status(403).json({ success: false, message: 'Default discussion groups cannot be deleted' });
        }

        if (Number(group[0].creator_id) !== Number(userId)) {
            return res.status(403).json({ success: false, message: 'Only the group creator can delete the group' });
        }

        // Delete group (cascade will remove members and messages)
        await db.query('DELETE FROM group_conversations WHERE id = ?', [groupId]);

        res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ success: false, message: 'Error deleting group', error: error.message });
    }
};

// Leave group (any member can leave, except creator unless it's a default group)
exports.leaveGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;

        // Check if group exists
        const [group] = await db.query(
            'SELECT creator_id, is_default FROM group_conversations WHERE id = ?',
            [groupId]
        );

        if (group.length === 0) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        // Creators cannot leave their own group, they must delete it (unless it's a default group)
        if (Number(group[0].creator_id) === Number(userId) && !group[0].is_default) {
            return res.status(400).json({ success: false, message: 'Group creator cannot leave. Delete the group instead.' });
        }

        // Remove user from group
        const [result] = await db.query(
            'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'You are not a member of this group' });
        }

        res.json({ success: true, message: 'You have left the group' });
    } catch (error) {
        console.error('Error leaving group:', error);
        res.status(500).json({ success: false, message: 'Error leaving group', error: error.message });
    }
};

// Get all users for member selection
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT id, name, username, position, organization
            FROM users
            ORDER BY name ASC`
        );

        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Error fetching users', error: error.message });
    }
};

// Get users by role (for batch selection)
exports.getUsersByRole = async (req, res) => {
    try {
        const { role } = req.params;

        let query, params;

        if (role === 'all') {
            // Get all users
            query = `SELECT id, name, username, position, organization
                FROM users
                ORDER BY name ASC`;
            params = [];
        } else if (role === 'committee') {
            // Get users who have committee roles
            query = `SELECT DISTINCT u.id, u.name, u.username, u.position, u.organization
                FROM users u
                INNER JOIN user_roles ur ON u.id = ur.user_id
                INNER JOIN roles r ON ur.role_id = r.id
                WHERE r.role_category = 'committee' AND ur.is_active = TRUE
                ORDER BY u.name ASC`;
            params = [];
        } else if (role === 'alumni') {
            // Get users with alumni role
            query = `SELECT DISTINCT u.id, u.name, u.username, u.position, u.organization
                FROM users u
                INNER JOIN user_roles ur ON u.id = ur.user_id
                INNER JOIN roles r ON ur.role_id = r.id
                WHERE r.role_name = 'Alumni' AND ur.is_active = TRUE
                ORDER BY u.name ASC`;
            params = [];
        } else if (['student', 'teacher', 'other'].includes(role)) {
            // Legacy support for position-based roles
            query = `SELECT id, name, username, position, organization
                FROM users
                WHERE position = ?
                ORDER BY name ASC`;
            params = [role];
        } else {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }

        const [users] = await db.query(query, params);

        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching users by role:', error);
        res.status(500).json({ success: false, message: 'Error fetching users', error: error.message });
    }
};

// Get committee members for discussion creation
exports.getCommitteeMembers = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Check if user has committee role
        const hasCommittee = await hasCommitteeRole(userId);
        if (!hasCommittee) {
            return res.status(403).json({ success: false, message: 'Only committee members can access this' });
        }

        // Get all committee members
        const [members] = await db.query(
            `SELECT DISTINCT u.id, u.name, u.username, u.position, u.organization, r.role_name
            FROM users u
            INNER JOIN user_roles ur ON u.id = ur.user_id
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE r.role_category = 'committee' AND ur.is_active = TRUE
            ORDER BY u.name ASC`
        );

        res.json({ success: true, data: members });
    } catch (error) {
        console.error('Error fetching committee members:', error);
        res.status(500).json({ success: false, message: 'Error fetching committee members', error: error.message });
    }
};
