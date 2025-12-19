const db = require('../config/db');

// Get user's notifications
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, unread_only = false } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT n.*, 
                   u.username as actor_username, 
                   u.name as actor_name,
                   p.name as post_name
            FROM notifications n
            LEFT JOIN users u ON n.actor_user_id = u.id
            LEFT JOIN posts p ON n.post_id = p.id
            WHERE n.user_id = ?
        `;
        const params = [userId];
        
        if (unread_only === 'true') {
            query += ' AND n.is_read = FALSE';
        }
        
        query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [notifications] = await db.query(query, params);
        
        // Get unread count
        const [unreadResult] = await db.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        
        res.json({
            success: true,
            data: notifications,
            unread_count: unreadResult[0].unread_count,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
};

// Mark notification(s) as read
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { notification_ids } = req.body; // Array of notification IDs or 'all'
        
        if (notification_ids === 'all') {
            // Mark all notifications as read
            await db.query(
                'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
                [userId]
            );
        } else if (Array.isArray(notification_ids)) {
            // Mark specific notifications as read
            if (notification_ids.length > 0) {
                const placeholders = notification_ids.map(() => '?').join(',');
                await db.query(
                    `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND id IN (${placeholders})`,
                    [userId, ...notification_ids]
                );
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'notification_ids must be an array or "all"'
            });
        }
        
        res.json({
            success: true,
            message: 'Notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notifications as read',
            error: error.message
        });
    }
};

// Create notification (internal function)
exports.createNotification = async (recipientId, type, title, message, postId, actorUserId, entityType = 'post', entityId = null) => {
    try {
        if (recipientId === actorUserId) {
            return;
        }
        
        const finalCommentId = entityType === 'comment' ? entityId : null;
        
        await db.query(
            `INSERT INTO notifications (user_id, actor_user_id, type, title, message, post_id, comment_id, entity_type, entity_id, is_read) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [recipientId, actorUserId, type, title, message, postId, finalCommentId, entityType, entityId, false]
        );
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Create post like notification
exports.createLikeNotification = async (postId, actorUserId) => {
    try {
        // Get post details and owner
        const [posts] = await db.query(
            'SELECT p.name, p.user_id, u.name as owner_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [postId]
        );
        
        if (posts.length === 0) return;
        
        const post = posts[0];
        
        // Get actor details
        const [actors] = await db.query('SELECT name FROM users WHERE id = ?', [actorUserId]);
        if (actors.length === 0) return;
        
        const actorName = actors[0].name;
        
        await exports.createNotification(
            post.user_id,
            'like',
            'New like on your post',
            `${actorName} liked your post "${post.name}"`,
            postId,
            actorUserId,
            'post',
            postId
        );
    } catch (error) {
        console.error('Error creating like notification:', error);
    }
};

// Create post comment notification
exports.createCommentNotification = async (postId, commentId, actorUserId) => {
    try {
        // Get post details and owner
        const [posts] = await db.query(
            'SELECT p.name, p.user_id, u.name as owner_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [postId]
        );
        
        if (posts.length === 0) return;
        
        const post = posts[0];
        
        // Get actor details
        const [actors] = await db.query('SELECT name FROM users WHERE id = ?', [actorUserId]);
        if (actors.length === 0) return;
        
        const actorName = actors[0].name;
        
        await exports.createNotification(
            post.user_id,
            'comment',
            'New comment on your post',
            `${actorName} commented on your post "${post.name}"`,
            postId,
            actorUserId,
            'comment',
            commentId
        );
    } catch (error) {
        console.error('Error creating comment notification:', error);
    }
};

// Create organization post notification
exports.createOrganizationPostNotification = async (postId, actorUserId) => {
    try {
        // Get post details
        const [posts] = await db.query(
            'SELECT p.name, p.organization, u.name as creator_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [postId]
        );
        
        if (posts.length === 0 || !posts[0].organization) return;
        
        const post = posts[0];
        
        // Get all users in the same organization (excluding the creator)
        const [orgUsers] = await db.query(
            'SELECT id FROM users WHERE organization = ? AND id != ?',
            [post.organization, actorUserId]
        );
        
        // Create notifications for all organization members
        for (const user of orgUsers) {
            await exports.createNotification(
                user.id,
                'organization_post',
                'New post in your organization',
                `${post.creator_name} created a new post "${post.name}" in ${post.organization}`,
                postId,
                actorUserId,
                'post',
                postId
            );
        }
    } catch (error) {
        console.error('Error creating organization post notification:', error);
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { notificationId } = req.params;
        
        // Verify notification belongs to user
        const [notifications] = await db.query(
            'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
        
        if (notifications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        
        await db.query('DELETE FROM notifications WHERE id = ?', [notificationId]);
        
        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting notification',
            error: error.message
        });
    }
};

// Get unread notifications count
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const [result] = await db.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        
        res.json({
            success: true,
            unread_count: result[0].unread_count
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting unread count',
            error: error.message
        });
    }
};