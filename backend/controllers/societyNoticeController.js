const db = require('../config/db');
const notificationController = require('./notificationController');
const { optionalAuth, verifyToken } = require('../middleware/auth');

async function userHasSocietyRole(userId) {
    const [rows] = await db.query(
        `SELECT COUNT(*) as cnt
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND ur.is_active = TRUE AND r.role_category = 'committee'`,
        [userId]
    );
    return rows[0]?.cnt > 0;
}

exports.listNotices = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const safeLimit = Math.min(parseInt(limit) || 20, 50);
        const offset = (parseInt(page) - 1) * safeLimit;

        const [rows] = await db.query(
            `SELECT n.id, n.title, n.description, n.tag, n.created_at,
                    u.id as author_id, u.name as author_name, u.username as author_username
             FROM society_notices n
             JOIN users u ON n.created_by = u.id
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            [safeLimit, offset]
        );

        // Total count
        const [countRows] = await db.query('SELECT COUNT(*) as total FROM society_notices');

        // Prepare short preview client can use directly
        const data = rows.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            tag: r.tag,
            short_description: r.description ? (r.description.length > 180 ? r.description.slice(0, 177) + '...' : r.description) : '',
            created_at: r.created_at,
            author: {
                id: r.author_id,
                name: r.author_name,
                username: r.author_username
            }
        }));

        res.json({
            success: true,
            data,
            pagination: {
                page: parseInt(page),
                limit: safeLimit,
                total: countRows[0].total
            }
        });
    } catch (error) {
        console.error('Error listing notices:', error);
        res.status(500).json({ success: false, message: 'Error listing notices', error: error.message });
    }
};

exports.createNotice = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { title, description, tag } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'title is required' });
        }

        // RBAC: must be society role holder
        const isSociety = await userHasSocietyRole(userId);
        if (!isSociety) {
            return res.status(403).json({ success: false, message: 'Only society members can create notices' });
        }

        const [result] = await db.query(
            'INSERT INTO society_notices (title, description, tag, created_by) VALUES (?, ?, ?, ?)',
            [title.trim(), description || null, tag || 'notice', userId]
        );

        const noticeId = result.insertId;

        // Broadcast notification to all users with user_status roles
        try {
            const [recipients] = await db.query(
                `SELECT DISTINCT u.id
                 FROM users u
                 JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = TRUE
                 JOIN roles r ON r.id = ur.role_id
                 WHERE r.role_category = 'user_status'`
            );

            // Get actor name
            const [actorRows] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
            const actorName = actorRows[0]?.name || 'A society member';

            for (const r of recipients) {
                await notificationController.createNotification(
                    r.id,
                    // Use organization_post type for society-wide notifications
                    'organization_post',
                    'New Society Notice',
                    `${actorName} posted a new notice: "${title.trim()}"`,
                    null,
                    userId,
                    'society_notice',
                    noticeId
                );
            }
        } catch (notifyErr) {
            console.error('Error broadcasting society notice notifications:', notifyErr);
            // Do not fail the creation if notifications fail
        }

        res.status(201).json({ success: true, message: 'Notice created', data: { id: noticeId } });
    } catch (error) {
        console.error('Error creating notice:', error);
        res.status(500).json({ success: false, message: 'Error creating notice', error: error.message });
    }
};

exports.getNoticeById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT n.id, n.title, n.description, n.tag, n.created_at,
                    u.id as author_id, u.name as author_name, u.username as author_username
             FROM society_notices n
             JOIN users u ON n.created_by = u.id
             WHERE n.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Notice not found' });
        }
        const r = rows[0];
        res.json({
            success: true,
            data: {
                id: r.id,
                title: r.title,
                description: r.description,
                tag: r.tag,
                created_at: r.created_at,
                author: { id: r.author_id, name: r.author_name, username: r.author_username }
            }
        });
    } catch (error) {
        console.error('Error getting notice:', error);
        res.status(500).json({ success: false, message: 'Error getting notice', error: error.message });
    }
};

exports.deleteNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check existence and ownership
        const [rows] = await db.query(
            'SELECT id, created_by FROM society_notices WHERE id = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Notice not found' });
        }
        const notice = rows[0];
        if (notice.created_by !== userId) {
            return res.status(403).json({ success: false, message: 'Only the creator can delete this notice' });
        }

        await db.query('DELETE FROM society_notices WHERE id = ?', [id]);
        res.json({ success: true, message: 'Notice deleted' });
    } catch (error) {
        console.error('Error deleting notice:', error);
        res.status(500).json({ success: false, message: 'Error deleting notice', error: error.message });
    }
};
