const db = require('../config/db');

// ==================== CREATE APPROVAL REQUEST ====================
exports.createApprovalRequest = async (req, res) => {
    try {
        const { title, description, recipientIds, deadline } = req.body;
        const userId = req.user?.userId;

        // Enhanced validation
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Validate title
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid title is required' 
            });
        }

        if (title.length > 255) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title must be less than 255 characters' 
            });
        }

        // Validate description length if provided
        if (description && description.length > 2000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Description must be less than 2000 characters' 
            });
        }

        // Validate recipientIds
        if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one recipient is required' 
            });
        }

        // Validate all recipient IDs are positive integers
        const validRecipientIds = recipientIds.filter(id => 
            Number.isInteger(id) && id > 0
        );

        if (validRecipientIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid recipient IDs are required' 
            });
        }

        // Remove duplicates
        const uniqueRecipientIds = [...new Set(validRecipientIds)];

        // Prevent user from adding themselves as recipient
        const finalRecipientIds = uniqueRecipientIds.filter(id => id !== userId);

        if (finalRecipientIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot create approval with only yourself as recipient' 
            });
        }

        // Validate deadline if provided
        if (deadline) {
            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid deadline format' 
                });
            }
            if (deadlineDate < new Date()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Deadline must be in the future' 
                });
            }
        }

        // Start transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Verify all recipients exist and are valid users
            const [recipientCheck] = await connection.query(
                `SELECT id FROM users WHERE id IN (?)`,
                [finalRecipientIds]
            );

            if (recipientCheck.length !== finalRecipientIds.length) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: 'Some recipients are invalid users'
                });
            }

            // Create approval request with sanitized data
            const [result] = await connection.query(
                `INSERT INTO approval_requests (title, description, created_by, deadline, status) 
                 VALUES (?, ?, ?, ?, 'active')`,
                [title.trim(), description ? description.trim() : null, userId, deadline || null]
            );

            const approvalRequestId = result.insertId;

            // Add recipients
            for (const recipientId of finalRecipientIds) {
                await connection.query(
                    `INSERT INTO approval_recipients (approval_request_id, user_id, status) 
                     VALUES (?, ?, 'pending')`,
                    [approvalRequestId, recipientId]
                );
            }

            // Log action in history
            await connection.query(
                `INSERT INTO approval_history (approval_request_id, action_type, performed_by, notes) 
                 VALUES (?, 'created', ?, ?)`,
                [approvalRequestId, userId, `Approval request created with ${finalRecipientIds.length} recipient(s)`]
            );

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Approval request created successfully',
                data: { id: approvalRequestId }
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creating approval request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating approval request', 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== GET ALL APPROVAL REQUESTS ====================
exports.getAllApprovalRequests = async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'active', filterType = 'all' } = req.query;
        const userId = req.user?.userId;

        const safeLimit = Math.min(parseInt(limit) || 10, 50);
        const offset = (parseInt(page) - 1) * safeLimit;

        let whereClause = 'WHERE 1=1';
        let params = [];

        // Filter by status
        if (status && status !== 'all') {
            whereClause += ' AND ar.status = ?';
            params.push(status);
        }

        // Filter by type (created by user, for user, or all)
        if (filterType === 'created') {
            whereClause += ' AND ar.created_by = ?';
            params.push(userId);
        } else if (filterType === 'recipient') {
            whereClause += ` AND ar.id IN (
                SELECT approval_request_id FROM approval_recipients WHERE user_id = ?
            )`;
            params.push(userId);
        } else if (filterType === 'all') {
            // When filterType is 'all', show approvals where user is creator OR recipient
            whereClause += ` AND (ar.created_by = ? OR ar.id IN (
                SELECT approval_request_id FROM approval_recipients WHERE user_id = ?
            ))`;
            params.push(userId, userId);
        }

        const [rows] = await db.query(
            `SELECT ar.id, ar.title, ar.description, ar.status, ar.deadline, ar.created_at, ar.updated_at, ar.completed_at,
                    u.id as creator_id, u.name as creator_name, u.username as creator_username
             FROM approval_requests ar
             JOIN users u ON ar.created_by = u.id
             ${whereClause}
             ORDER BY ar.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, safeLimit, offset]
        );

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM approval_requests ar JOIN users u ON ar.created_by = u.id ${whereClause}`,
            params
        );

        // Enrich with recipient counts
        const enrichedRows = await Promise.all(
            rows.map(async (row) => {
                const [stats] = await db.query(
                    `SELECT 
                        COUNT(*) as total_recipients,
                        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
                     FROM approval_recipients WHERE approval_request_id = ?`,
                    [row.id]
                );

                return {
                    ...row,
                    recipients: {
                        total: stats[0]?.total_recipients || 0,
                        approved: stats[0]?.approved_count || 0,
                        rejected: stats[0]?.rejected_count || 0,
                        pending: stats[0]?.pending_count || 0
                    }
                };
            })
        );

        res.json({
            success: true,
            data: enrichedRows,
            pagination: {
                page: parseInt(page),
                limit: safeLimit,
                total: countResult[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Error fetching approval requests:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching approval requests', 
            error: error.message 
        });
    }
};

