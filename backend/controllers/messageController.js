const db = require('../config/db');

// Helper to consistently order userIds so (user1_id, user2_id) is unique
function orderPair(a, b) {
    const id1 = Number(a);
    const id2 = Number(b);
    return id1 < id2 ? [id1, id2] : [id2, id1];
}

// Ensure both users exist
async function ensureUsersExist(userIdA, userIdB) {
    const [rows] = await db.query('SELECT id FROM users WHERE id IN (?, ?)', [userIdA, userIdB]);
    return rows.length === 2;
}

// Get or create a conversation for two users
async function getOrCreateConversation(userIdA, userIdB) {
    const [u1, u2] = orderPair(userIdA, userIdB);

    const [existing] = await db.query(
        'SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ? LIMIT 1',
        [u1, u2]
    );

    if (existing.length > 0) {
        return existing[0];
    }

    const [result] = await db.query(
        'INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)',
        [u1, u2]
    );

    const [created] = await db.query('SELECT * FROM conversations WHERE id = ?', [result.insertId]);
    return created[0];
}

exports.searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        const me = req.user.userId;

        if (!q || String(q).trim() === '') {
            return res.json({ success: true, data: [] });
        }

        const like = `%${q.trim()}%`;
        const [rows] = await db.query(
            `SELECT id, username, name
             FROM users
             WHERE (username LIKE ? OR name LIKE ?)
               AND id != ?
             ORDER BY username LIMIT 20`,
            [like, like, me]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error searching users', error: error.message });
    }
};

