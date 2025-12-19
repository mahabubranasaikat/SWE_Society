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

// Helper to check if user is creator of fee collection
async function isFeeCreator(userId, feeId) {
    const [rows] = await db.query('SELECT created_by FROM fee_collections WHERE id = ?', [feeId]);
    return rows.length > 0 && rows[0].created_by === userId;
}

// Helper to check if user is creator of registration (for payment approval)
async function isRegistrationCreator(userId, regId) {
    const [rows] = await db.query('SELECT created_by FROM registrations WHERE id = ?', [regId]);
    return rows.length > 0 && rows[0].created_by === userId;
}

exports.createFeeCollection = async (req, res) => {
    try {
        const { title, description, deadline, amount } = req.body;
        const userId = req.user.userId;

        // Check permissions
        const hasPermission = await hasSocietyRole(userId);
        if (!hasPermission) {
            return res.status(403).json({ success: false, message: 'Only society members can create fee collections' });
        }

        if (!title || !amount) {
            return res.status(400).json({ success: false, message: 'Title and amount are required' });
        }

        const [result] = await db.query(
            'INSERT INTO fee_collections (title, description, deadline, amount, created_by) VALUES (?, ?, ?, ?, ?)',
            [title, description, deadline || null, amount, userId]
        );

        res.json({ success: true, message: 'Fee collection created', data: { id: result.insertId } });
    } catch (error) {
        console.error('Error creating fee:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getFeeCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const [fees] = await db.query(`
            SELECT f.*, u.name as creator_name
            FROM fee_collections f
            JOIN users u ON f.created_by = u.id
            WHERE f.id = ?
        `, [id]);

        if (fees.length === 0) {
            return res.status(404).json({ success: false, message: 'Fee collection not found' });
        }

        const fee = fees[0];

        // Check if user can view this fee collection (creator or committee)
        const canView = fee.created_by === userId || await hasSocietyRole(userId);
        if (!canView) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, data: fee });
    } catch (error) {
        console.error('Error fetching fee collection:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateFeeCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, deadline, amount } = req.body;
        const userId = req.user.userId;

        // Check if user is creator
        if (!(await isFeeCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can update fee collection' });
        }

        // Validate required fields
        if (!title || !amount) {
            return res.status(400).json({ success: false, message: 'Title and amount are required' });
        }

        // Update fee collection
        await db.query(
            'UPDATE fee_collections SET title = ?, description = ?, deadline = ?, amount = ? WHERE id = ?',
            [title, description, deadline || null, amount, id]
        );

        res.json({ success: true, message: 'Fee collection updated successfully' });
    } catch (error) {
        console.error('Error updating fee collection:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getFeeCollections = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [fees] = await db.query(`
            SELECT f.*, u.name as creator_name
            FROM fee_collections f
            JOIN users u ON f.created_by = u.id
            ORDER BY f.created_at DESC
        `);

        const data = await Promise.all(fees.map(async (fee) => {
            const [payment] = await db.query(
                'SELECT status FROM payment_transactions WHERE related_type = "fee_collection" AND related_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
                [fee.id, userId]
            );

            const now = new Date();
            const deadline = fee.deadline ? new Date(fee.deadline) : null;
            const is_open = fee.status === 'active' && (!deadline || deadline > now);

            return {
                ...fee,
                user_status: payment.length > 0 ? payment[0].status : 'not_paid',
                is_creator: fee.created_by === userId,
                is_open
            };
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.submitPayment = async (req, res) => {
    try {
        const { related_type, related_id, payment_method, payment_number, transaction_id, message } = req.body;
        const userId = req.user.userId;

        if (!['registration', 'fee_collection'].includes(related_type)) {
            return res.status(400).json({ success: false, message: 'Invalid type' });
        }

        // Check if open
        let isOpen = true;
        if (related_type === 'registration') {
            const [reg] = await db.query('SELECT status, deadline FROM registrations WHERE id = ?', [related_id]);
            if (reg.length === 0) return res.status(404).json({ success: false, message: 'Registration not found' });
            const now = new Date();
            const deadline = reg[0].deadline ? new Date(reg[0].deadline) : null;
            if (reg[0].status !== 'active' || (deadline && deadline < now)) isOpen = false;
        } else {
            const [fee] = await db.query('SELECT status, deadline FROM fee_collections WHERE id = ?', [related_id]);
            if (fee.length === 0) return res.status(404).json({ success: false, message: 'Fee collection not found' });
            const now = new Date();
            const deadline = fee[0].deadline ? new Date(fee[0].deadline) : null;
            if (fee[0].status !== 'active' || (deadline && deadline < now)) isOpen = false;
        }

        if (!isOpen) {
            return res.status(400).json({ success: false, message: 'This item is closed for payments' });
        }

        // Check if already pending or approved
        const [existing] = await db.query(
            'SELECT status FROM payment_transactions WHERE related_type = ? AND related_id = ? AND user_id = ? AND status IN ("pending", "approved")',
            [related_type, related_id, userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: `Payment already ${existing[0].status}` });
        }

        await db.query(
            'INSERT INTO payment_transactions (user_id, related_type, related_id, payment_method, payment_number, transaction_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, related_type, related_id, payment_method, payment_number, transaction_id, message]
        );

        res.json({ success: true, message: 'Payment submitted for approval' });
    } catch (error) {
        console.error('Error submitting payment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.closeFeeCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!(await isFeeCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can close fee collection' });
        }

        await db.query('UPDATE fee_collections SET status = "closed" WHERE id = ?', [id]);
        res.json({ success: true, message: 'Fee collection closed successfully' });
    } catch (error) {
        console.error('Error closing fee:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteFeeCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!(await isFeeCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can delete fee collection' });
        }

        // Delete related payment transactions
        await db.query('DELETE FROM payment_transactions WHERE related_type = "fee_collection" AND related_id = ?', [id]);
        
        // Delete fee collection
        await db.query('DELETE FROM fee_collections WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Fee collection deleted successfully' });
    } catch (error) {
        console.error('Error deleting fee:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getFeePayments = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!(await isFeeCreator(userId, id))) {
            return res.status(403).json({ success: false, message: 'Only creator can view payments' });
        }

        const [payments] = await db.query(`
            SELECT pt.*, u.name as user_name, u.username as user_username
            FROM payment_transactions pt
            JOIN users u ON pt.user_id = u.id
            WHERE pt.related_type = 'fee_collection' AND pt.related_id = ?
            ORDER BY pt.created_at DESC
        `, [id]);

        res.json({ success: true, data: payments });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params; // transaction id
        const { status } = req.body; // approved, rejected
        const userId = req.user.userId;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Get transaction details to verify ownership
        const [trx] = await db.query('SELECT related_type, related_id FROM payment_transactions WHERE id = ?', [id]);
        if (trx.length === 0) return res.status(404).json({ success: false, message: 'Transaction not found' });

        const { related_type, related_id } = trx[0];
        let authorized = false;

        if (related_type === 'registration') {
            authorized = await isRegistrationCreator(userId, related_id);
        } else {
            authorized = await isFeeCreator(userId, related_id);
        }

        if (!authorized) {
            return res.status(403).json({ success: false, message: 'Not authorized to manage this payment' });
        }

        await db.query('UPDATE payment_transactions SET status = ? WHERE id = ?', [status, id]);

        res.json({ success: true, message: `Payment ${status}` });
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
