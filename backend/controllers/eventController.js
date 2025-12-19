const db = require('../config/db');
const notificationController = require('./notificationController');

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

exports.listEvents = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const safeLimit = Math.min(parseInt(limit) || 20, 50);
        const offset = (parseInt(page) - 1) * safeLimit;

        const [rows] = await db.query(
            `SELECT e.id, e.title, e.description, e.event_type, e.start_date, e.end_date, 
                    e.registration_link, e.created_at, e.updated_at,
                    u.id as creator_id, u.name as creator_name, u.username as creator_username
             FROM society_events e
             JOIN users u ON e.created_by = u.id
             ORDER BY e.start_date DESC, e.created_at DESC
             LIMIT ? OFFSET ?`,
            [safeLimit, offset]
        );

        // Get total count
        const [countRows] = await db.query('SELECT COUNT(*) as total FROM society_events');

        const data = rows.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            event_type: r.event_type,
            start_date: r.start_date,
            end_date: r.end_date,
            registration_link: r.registration_link,
            created_at: r.created_at,
            updated_at: r.updated_at,
            creator: {
                id: r.creator_id,
                name: r.creator_name,
                username: r.creator_username
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
        console.error('Error listing events:', error);
        res.status(500).json({ success: false, message: 'Error listing events', error: error.message });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await db.query(
            `SELECT e.id, e.title, e.description, e.event_type, e.start_date, e.end_date, 
                    e.registration_link, e.created_at, e.updated_at,
                    u.id as creator_id, u.name as creator_name, u.username as creator_username
             FROM society_events e
             JOIN users u ON e.created_by = u.id
             WHERE e.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const r = rows[0];
        
        // Get event updates
        const [updates] = await db.query(
            `SELECT eu.id, eu.update_text, eu.created_at,
                    u.id as user_id, u.name as user_name, u.username as user_username
             FROM event_updates eu
             JOIN users u ON eu.created_by = u.id
             WHERE eu.event_id = ?
             ORDER BY eu.created_at DESC`,
            [id]
        );

        const eventData = {
            id: r.id,
            title: r.title,
            description: r.description,
            event_type: r.event_type,
            start_date: r.start_date,
            end_date: r.end_date,
            registration_link: r.registration_link,
            created_at: r.created_at,
            updated_at: r.updated_at,
            creator: {
                id: r.creator_id,
                name: r.creator_name,
                username: r.creator_username
            },
            updates: updates.map(u => ({
                id: u.id,
                update_text: u.update_text,
                created_at: u.created_at,
                user: {
                    id: u.user_id,
                    name: u.user_name,
                    username: u.user_username
                }
            }))
        };

        res.json({
            success: true,
            data: eventData
        });
    } catch (error) {
        console.error('Error getting event:', error);
        res.status(500).json({ success: false, message: 'Error getting event', error: error.message });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { title, description, event_type, start_date, end_date, registration_link } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        if (!start_date) {
            return res.status(400).json({ success: false, message: 'Start date is required' });
        }

        // RBAC: must be society/committee role holder
        const isSociety = await userHasSocietyRole(userId);
        if (!isSociety) {
            return res.status(403).json({ success: false, message: 'Only society members can create events' });
        }

        const [result] = await db.query(
            `INSERT INTO society_events (title, description, event_type, start_date, end_date, registration_link, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(), 
                description || null, 
                event_type || 'other', 
                start_date, 
                end_date || null, 
                registration_link || null, 
                userId
            ]
        );

        const eventId = result.insertId;

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
                    'organization_post',
                    'New Event Created',
                    `${actorName} created a new event: "${title.trim()}"`,
                    null,
                    userId,
                    'society_event',
                    eventId
                );
            }
        } catch (notifyErr) {
            console.error('Error broadcasting event notifications:', notifyErr);
        }

        res.status(201).json({ success: true, message: 'Event created', data: { id: eventId } });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, message: 'Error creating event', error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check existence and ownership or society role
        const [rows] = await db.query(
            'SELECT id, created_by FROM society_events WHERE id = ?',
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = rows[0];
        const isSociety = await userHasSocietyRole(userId);
        
        // Allow deletion if user is creator OR has society role
        if (event.created_by !== userId && !isSociety) {
            return res.status(403).json({ success: false, message: 'Only the creator or society members can delete this event' });
        }

        await db.query('DELETE FROM society_events WHERE id = ?', [id]);
        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, message: 'Error deleting event', error: error.message });
    }
};

exports.addEventUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { update_text } = req.body;

        if (!update_text || !update_text.trim()) {
            return res.status(400).json({ success: false, message: 'Update text is required' });
        }

        // Check if event exists
        const [eventRows] = await db.query('SELECT id, title FROM society_events WHERE id = ?', [id]);
        if (eventRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = eventRows[0];

        // Any authenticated user can add updates
        const [result] = await db.query(
            'INSERT INTO event_updates (event_id, update_text, created_by) VALUES (?, ?, ?)',
            [id, update_text.trim(), userId]
        );

        // Notify all users about the update
        try {
            const [recipients] = await db.query(
                `SELECT DISTINCT u.id
                 FROM users u
                 JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = TRUE
                 JOIN roles r ON r.id = ur.role_id
                 WHERE r.role_category = 'user_status' AND u.id != ?`,
                [userId]
            );

            const [actorRows] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
            const actorName = actorRows[0]?.name || 'Someone';

            for (const r of recipients) {
                await notificationController.createNotification(
                    r.id,
                    'organization_post',
                    'Event Update',
                    `${actorName} added an update to event: "${event.title}"`,
                    null,
                    userId,
                    'event_update',
                    id
                );
            }
        } catch (notifyErr) {
            console.error('Error broadcasting event update notifications:', notifyErr);
        }

        res.status(201).json({ 
            success: true, 
            message: 'Update added', 
            data: { id: result.insertId } 
        });
    } catch (error) {
        console.error('Error adding event update:', error);
        res.status(500).json({ success: false, message: 'Error adding event update', error: error.message });
    }
};

exports.getEventUpdates = async (req, res) => {
    try {
        const { id } = req.params;

        const [updates] = await db.query(
            `SELECT eu.id, eu.update_text, eu.created_at,
                    u.id as user_id, u.name as user_name, u.username as user_username
             FROM event_updates eu
             JOIN users u ON eu.created_by = u.id
             WHERE eu.event_id = ?
             ORDER BY eu.created_at DESC`,
            [id]
        );

        res.json({
            success: true,
            data: updates.map(u => ({
                id: u.id,
                update_text: u.update_text,
                created_at: u.created_at,
                user: {
                    id: u.user_id,
                    name: u.user_name,
                    username: u.user_username
                }
            }))
        });
    } catch (error) {
        console.error('Error getting event updates:', error);
        res.status(500).json({ success: false, message: 'Error getting event updates', error: error.message });
    }
};