exports.startConversation = async (req, res) => {
    try {
        const me = req.user.userId;
        const { targetUserId } = req.body;

        if (!targetUserId || Number(targetUserId) === Number(me)) {
            return res.status(400).json({ success: false, message: 'Invalid target user' });
        }

        const exists = await ensureUsersExist(me, targetUserId);
        if (!exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check global messaging settings for both users
        const [settings] = await db.query(
            'SELECT id, messaging_enabled FROM users WHERE id IN (?, ?)',
            [me, targetUserId]
        );
        const mySetting = settings.find(r => r.id === Number(me));
        const theirSetting = settings.find(r => r.id === Number(targetUserId));
        if (!mySetting.messaging_enabled || !theirSetting.messaging_enabled) {
            return res.status(403).json({ success: false, message: 'Messaging is disabled for one or both users' });
        }

        const convo = await getOrCreateConversation(me, targetUserId);
        res.status(201).json({ success: true, data: convo });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error starting conversation', error: error.message });
    }
};

exports.listConversations = async (req, res) => {
    try {
        const me = req.user.userId;
        const [rows] = await db.query(
            `SELECT 
                c.id,
                c.user1_id,
                c.user2_id,
                c.is_muted,
                c.last_message_at,
                CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END AS other_id,
                CASE WHEN c.user1_id = ? THEN c.user1_unread ELSE c.user2_unread END AS unread_count,
                u.username AS other_username,
                u.name AS other_name,
                (
                    SELECT m.content FROM messages m 
                    WHERE m.conversation_id = c.id 
                    ORDER BY m.created_at DESC 
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT m.created_at FROM messages m 
                    WHERE m.conversation_id = c.id 
                    ORDER BY m.created_at DESC 
                    LIMIT 1
                ) AS last_message_time
             FROM conversations c
             JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
             WHERE c.user1_id = ? OR c.user2_id = ?
             ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC`,
            [me, me, me, me, me]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error listing conversations', error: error.message });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const me = req.user.userId;
        const { conversationId } = req.params;

        const [convRows] = await db.query('SELECT * FROM conversations WHERE id = ?', [conversationId]);
        if (convRows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
        const c = convRows[0];
        if (c.user1_id !== Number(me) && c.user2_id !== Number(me)) {
            return res.status(403).json({ success: false, message: 'Not a participant' });
        }

        const [msgs] = await db.query(
            'SELECT id, sender_id, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 500',
            [conversationId]
        );

        res.json({ success: true, data: msgs, meta: { is_muted: !!c.is_muted } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error getting messages', error: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const me = req.user.userId;
        const { conversationId } = req.params;
        const { content } = req.body;

        if (!content || String(content).trim() === '') {
            return res.status(400).json({ success: false, message: 'Message content is required' });
        }

        const [convRows] = await db.query('SELECT * FROM conversations WHERE id = ?', [conversationId]);
        if (convRows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
        const c = convRows[0];
        if (c.user1_id !== Number(me) && c.user2_id !== Number(me)) {
            return res.status(403).json({ success: false, message: 'Not a participant' });
        }

        if (c.is_muted) {
            return res.status(403).json({ success: false, message: 'Conversation is muted' });
        }

        // Check global messaging setting for both users
        const otherId = c.user1_id === Number(me) ? c.user2_id : c.user1_id;
        const [settings] = await db.query('SELECT id, messaging_enabled FROM users WHERE id IN (?, ?)', [me, otherId]);
        const mySetting = settings.find(r => r.id === Number(me));
        const theirSetting = settings.find(r => r.id === Number(otherId));
        if (!mySetting.messaging_enabled || !theirSetting.messaging_enabled) {
            return res.status(403).json({ success: false, message: 'Messaging disabled for one or both users' });
        }

        const [result] = await db.query(
            'INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)',
            [conversationId, me, content.trim()]
        );
        
        // Increment unread count for the other user
        const unreadField = c.user1_id === Number(me) ? 'user2_unread' : 'user1_unread';
        await db.query(
            `UPDATE conversations SET last_message_at = NOW(), ${unreadField} = ${unreadField} + 1 WHERE id = ?`,
            [conversationId]
        );

        const [msgRows] = await db.query('SELECT id, sender_id, content, created_at FROM messages WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, data: msgRows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error sending message', error: error.message });
    }
};

exports.setMute = async (req, res) => {
    try {
        const me = req.user.userId;
        const { conversationId } = req.params;
        const { mute } = req.body;

        const [convRows] = await db.query('SELECT * FROM conversations WHERE id = ?', [conversationId]);
        if (convRows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
        const c = convRows[0];
        if (c.user1_id !== Number(me) && c.user2_id !== Number(me)) {
            return res.status(403).json({ success: false, message: 'Not a participant' });
        }

        await db.query('UPDATE conversations SET is_muted = ? WHERE id = ?', [!!mute, conversationId]);
        res.json({ success: true, data: { conversationId: Number(conversationId), is_muted: !!mute } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating mute state', error: error.message });
    }
};

exports.getSettings = async (req, res) => {
    try {
        const me = req.user.userId;
        const [rows] = await db.query('SELECT messaging_enabled FROM users WHERE id = ?', [me]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: { messaging_enabled: !!rows[0].messaging_enabled } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching settings', error: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const me = req.user.userId;
        const { enabled } = req.body;
        if (enabled === undefined) {
            return res.status(400).json({ success: false, message: 'enabled is required' });
        }
        await db.query('UPDATE users SET messaging_enabled = ? WHERE id = ?', [!!enabled, me]);
        res.json({ success: true, data: { messaging_enabled: !!enabled } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating settings', error: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const me = req.user.userId;
        const { conversationId } = req.params;

        const [convRows] = await db.query('SELECT * FROM conversations WHERE id = ?', [conversationId]);
        if (convRows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
        const c = convRows[0];
        if (c.user1_id !== Number(me) && c.user2_id !== Number(me)) {
            return res.status(403).json({ success: false, message: 'Not a participant' });
        }

        const unreadField = c.user1_id === Number(me) ? 'user1_unread' : 'user2_unread';
        await db.query(`UPDATE conversations SET ${unreadField} = 0 WHERE id = ?`, [conversationId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error marking as read', error: error.message });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const me = req.user.userId;
        const [rows] = await db.query(
            `SELECT SUM(CASE WHEN user1_id = ? THEN user1_unread ELSE user2_unread END) as total_unread
             FROM conversations
             WHERE user1_id = ? OR user2_id = ?`,
            [me, me, me]
        );
        const totalUnread = rows[0]?.total_unread || 0;
        res.json({ success: true, data: { unread_count: Number(totalUnread) } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error getting unread count', error: error.message });
    }
};
