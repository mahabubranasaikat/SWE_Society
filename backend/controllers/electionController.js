const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Cache for schema checks to avoid repeated metadata queries
let hasElectionSymbolColumn = null;
let hasQuoteColumn = null;

// Check once whether candidates table has election_symbol column
const ensureElectionSymbolColumn = async () => {
    if (hasElectionSymbolColumn !== null) return hasElectionSymbolColumn;
    try {
        const [cols] = await db.query("SHOW COLUMNS FROM candidates LIKE 'election_symbol'");
        hasElectionSymbolColumn = cols.length > 0;
    } catch (err) {
        console.warn('Could not inspect candidates columns:', err.message);
        hasElectionSymbolColumn = false;
    }
    return hasElectionSymbolColumn;
};

// Check once whether candidates table has quote column
const ensureQuoteColumn = async () => {
    if (hasQuoteColumn !== null) return hasQuoteColumn;
    try {
        const [cols] = await db.query("SHOW COLUMNS FROM candidates LIKE 'quote'");
        hasQuoteColumn = cols.length > 0;
    } catch (err) {
        console.warn('Could not inspect candidates columns:', err.message);
        hasQuoteColumn = false;
    }
    return hasQuoteColumn;
};

// ==================== HELPER FUNCTIONS ====================

// Get user roles from JWT token
const getUserRoles = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        return decoded.roles || [];
    } catch {
        return [];
    }
};

// Check if user is panel member
const isPanelMember = (roles) => {
    return roles && roles.some(role => 
        role.toLowerCase().includes('panel') || 
        role.toLowerCase().includes('president') ||
        role.toLowerCase().includes('vice president') ||
        role.toLowerCase().includes('general secretary') ||
        role.toLowerCase().includes('secretary')
    );
};

// Check if user is candidate
const isCandidate = (roles) => {
    return roles && roles.some(role => role.toLowerCase() === 'candidate');
};

// Check if user has candidate label in profile
const checkCandidateLabel = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        
        db.query('SELECT labels FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (results.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            
            const labels = results[0].labels ? results[0].labels.split(',').map(l => l.trim().toLowerCase()) : [];
            if (!labels.includes('candidate')) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'You must have "candidate" label to register for elections' 
                });
            }
            
            req.userId = userId;
            next();
        });
    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// ==================== ELECTIONS ====================

// Get all elections with filters
exports.getElections = async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = 'SELECT e.*, u.name as created_by_name, COUNT(DISTINCT ep.id) as post_count, COUNT(DISTINCT c.id) as candidate_count FROM elections e LEFT JOIN users u ON e.created_by = u.id LEFT JOIN election_posts ep ON e.id = ep.election_id LEFT JOIN candidates c ON e.id = c.election_id';
        let queryParams = [];
        
        if (status) {
            query += ' WHERE e.status = ?';
            queryParams.push(status);
        }
        
        query += ' GROUP BY e.id ORDER BY e.created_at DESC';
        
        const [results] = await db.query(query, queryParams);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Error fetching elections:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get election by ID with all details