// ==================== GET APPROVAL REQUEST BY ID ====================
exports.getApprovalRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT ar.id, ar.title, ar.description, ar.status, ar.deadline, ar.created_at, ar.updated_at, ar.completed_at,
                    u.id as creator_id, u.name as creator_name, u.username as creator_username
             FROM approval_requests ar
             JOIN users u ON ar.created_by = u.id
             WHERE ar.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Approval request not found' });
        }

        const request = rows[0];

        // Get recipients with their status
        const [recipients] = await db.query(
            `SELECT ar.id, ar.user_id, ar.status, ar.response_at, ar.response_notes,
                    u.id as user_id, u.name, u.username, u.email
             FROM approval_recipients ar
             JOIN users u ON ar.user_id = u.id
             WHERE ar.approval_request_id = ?
             ORDER BY ar.status ASC, ar.response_at DESC`,
            [id]
        );

        // Get stats
        const [stats] = await db.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
             FROM approval_recipients WHERE approval_request_id = ?`,
            [id]
        );

        // Get history
        const [history] = await db.query(
            `SELECT ah.id, ah.approval_request_id, ah.recipient_user_id, ah.action_type, ah.created_at,
                    u.id as performed_by_id, u.name as performed_by_name, ah.notes
             FROM approval_history ah
             JOIN users u ON ah.performed_by = u.id
             WHERE ah.approval_request_id = ?
             ORDER BY ah.created_at DESC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                ...request,
                recipients: recipients.map(r => ({
                    id: r.id,
                    user_id: r.user_id,
                    name: r.name,
                    username: r.username,
                    email: r.email,
                    status: r.status,
                    response_at: r.response_at,
                    response_notes: r.response_notes
                })),
                stats: {
                    total: stats[0]?.total || 0,
                    approved: stats[0]?.approved || 0,
                    rejected: stats[0]?.rejected || 0,
                    pending: stats[0]?.pending || 0
                },
                history
            }
        });
    } catch (error) {
        console.error('Error fetching approval request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching approval request', 
            error: error.message 
        });
    }
};

