const db = require('../config/db');

// Helper to check if user has committee/society role
async function hasSocietyRole(userId) {
    const [roles] = await db.query(
        `SELECT 1 FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? 
        AND (r.role_category IN ('committee', 'system') OR r.role_name LIKE '%Society%' OR r.role_name LIKE '%Admin%') 
        AND ur.is_active = TRUE
        LIMIT 1`,
        [userId]
    );
    return roles.length > 0;
}

// Helper to check if user is creator
async function isCreator(userId, registrationId) {
    const [rows] = await db.query('SELECT created_by FROM registrations WHERE id = ?', [registrationId]);
    return rows.length > 0 && rows[0].created_by === userId;
}

exports.createRegistration = async (req, res) => {
    try {
        const { title, description, deadline, type, fee_amount } = req.body;
        const userId = req.user.userId;

        // Check permissions
        const hasPermission = await hasSocietyRole(userId);
        if (!hasPermission) {
            return res.status(403).json({ success: false, message: 'Only society members can create registrations' });
        }

        if (!title || !type) {
            return res.status(400).json({ success: false, message: 'Title and type are required' });
        }

        if (type === 'paid' && !fee_amount) {
            return res.status(400).json({ success: false, message: 'Fee amount is required for paid registrations' });
        }

        const [result] = await db.query(
            'INSERT INTO registrations (title, description, deadline, type, fee_amount, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description, deadline || null, type, type === 'paid' ? fee_amount : null, userId]
        );

        res.json({ success: true, message: 'Registration created successfully', data: { id: result.insertId } });
    } catch (error) {
        console.error('Error creating registration:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const [registrations] = await db.query(`
            SELECT r.*, u.name as creator_name
            FROM registrations r
            JOIN users u ON r.created_by = u.id
            WHERE r.id = ?
        `, [id]);

        if (registrations.length === 0) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        const reg = registrations[0];

        // Check if user can view this registration (creator or committee)
        const canView = reg.created_by === userId || await hasSocietyRole(userId);
        if (!canView) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, data: reg });
    } catch (error) {
        console.error('Error fetching registration:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, deadline, type, fee_amount } = req.body;
        const userId = req.user.userId;

        // Check if user is creator
        if (!(await isCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can update registration' });
        }

        // Validate required fields
        if (!title || !type) {
            return res.status(400).json({ success: false, message: 'Title and type are required' });
        }

        if (type === 'paid' && !fee_amount) {
            return res.status(400).json({ success: false, message: 'Fee amount is required for paid registrations' });
        }

        // Update registration
        await db.query(
            'UPDATE registrations SET title = ?, description = ?, deadline = ?, type = ?, fee_amount = ? WHERE id = ?',
            [title, description, deadline || null, type, type === 'paid' ? fee_amount : null, id]
        );

        res.json({ success: true, message: 'Registration updated successfully' });
    } catch (error) {
        console.error('Error updating registration:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getRegistrations = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get all registrations
        const [registrations] = await db.query(`
            SELECT r.*, u.name as creator_name
            FROM registrations r
            JOIN users u ON r.created_by = u.id
            ORDER BY r.created_at DESC
        `);

        // For each registration, check status for current user
        const data = await Promise.all(registrations.map(async (reg) => {
            let status = 'not_registered';

            if (reg.type === 'free') {
                const [participant] = await db.query(
                    'SELECT 1 FROM registration_participants WHERE registration_id = ? AND user_id = ?',
                    [reg.id, userId]
                );
                if (participant.length > 0) status = 'registered';
            } else {
                const [payment] = await db.query(
                    'SELECT status FROM payment_transactions WHERE related_type = "registration" AND related_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
                    [reg.id, userId]
                );
                if (payment.length > 0) {
                    status = payment[0].status === 'approved' ? 'registered' : payment[0].status;
                }
            }

            const now = new Date();
            const deadline = reg.deadline ? new Date(reg.deadline) : null;
            const is_open = reg.status === 'active' && (!deadline || deadline > now);

            return {
                ...reg,
                user_status: status,
                is_creator: reg.created_by === userId,
                is_open
            };
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.registerFree = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const [reg] = await db.query('SELECT type, status, deadline FROM registrations WHERE id = ?', [id]);
        if (reg.length === 0) return res.status(404).json({ success: false, message: 'Registration not found' });
        
        const now = new Date();
        const deadline = reg[0].deadline ? new Date(reg[0].deadline) : null;
        if (reg[0].status !== 'active' || (deadline && deadline < now)) {
            return res.status(400).json({ success: false, message: 'Registration is closed' });
        }

        if (reg[0].type !== 'free') return res.status(400).json({ success: false, message: 'This is a paid registration' });

        // Check if already registered
        const [existing] = await db.query(
            'SELECT 1 FROM registration_participants WHERE registration_id = ? AND user_id = ?',
            [id, userId]
        );
        if (existing.length > 0) return res.status(400).json({ success: false, message: 'Already registered' });

        await db.query(
            'INSERT INTO registration_participants (registration_id, user_id) VALUES (?, ?)',
            [id, userId]
        );

        res.json({ success: true, message: 'Registered successfully' });
    } catch (error) {
        console.error('Error registering:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.closeRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!(await isCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can close registration' });
        }

        await db.query('UPDATE registrations SET status = "closed" WHERE id = ?', [id]);
        res.json({ success: true, message: 'Registration closed successfully' });
    } catch (error) {
        console.error('Error closing registration:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!(await isCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can delete registration' });
        }

        // Delete related records
        await db.query('DELETE FROM registration_participants WHERE registration_id = ?', [id]);
        await db.query('DELETE FROM payment_transactions WHERE related_type = "registration" AND related_id = ?', [id]);
        
        // Delete registration
        await db.query('DELETE FROM registrations WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Registration deleted successfully' });
    } catch (error) {
        console.error('Error deleting registration:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getParticipants = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!(await isCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can view participants' });
        }

        const [reg] = await db.query('SELECT type FROM registrations WHERE id = ?', [id]);
        if (reg.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

        let participants;
        if (reg[0].type === 'free') {
            [participants] = await db.query(`
                SELECT u.name, u.username, u.email, rp.registered_at 
                FROM registration_participants rp
                JOIN users u ON rp.user_id = u.id
                WHERE rp.registration_id = ?
                ORDER BY rp.registered_at DESC
            `, [id]);
        } else {
            // For paid, participants are those with approved payments
            [participants] = await db.query(`
                SELECT u.name, u.username, u.email, pt.updated_at as registered_at,
                       pt.payment_method, pt.payment_number, pt.transaction_id, pt.amount
                FROM payment_transactions pt
                JOIN users u ON pt.user_id = u.id
                WHERE pt.related_type = 'registration' AND pt.related_id = ? AND pt.status = 'approved'
                ORDER BY pt.updated_at DESC
            `, [id]);
        }

        res.json({ success: true, data: participants });
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getPayments = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!(await isCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can view payments' });
        }

        const [payments] = await db.query(`
            SELECT pt.*, u.name as user_name, u.username as user_username
            FROM payment_transactions pt
            JOIN users u ON pt.user_id = u.id
            WHERE pt.related_type = 'registration' AND pt.related_id = ?
            ORDER BY pt.created_at DESC
        `, [id]);

        res.json({ success: true, data: payments });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