exports.getElectionById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [results] = await db.query(`
            SELECT e.*, u.name as created_by_name, 
                   COUNT(DISTINCT ep.id) as post_count,
                   COUNT(DISTINCT c.id) as candidate_count
            FROM elections e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN election_posts ep ON e.id = ep.election_id
            LEFT JOIN candidates c ON e.id = c.election_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [id]);
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Election not found' });
        }
        
        const election = results[0];
        
        // Get posts for this election
        const [posts] = await db.query(`
            SELECT ep.*, COUNT(DISTINCT c.id) as candidate_count
            FROM election_posts ep
            LEFT JOIN candidates c ON ep.id = c.post_id AND c.status = 'approved'
            WHERE ep.election_id = ?
            GROUP BY ep.id
            ORDER BY ep.display_order
        `, [id]);
        
        election.posts = posts;
        res.json({ success: true, data: election });
    } catch (err) {
        console.error('Error fetching election:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Create election (Only Election Panel Member role)
exports.createElection = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        
        // Get fresh roles from database instead of trusting JWT
        const [users] = await db.query(
            'SELECT labels FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const userLabels = users[0].labels || '';
        const roles = userLabels ? userLabels.split(',').map(l => l.trim()) : [];
        
        // Check if user has 'Election Panel Member' role (only this role allows election creation)
        const hasElectionPanelRole = Array.isArray(roles) && roles.length > 0 && 
            roles.some(role => role === 'Election Panel Member');
        
        if (!hasElectionPanelRole) {
            return res.status(403).json({ 
                success: false, 
                message: 'Only Election Panel Members can create elections' 
            });
        }
        
        const { 
            title, 
            description, 
            // Accept both _date and _time field names for compatibility
            registration_start_date, 
            registration_end_date,
            voting_start_date,
            voting_end_date,
            registration_start_time,
            registration_end_time,
            voting_start_time,
            voting_end_time,
            posts
        } = req.body;
        
        // Use whichever field name was provided (_date or _time)
        const regStart = registration_start_time || registration_start_date;
        const regEnd = registration_end_time || registration_end_date;
        const voteStart = voting_start_time || voting_start_date;
        const voteEnd = voting_end_time || voting_end_date;
        
        // Validate inputs
        if (!title || !regStart || !regEnd || !voteStart || !voteEnd) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        if (!posts || posts.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one post must be selected' 
            });
        }
        
        // Convert ISO datetime strings to MySQL DATETIME format
        const formatDateTime = (isoDate) => {
            if (!isoDate) return null;
            const date = new Date(isoDate);
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };
        
        const [result] = await db.query(
            'INSERT INTO elections (title, description, status, registration_start_date, registration_end_date, voting_start_date, voting_end_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                title,
                description || '',
                'registration_open',
                formatDateTime(regStart),
                formatDateTime(regEnd),
                formatDateTime(voteStart),
                formatDateTime(voteEnd),
                userId
            ]
        );
        
        const electionId = result.insertId;
        
        // Insert posts
        for (let index = 0; index < posts.length; index++) {
            const post = posts[index];
            await db.query(
                'INSERT INTO election_posts (election_id, post_name, post_description, number_of_positions, display_order) VALUES (?, ?, ?, ?, ?)',
                [
                    electionId,
                    post.name || post.post_name,
                    post.description || '',
                    post.number_of_positions || post.positions_count || 1,
                    index
                ]
            );
        }
        
        // Log audit
        await db.query(
            'INSERT INTO election_audit_log (election_id, action, action_type, performed_by, details) VALUES (?, ?, ?, ?, ?)',
            [electionId, 'Election created', 'election_created', userId, JSON.stringify({ posts_count: posts.length })]
        );
        
        res.status(201).json({ 
            success: true, 
            message: 'Election created successfully',
            data: { id: electionId, title, status: 'draft' }
        });
    } catch (err) {
        console.error('Error creating election:', err);
        
        // Handle JWT errors
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
        }
        
        // Return actual error for debugging
        res.status(500).json({ 
            success: false, 
            message: err.message || 'Failed to create election',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Update election status
exports.updateElectionStatus = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['draft', 'registration_open', 'registration_closed', 'voting_open', 'voting_closed', 'completed', 'results_published'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }
        
        const [result] = await db.query(
            'UPDATE elections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by = ?',
            [status, id, userId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Election not found or unauthorized' 
            });
        }
        
        res.json({ success: true, message: 'Election status updated' });
    } catch (err) {
        console.error('Error updating election status:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Update election details (only by creator)
exports.updateElection = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { id } = req.params;
        const { 
            title, 
            description, 
            registration_start_time,
            registration_end_time,
            voting_start_time,
            voting_end_time,
            posts
        } = req.body;
        
        // Validate required fields
        if (!title || !registration_start_time || !registration_end_time || !voting_start_time || !voting_end_time) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        // Verify election exists and user is the creator
        const [election] = await db.query(
            'SELECT id, created_by FROM elections WHERE id = ?',
            [id]
        );
        
        if (election.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Election not found' 
            });
        }
        
        if (election[0].created_by !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Only the election creator can edit election details' 
            });
        }
        
        // Convert ISO datetime strings to MySQL DATETIME format
        const formatDateTime = (isoDate) => {
            if (!isoDate) return null;
            const date = new Date(isoDate);
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };
        
        // Update election basic info
        await db.query(
            `UPDATE elections
            SET title = ?, description = ?,
                registration_start_date = ?, registration_end_date = ?,
                voting_start_date = ?, voting_end_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
                title,
                description || '',
                formatDateTime(registration_start_time),
                formatDateTime(registration_end_time),
                formatDateTime(voting_start_time),
                formatDateTime(voting_end_time),
                id
            ]
        );
        
        // Update posts if provided
        if (posts && Array.isArray(posts) && posts.length > 0) {
            // Delete existing posts
            await db.query('DELETE FROM election_posts WHERE election_id = ?', [id]);
            
            // Insert new posts
            for (let index = 0; index < posts.length; index++) {
                const post = posts[index];
                const postName = typeof post === 'string' ? post : (post.post_name || post.name);
                const postDescription = typeof post === 'string' ? '' : (post.description || '');
                const positionsCount = typeof post === 'string' ? 1 : (post.number_of_positions || post.positions_count || 1);
                
                await db.query(
                    'INSERT INTO election_posts (election_id, post_name, post_description, number_of_positions, display_order) VALUES (?, ?, ?, ?, ?)',
                    [id, postName, postDescription, positionsCount, index]
                );
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Election updated successfully',
            data: { electionId: id }
        });
    } catch (err) {
        console.error('Error updating election:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message || 'Failed to update election' 
        });
    }
};