// ==================== UPDATE APPROVAL REQUEST ====================
exports.updateApprovalRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, deadline, recipientIds } = req.body;
        const userId = req.user?.userId;

        // Verify ownership
        const [requests] = await db.query(
            'SELECT created_by FROM approval_requests WHERE id = ?',
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({ success: false, message: 'Approval request not found' });
        }

        if (requests[0].created_by !== userId) {
            return res.status(403).json({ success: false, message: 'Only creator can edit this request' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Update approval request
            await connection.query(
                `UPDATE approval_requests 
                 SET title = ?, description = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [title || requests[0].title, description, deadline || null, id]
            );

            // Update recipients if provided
            if (recipientIds && Array.isArray(recipientIds)) {
                // Delete old recipients
                await connection.query(
                    'DELETE FROM approval_recipients WHERE approval_request_id = ?',
                    [id]
                );

                // Add new recipients
                for (const recipientId of recipientIds) {
                    await connection.query(
                        `INSERT INTO approval_recipients (approval_request_id, user_id, status) 
                         VALUES (?, ?, 'pending')`,
                        [id, recipientId]
                    );
                }
            }

            // Log action
            await connection.query(
                `INSERT INTO approval_history (approval_request_id, action_type, performed_by, notes) 
                 VALUES (?, 'updated', ?, ?)`,
                [id, userId, `Request updated with title and details`]
            );

            await connection.commit();

            res.json({
                success: true,
                message: 'Approval request updated successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating approval request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating approval request', 
            error: error.message 
        });
    }
};

// ==================== DELETE APPROVAL REQUEST ====================
exports.deleteApprovalRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        // Verify ownership
        const [requests] = await db.query(
            'SELECT created_by FROM approval_requests WHERE id = ?',
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({ success: false, message: 'Approval request not found' });
        }

        if (requests[0].created_by !== userId) {
            return res.status(403).json({ success: false, message: 'Only creator can delete this request' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Delete related records
            await connection.query('DELETE FROM approval_history WHERE approval_request_id = ?', [id]);
            await connection.query('DELETE FROM approval_recipients WHERE approval_request_id = ?', [id]);
            
            // Delete approval request
            await connection.query('DELETE FROM approval_requests WHERE id = ?', [id]);

            await connection.commit();

            res.json({
                success: true,
                message: 'Approval request deleted successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting approval request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting approval request', 
            error: error.message 
        });
    }
};

// ==================== SUBMIT APPROVAL RESPONSE ====================
exports.submitApprovalResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const { approvalStatus, notes } = req.body;
        const userId = req.user?.userId;

        // Enhanced validation
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        if (!approvalStatus || !['approved', 'rejected'].includes(approvalStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid approval status' });
        }

        // Validate notes length if provided
        if (notes && notes.length > 500) {
            return res.status(400).json({ success: false, message: 'Notes must be less than 500 characters' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if approval request exists and is active
            const [approvalRequests] = await connection.query(
                `SELECT status FROM approval_requests WHERE id = ?`,
                [id]
            );

            if (approvalRequests.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ 
                    success: false, 
                    message: 'Approval request not found' 
                });
            }

            if (approvalRequests[0].status !== 'active') {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    message: 'This approval request is no longer active' 
                });
            }

            // Check if user is a recipient
            const [recipient] = await connection.query(
                `SELECT id, status FROM approval_recipients 
                 WHERE approval_request_id = ? AND user_id = ?`,
                [id, userId]
            );

            if (recipient.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(403).json({ 
                    success: false, 
                    message: 'You are not a recipient of this approval request' 
                });
            }

            // Check if already responded
            if (recipient[0].status !== 'pending') {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    message: 'You have already responded to this approval request' 
                });
            }

            // Update recipient status
            await connection.query(
                `UPDATE approval_recipients 
                 SET status = ?, response_at = CURRENT_TIMESTAMP, response_notes = ?
                 WHERE approval_request_id = ? AND user_id = ?`,
                [approvalStatus, notes ? notes.trim() : null, id, userId]
            );

            // Log action
            await connection.query(
                `INSERT INTO approval_history (approval_request_id, recipient_user_id, action_type, performed_by, notes) 
                 VALUES (?, ?, ?, ?, ?)`,
                [id, userId, approvalStatus, userId, notes ? notes.trim() : `Responded: ${approvalStatus}`]
            );

            await connection.commit();

            res.json({
                success: true,
                message: `Request ${approvalStatus} successfully`
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error submitting approval response:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error submitting approval response', 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== COMPLETE APPROVAL REQUEST ====================
exports.completeApprovalRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        // Verify ownership
        const [requests] = await db.query(
            'SELECT created_by FROM approval_requests WHERE id = ?',
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({ success: false, message: 'Approval request not found' });
        }

        if (requests[0].created_by !== userId) {
            return res.status(403).json({ success: false, message: 'Only creator can complete this request' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Update status
            await connection.query(
                `UPDATE approval_requests 
                 SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [id]
            );

            // Log action
            await connection.query(
                `INSERT INTO approval_history (approval_request_id, action_type, performed_by, notes) 
                 VALUES (?, 'completed', ?, 'Approval process completed')`,
                [id, userId]
            );

            await connection.commit();

            res.json({
                success: true,
                message: 'Approval request completed successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error completing approval request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error completing approval request', 
            error: error.message 
        });
    }
};

// ==================== CANCEL APPROVAL REQUEST ====================
exports.cancelApprovalRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        // Verify ownership
        const [requests] = await db.query(
            'SELECT created_by FROM approval_requests WHERE id = ?',
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({ success: false, message: 'Approval request not found' });
        }

        if (requests[0].created_by !== userId) {
            return res.status(403).json({ success: false, message: 'Only creator can cancel this request' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Update status
            await connection.query(
                `UPDATE approval_requests 
                 SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [id]
            );

            // Log action
            await connection.query(
                `INSERT INTO approval_history (approval_request_id, action_type, performed_by, notes) 
                 VALUES (?, 'cancelled', ?, 'Approval request cancelled')`,
                [id, userId]
            );

            await connection.commit();

            res.json({
                success: true,
                message: 'Approval request cancelled successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error cancelling approval request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error cancelling approval request', 
            error: error.message 
        });
    }
};

// ==================== GET USER'S PENDING APPROVALS ====================
exports.getPendingApprovalsForUser = async (req, res) => {
    try {
        const userId = req.user?.userId;

        const [rows] = await db.query(
            `SELECT ar.id, ar.title, ar.description, ar.deadline, ar.created_at,
                    u.id as creator_id, u.name as creator_name, u.username as creator_username
             FROM approval_requests ar
             JOIN users u ON ar.created_by = u.id
             JOIN approval_recipients ap ON ar.id = ap.approval_request_id
             WHERE ap.user_id = ? AND ap.status = 'pending' AND ar.status = 'active'
             ORDER BY ar.deadline ASC, ar.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching pending approvals', 
            error: error.message 
        });
    }
};