// Delete election (Panel only)
exports.deleteElection = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const userRoles = decoded.roles || [];
        const { id } = req.params;
        
        // Check if user is creator or panel member
        const isCreator = await db.query(
            'SELECT created_by FROM elections WHERE id = ?',
            [id]
        );
        
        if (isCreator[0].length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Election not found' 
            });
        }
        
        const canDelete = isCreator[0][0].created_by === userId || isPanelMember(userRoles);
        
        if (!canDelete) {
            return res.status(403).json({ 
                success: false, 
                message: 'You are not authorized to delete this election' 
            });
        }
        
        const [result] = await db.query(
            'DELETE FROM elections WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Election not found' 
            });
        }
        
        res.json({ success: true, message: 'Election deleted successfully' });
    } catch (err) {
        console.error('Error deleting election:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// ==================== DEFAULT POSTS ====================

// Get all default posts
exports.getDefaultPosts = async (req, res) => {
    try {
        const [results] = await db.query(
            'SELECT * FROM election_default_posts WHERE is_active = TRUE ORDER BY display_order'
        );
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Error fetching default posts:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ==================== CANDIDATES ====================

// Register as candidate
exports.registerCandidate = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const electionId = req.body.election_id || req.params.electionId;
        const { post_id, election_symbol, quote, biography, tagline } = req.body;
        
        if (!electionId || !post_id) {
            return res.status(400).json({ success: false, message: 'Election and post are required' });
        }
        
        // Check if user has candidate label OR "Election Candidate" role
        const [users] = await db.query('SELECT labels FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const userLabelsRaw = users[0].labels || '';
        console.log('User ID:', userId, 'Labels from DB:', userLabelsRaw);
        
        // Split labels and normalize to lowercase for comparison
        const labels = userLabelsRaw.split(',').map(l => l.trim().toLowerCase()).filter(l => l.length > 0);
        console.log('Processed labels (lowercase):', labels);
        
        // Check for either "candidate" or "election candidate" role label
        const hasCandidateAuth = labels.includes('candidate') || 
                                  labels.includes('election candidate');
        
        console.log('Has candidate authorization:', hasCandidateAuth);
        console.log('Available labels:', labels);
        
        if (!hasCandidateAuth) {
            console.log('Candidate authorization check failed for user:', userId);
            return res.status(403).json({ 
                success: false, 
                message: 'You must have "candidate" label or "Election Candidate" role to register for elections. If you recently added this, please log out and log back in to refresh your session, then try again.' 
            });
        }
        
        console.log('Candidate label check passed for user:', userId);
        
        // Verify election exists
        const [elections] = await db.query(
            'SELECT * FROM elections WHERE id = ?',
            [electionId]
        );
        
        if (elections.length === 0) {
            return res.status(404).json({ success: false, message: 'Election not found' });
        }
        
        const election = elections[0];
        
        // Check if voting has started - candidate registration closes when voting opens
        if (election.status === 'voting_open' || election.status === 'voting_closed' || election.status === 'completed') {
            return res.status(400).json({ 
                success: false, 
                message: 'Candidate registration is closed. Election has moved to voting or completed stage.' 
            });
        }
        
        console.log('✅ Registration allowed for election:', {
            electionId: election.id,
            title: election.title,
            status: election.status
        });
        
        // Insert candidate using correct database column names
        try {
            const [result] = await db.query(
                `INSERT INTO candidates 
                 (election_id, post_id, user_id, election_symbol, biography, quote, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    electionId,
                    post_id,
                    userId,
                    election_symbol || null,
                    biography || null,
                    quote || null,
                    'pending_approval'
                ]
            );
            
            res.status(201).json({ 
                success: true, 
                message: 'Candidate registration submitted for approval',
                data: { id: result.insertId }
            });
        } catch (dbErr) {
            if (dbErr.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Already registered for this post' 
                });
            }
            throw dbErr;
        }
    } catch (err) {
        console.error('Error registering candidate:', err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        res.status(500).json({ success: false, message: err.message || 'Failed to register candidate' });
    }
};

// Get candidates for a post
exports.getCandidatesByPost = async (req, res) => {
    try {
        const { electionId, postId } = req.params;
        
        const [results] = await db.query(`
            SELECT c.*, u.name, u.username
            FROM candidates c
            JOIN users u ON c.user_id = u.id
            WHERE c.election_id = ? AND c.post_id = ? AND c.status = 'approved'
        `, [electionId, postId]);
        
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Error fetching candidates:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Check candidate status for current user in an election
exports.checkCandidateStatus = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized', data: null });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { electionId } = req.params;
        
        const [results] = await db.query(`
            SELECT status FROM candidates
            WHERE election_id = ? AND user_id = ?
            LIMIT 1
        `, [electionId, userId]);
        
        if (results.length === 0) {
            return res.json({ success: true, data: null });
        }
        
        res.json({ success: true, data: results[0] });
    } catch (err) {
        console.error('Error checking candidate status:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get all candidates for an election (Panel only)
exports.getElectionCandidates = async (req, res) => {
    try {
        const { electionId } = req.params;
        
        const [results] = await db.query(`
            SELECT 
                c.id,
                c.election_id,
                c.post_id,
                c.user_id,
                c.election_symbol,
                c.quote,
                c.biography as bio,
                c.status,
                c.approved_by,
                c.approved_at,
                c.created_at as registration_timestamp,
                u.name,
                u.username,
                u.email,
                ep.post_name,
                ep.number_of_positions as positions_count
            FROM candidates c
            JOIN users u ON c.user_id = u.id
            JOIN election_posts ep ON c.post_id = ep.id
            WHERE c.election_id = ?
            ORDER BY ep.display_order, c.status, c.created_at DESC
        `, [electionId]);
        
        // Group by status for admin panel
        const grouped = {
            pending_approval: [],
            approved: [],
            rejected: []
        };
        
        results.forEach(candidate => {
            let status = candidate.status || 'pending_approval';
            // Treat 'registered' status as 'pending_approval' for display
            if (status === 'registered') {
                status = 'pending_approval';
            }
            if (grouped[status]) {
                grouped[status].push(candidate);
            }
        });
        
        res.json({ success: true, data: grouped });
    } catch (err) {
        console.error('Error fetching election candidates:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Approve candidate (Panel only)
exports.approveCandidate = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { candidateId } = req.params;
        
        const [result] = await db.query(
            'UPDATE candidates SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['approved', userId, candidateId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }
        
        res.json({ success: true, message: 'Candidate approved' });
    } catch (err) {
        console.error('Error approving candidate:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Reject candidate
exports.rejectCandidate = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { candidateId } = req.params;
        const { reason } = req.body;
        
        const [result] = await db.query(
            'UPDATE candidates SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['rejected', userId, candidateId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }
        
        res.json({ success: true, message: 'Candidate rejected' });
    } catch (err) {
        console.error('Error rejecting candidate:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Delete candidate
exports.deleteCandidate = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const { candidateId } = req.params;
        
        const [result] = await db.query('DELETE FROM candidates WHERE id = ?', [candidateId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }
        
        res.json({ success: true, message: 'Candidate deleted' });
    } catch (err) {
        console.error('Error deleting candidate:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// ==================== VOTING ====================

// Request voting permission
exports.requestVote = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        // Accept election_id from body or electionId from params
        const election_id = req.body.election_id || req.params.electionId;
        
        if (!election_id) {
            return res.status(400).json({ success: false, message: 'Election ID is required' });
        }
        
        console.log('📝 Vote request for election:', election_id, 'from user:', userId);
        
        // Check if election exists 
        const [elections] = await db.query(
            'SELECT id, status, title FROM elections WHERE id = ?',
            [election_id]
        );
        
        if (elections.length === 0) {
            console.log('❌ Election not found:', election_id);
            return res.status(404).json({ success: false, message: 'Election not found' });
        }
        
        const election = elections[0];
        console.log('📋 Election:', election.title, 'Status:', election.status);
        
        // Vote approval requests are allowed during voting period (status must be voting_open)
        // Allow registration_closed too as prep for voting
        const allowed = ['voting_open', 'registration_closed'];
        if (!allowed.includes(election.status)) {
            console.log('❌ Voting not available. Election status:', election.status);
            console.log('⚠️  Allowed statuses: ', allowed.join(', '));
            return res.status(400).json({ 
                success: false, 
                message: `Voting is not available yet (Election status: ${election.status}). Voting requests can only be made when the voting period is open.` 
            });
        }
        
        try {
            console.log('🔄 Inserting vote request for user', userId, 'in election', election_id);
            const [result] = await db.query(
                'INSERT INTO vote_requests (election_id, user_id, status) VALUES (?, ?, ?)',
                [election_id, userId, 'pending']
            );
            
            console.log('✅ Vote request created with ID:', result.insertId);
            res.status(201).json({ 
                success: true, 
                message: 'Vote request submitted. You will be able to vote once approved by the panel.',
                data: { id: result.insertId }
            });
        } catch (dbErr) {
            console.error('💥 Database error:', dbErr.code, dbErr.message);
            if (dbErr.code === 'ER_DUP_ENTRY') {
                console.log('⚠️  Duplicate vote request detected');
                return res.status(400).json({ 
                    success: false, 
                    message: 'You have already submitted a voting request for this election' 
                });
            }
            throw dbErr;
        }
    } catch (err) {
        console.error('❌ Error requesting vote:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Error requesting vote' });
    }
};

// Get vote requests for an election (Panel only)
exports.getVoteRequests = async (req, res) => {
    try {
        const { electionId } = req.params;
        
        const [results] = await db.query(`
            SELECT 
                vr.id,
                vr.election_id,
                vr.user_id,
                vr.user_id as voter_id,
                vr.status,
                vr.requested_at,
                vr.approved_by,
                vr.approved_at,
                vr.rejection_reason,
                u.name,
                u.username,
                u.email
            FROM vote_requests vr
            LEFT JOIN users u ON u.id = vr.user_id
            WHERE vr.election_id = ?
            ORDER BY vr.status, vr.requested_at DESC
        `, [electionId]);
        
        // Group by status for admin panel
        const grouped = {
            pending: [],
            approved: [],
            rejected: []
        };
        
        results.forEach(request => {
            const status = request.status || 'pending';
            if (grouped[status]) {
                grouped[status].push(request);
            }
        });
        
        // Return both grouped data and flat list for different use cases
        res.json({ success: true, data: results, grouped });
    } catch (err) {
        console.error('Error fetching vote requests:', err);
        res.status(500).json({ success: false, message: err.message });        res.status(500).json({ success: false, message: err.message });
    }
};

// Approve vote request (Panel only)
exports.approveVoteRequest = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { requestId } = req.params;
        
        const [result] = await db.query(
            'UPDATE vote_requests SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['approved', userId, requestId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Vote request not found' });
        }
        
        res.json({ success: true, message: 'Vote request approved' });
    } catch (err) {
        console.error('Error approving vote request:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Reject vote request (Panel only)
exports.rejectVoteRequest = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { requestId } = req.params;
        const { reason } = req.body;
        
        const [result] = await db.query(
            'UPDATE vote_requests SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ?',
            ['rejected', userId, reason, requestId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Vote request not found' });
        }
        
        res.json({ success: true, message: 'Vote request rejected' });
    } catch (err) {
        console.error('Error rejecting vote request:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Delete vote request (Panel only)
exports.deleteVoteRequest = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const { requestId } = req.params;
        
        const [result] = await db.query('DELETE FROM vote_requests WHERE id = ?', [requestId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Vote request not found' });
        }
        
        res.json({ success: true, message: 'Vote request deleted' });
    } catch (err) {
        console.error('Error deleting vote request:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Check if user has already voted
exports.checkUserVoted = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { electionId } = req.params;
        
        const [votes] = await db.query(
            'SELECT COUNT(*) as vote_count FROM votes WHERE election_id = ? AND voter_id = ?',
            [electionId, userId]
        );
        
        res.json({ 
            success: true, 
            hasVoted: votes[0].vote_count > 0,
            voteCount: votes[0].vote_count
        });
    } catch (err) {
        console.error('Error checking user votes:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Cast vote
exports.castVote = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
        const userId = decoded.userId;
        const { election_id, post_id, candidate_id } = req.body;
        
        // Check if election exists and is in voting period
        const [elections] = await db.query(
            'SELECT status, voting_start_date, voting_end_date FROM elections WHERE id = ?',
            [election_id]
        );
        
        if (elections.length === 0) {
            return res.status(404).json({ success: false, message: 'Election not found' });
        }
        
        const election = elections[0];
        
        // Check if voting is open
        if (election.status !== 'voting_open') {
            return res.status(400).json({
                success: false,
                message: 'Voting is not open at this time.'
            });
        }
        
        // Check vote approval - user must be approved to vote
        const [requests] = await db.query(
            'SELECT * FROM vote_requests WHERE election_id = ? AND user_id = ? AND status = ?',
            [election_id, userId, 'approved']
        );

        if (requests.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not approved to vote in this election. Please request voting approval first.'
            });
        }
        
        // Check if user has already voted in this election
        const [existingVotes] = await db.query(
            'SELECT COUNT(*) as vote_count FROM votes WHERE election_id = ? AND voter_id = ?',
            [election_id, userId]
        );
        
        if (existingVotes[0].vote_count > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already cast your vote in this election. Multiple voting is not allowed.'
            });
        }
        
        // Cast vote
        try {
            const [result] = await db.query(
                'INSERT INTO votes (election_id, post_id, candidate_id, voter_id) VALUES (?, ?, ?, ?)',
                [election_id, post_id, candidate_id, userId]
            );
            
            res.status(201).json({ 
                success: true, 
                message: 'Vote recorded successfully',
                data: { id: result.insertId }
            });
        } catch (dbErr) {
            if (dbErr.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Already voted for this post' 
                });
            }
            throw dbErr;
        }
    } catch (err) {
        console.error('Error casting vote:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// ==================== RESULTS ====================

// Get election results
exports.getElectionResults = async (req, res) => {
    try {
        const { electionId } = req.params;
        
        const hasSymbol = await ensureElectionSymbolColumn();
        const hasQuote = await ensureQuoteColumn();
        
        let query = `
            SELECT 
                ep.id as post_id,
                ep.post_name,
                ep.positions_count,
                c.id as candidate_id,
                u.name as candidate_name,
                u.username,
        `;
        
        if (hasSymbol) query += ' c.election_symbol, ';
        if (hasQuote) query += ' c.quote, ';
        
        query += `
                COUNT(v.id) as vote_count
            FROM election_posts ep
            LEFT JOIN candidates c ON ep.id = c.post_id AND c.status = 'approved'
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN votes v ON c.id = v.candidate_id
            WHERE ep.election_id = ?
            GROUP BY ep.id, ep.post_name, ep.positions_count, c.id, u.name, u.username` + 
            (hasSymbol ? ', c.election_symbol' : '') + 
            (hasQuote ? ', c.quote' : '') + `
            ORDER BY ep.display_order, vote_count DESC
        `;
        
        const [results] = await db.query(query, [electionId]);
        
        // Group by post and mark winners
        const resultsByPost = {};
        results.forEach(row => {
            if (!resultsByPost[row.post_id]) {
                resultsByPost[row.post_id] = {
                    post_id: row.post_id,
                    post_name: row.post_name,
                    positions_count: row.positions_count || 1,
                    candidates: []
                };
            }
            if (row.candidate_id) {
                const candidateRank = resultsByPost[row.post_id].candidates.length + 1;
                const isWinner = candidateRank <= (row.positions_count || 1);
                
                resultsByPost[row.post_id].candidates.push({
                    candidate_id: row.candidate_id,
                    name: row.candidate_name,
                    username: row.username,
                    symbol: row.election_symbol,
                    quote: row.quote,
                    votes: row.vote_count,
                    rank: candidateRank,
                    is_winner: isWinner
                });
            }
        });
        
        res.json({ success: true, data: Object.values(resultsByPost) });
    } catch (err) {
        console.error('Error fetching election results:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get election statistics
exports.getElectionStats = async (req, res) => {
    try {
        const { electionId } = req.params;
        
        const [results] = await db.query(`
            SELECT
                e.title,
                e.status,
                COUNT(DISTINCT c.id) as total_candidates,
                COUNT(DISTINCT v.id) as total_votes,
                COUNT(DISTINCT v.voter_id) as unique_voters,
                COUNT(DISTINCT vr.id) as total_voters_approved,
                SUM(CASE WHEN vr.status = 'approved' THEN 1 ELSE 0 END) as approved_voters
            FROM elections e
            LEFT JOIN candidates c ON e.id = c.election_id AND c.status = 'approved'
            LEFT JOIN votes v ON e.id = v.election_id
            LEFT JOIN vote_requests vr ON e.id = vr.election_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [electionId]);
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Election not found' });
        }
        
        res.json({ success: true, data: results[0] });
    } catch (err) {
        console.error('Error fetching election stats:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get audit log
exports.getAuditLog = async (req, res) => {
    try {
        const { electionId } = req.params;
        
        const [results] = await db.query(`
            SELECT eal.*, u.name as performed_by_name
            FROM election_audit_log eal
            LEFT JOIN users u ON eal.performed_by = u.id
            WHERE eal.election_id = ?
            ORDER BY eal.performed_at DESC
        `, [electionId]);
        
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Error fetching audit log:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get voter logs - detailed vote history
exports.getVoterLogs = async (req, res) => {
    try {
        const { electionId } = req.params;
        
        console.log('Fetching voter logs for election:', electionId);
        
        // First check if election exists
        const [election] = await db.query('SELECT id FROM elections WHERE id = ?', [electionId]);
        if (election.length === 0) {
            console.log('Election not found:', electionId);
            return res.status(404).json({ success: false, message: 'Election not found' });
        }
        
        // Get all votes with voter details, candidate details, and post information
        const [votes] = await db.query(`
            SELECT 
                v.id as vote_id,
                v.voted_at as voting_time,
                voter.name as voter_name,
                voter.username as voter_username,
                candidate_user.name as candidate_name,
                ep.post_name,
                ep.number_of_positions as positions_count
            FROM votes v
            INNER JOIN users voter ON v.voter_id = voter.id
            INNER JOIN candidates c ON v.candidate_id = c.id
            INNER JOIN users candidate_user ON c.user_id = candidate_user.id
            INNER JOIN election_posts ep ON v.post_id = ep.id
            WHERE v.election_id = ?
            ORDER BY v.voted_at ASC, voter.name ASC
        `, [electionId]);
        
        console.log(`Found ${votes.length} votes for election ${electionId}`);
        
        res.json({ success: true, data: votes });
    } catch (err) {
        console.error('Error fetching voter logs:', err);
        console.error('Error details:', err.message);
        console.error('Stack trace:', err.stack);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch voter logs' });
    }
};

