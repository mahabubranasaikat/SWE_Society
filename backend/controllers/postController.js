const db = require('../config/db');
const notificationController = require('./notificationController');

// Determine the correct foreign key column in post_likes (post_id vs post_id)
// This provides backwards compatibility during migration
let POST_LIKES_FK_COL = null;
async function getPostLikesFkCol() {
    if (POST_LIKES_FK_COL) return POST_LIKES_FK_COL;
    try {
        const [dbNameRows] = await db.query('SELECT DATABASE() as db');
        const dbName = dbNameRows[0]?.db;
        if (!dbName) throw new Error('Unable to determine database name');
        
        // Check for post_likes table first (new), then post_likes (old)
        let tableName = 'post_likes';
        const [tableCheck] = await db.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('post_likes', 'post_likes') LIMIT 1`,
            [dbName]
        );
        if (tableCheck.length > 0) {
            tableName = tableCheck[0].TABLE_NAME;
        }
        
        const [rows] = await db.query(
            `SELECT COLUMN_NAME as col
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME IN ('post_id','post_id')
             LIMIT 1`,
            [dbName, tableName]
        );
        POST_LIKES_FK_COL = { col: rows[0]?.col || 'post_id', table: tableName };
    } catch (e) {
        // Fallback to post_id if inspection fails
        POST_LIKES_FK_COL = { col: 'post_id', table: 'post_likes' };
    }
    return POST_LIKES_FK_COL;
}

// Helper function to get the correct table name (posts or posts)
async function getPostsTableName() {
    try {
        const [dbNameRows] = await db.query('SELECT DATABASE() as db');
        const dbName = dbNameRows[0]?.db;
        const [tableCheck] = await db.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('posts', 'posts') LIMIT 1`,
            [dbName]
        );
        return tableCheck[0]?.TABLE_NAME || 'posts';
    } catch (e) {
        return 'posts';
    }
}

// Helper function to get comments table column name (post_id or post_id)
async function getCommentsPostCol() {
    try {
        const [dbNameRows] = await db.query('SELECT DATABASE() as db');
        const dbName = dbNameRows[0]?.db;
        const [rows] = await db.query(
            `SELECT COLUMN_NAME as col
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'comments' AND COLUMN_NAME IN ('post_id','post_id')
             LIMIT 1`,
            [dbName]
        );
        return rows[0]?.col || 'post_id';
    } catch (e) {
        return 'post_id';
    }
}

// Helper function to get user's total posts column name
async function getUserTotalPostsCol() {
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

// Get all posts with privacy enforcement
exports.getAllPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10, privacy = 'all', tag, postType } = req.query;
        const offset = (page - 1) * limit;
        const viewerId = req.user?.userId || null;
        
        const likesInfo = await getPostLikesFkCol();
        const postsTable = await getPostsTableName();
        
        let query = `
            SELECT p.*, u.username, u.name as user_name,
                   ${viewerId ? `(SELECT COUNT(*) FROM ${likesInfo.table} pl WHERE pl.${likesInfo.col} = p.id AND pl.user_id = ?) as user_liked,` : ''}
                   p.comments_count as total_comments
            FROM ${postsTable} p 
            JOIN users u ON p.user_id = u.id 
            WHERE 1=1
        `;
        const params = viewerId ? [viewerId] : [];
        
        // Check if user has committee role for committee posts
        let userHasCommitteeRole = false;
        if (viewerId) {
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [viewerId]);
            userHasCommitteeRole = committeeCheck[0].count > 0;
        }
        
        // Privacy filter (strict and safe)
        if (privacy === 'public') {
            query += ' AND p.privacy = ?';
            params.push('public');
        } else if (privacy === 'committee') {
            // Only committee members can see committee posts
            if (userHasCommitteeRole) {
                query += ' AND p.privacy = ?';
                params.push('committee');
            } else {
                query += ' AND 1=0'; // No access
            }
        } else if (privacy === 'private') {
            // Only own private posts
            if (viewerId) {
                query += ' AND p.privacy = ? AND p.user_id = ?';
                params.push('private', viewerId);
            } else {
                query += ' AND 1=0';
            }
        } else {
            // 'all' or unspecified: public + committee (if member) + own private
            const privacyClauses = ['p.privacy = ?'];
            const privacyParams = ['public'];
            if (userHasCommitteeRole) {
                privacyClauses.push('p.privacy = ?');
                privacyParams.push('committee');
            }
            if (viewerId) {
                privacyClauses.push('(p.privacy = ? AND p.user_id = ?)');
                privacyParams.push('private', viewerId);
            }
            query += ` AND (${privacyClauses.join(' OR ')})`;
            params.push(...privacyParams);
        }
        
        // Post type filter
        if (postType && ['post', 'achievement', 'announcement', 'blog', 'issue', 'event'].includes(postType)) {
            query += ' AND p.post_type = ?';
            params.push(postType);
        }
        
        // Tag filter
        if (tag) {
            query += ' AND p.tags LIKE ?';
            params.push(`%${tag}%`);
        }
        
        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [posts] = await db.query(query, params);
        
        res.json({ 
            success: true, 
            data: posts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching posts',
            error: error.message 
        });
    }
};

// Search posts with fuzzy search and privacy enforcement
exports.searchPosts = async (req, res) => {
    try {
        const { q, page = 1, limit = 10, privacy = 'all', postType } = req.query;
        const viewerId = req.user?.userId || null;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }
        
        const offset = (page - 1) * limit;
        const searchTerm = `%${q.trim()}%`;
        
        // Check committee role
        let userHasCommitteeRole = false;
        if (viewerId) {
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [viewerId]);
            userHasCommitteeRole = committeeCheck[0].count > 0;
        }

        const likesInfo = await getPostLikesFkCol();
        const postsTable = await getPostsTableName();
        
        // Fuzzy search across name, tags, post_type, and description
        let query = `
            SELECT p.*, u.username, u.name as user_name,
                   ${viewerId ? `(SELECT COUNT(*) FROM ${likesInfo.table} pl WHERE pl.${likesInfo.col} = p.id AND pl.user_id = ?) as user_liked,` : ''}
                   p.comments_count as total_comments,
                   CASE 
                       WHEN p.name LIKE ? THEN 5
                       WHEN p.tags LIKE ? THEN 4
                       WHEN p.post_type LIKE ? THEN 3
                       WHEN p.description LIKE ? THEN 2
                       WHEN u.name LIKE ? THEN 1
                       ELSE 0
                   END as relevance_score
            FROM ${postsTable} p 
            JOIN users u ON p.user_id = u.id 
            WHERE 1=1
        `;

        const whereClauses = [];
        const params = [];
        if (viewerId) params.push(viewerId);
        // Params for CASE relevance scoring (5 LIKEs)
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

        // Privacy conditions
        if (privacy === 'public') {
            whereClauses.push('p.privacy = ?');
            params.push('public');
        } else if (privacy === 'committee') {
            if (userHasCommitteeRole) {
                whereClauses.push('p.privacy = ?');
                params.push('committee');
            } else {
                // Force no results
                whereClauses.push('1=0');
            }
        } else if (privacy === 'private') {
            if (viewerId) {
                whereClauses.push('p.privacy = ? AND p.user_id = ?');
                params.push('private', viewerId);
            } else {
                whereClauses.push('1=0');
            }
        } else {
            // all
            const privacyClauses = ['p.privacy = ?'];
            const privacyParams = ['public'];
            if (userHasCommitteeRole) {
                privacyClauses.push('p.privacy = ?');
                privacyParams.push('committee');
            }
            if (viewerId) {
                privacyClauses.push('(p.privacy = ? AND p.user_id = ?)');
                privacyParams.push('private', viewerId);
            }
            whereClauses.push(`(${privacyClauses.join(' OR ')})`);
            params.push(...privacyParams);
        }

        // Post type filter for search
        if (postType && ['post', 'achievement', 'announcement', 'blog', 'issue', 'event'].includes(postType)) {
            whereClauses.push('p.post_type = ?');
            params.push(postType);
        }

        // Search terms for WHERE filter (another 5 LIKEs)
        whereClauses.push(`(
                p.name LIKE ? OR 
                p.tags LIKE ? OR 
                p.post_type LIKE ? OR 
                p.description LIKE ? OR
                u.name LIKE ?
            )`);
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

        query += `
            AND ${whereClauses.join(' AND ')}
            ORDER BY relevance_score DESC, p.created_at DESC 
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), parseInt(offset));
        
        const [posts] = await db.query(query, params);
        
        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM ${postsTable} p 
            JOIN users u ON p.user_id = u.id 
            WHERE 1=1
        `;
        const countWhere = [];
        const countParams = [];
        // Same privacy constraints
        if (privacy === 'public') {
            countWhere.push('p.privacy = ?');
            countParams.push('public');
        } else if (privacy === 'committee') {
            if (userHasCommitteeRole) {
                countWhere.push('p.privacy = ?');
                countParams.push('committee');
            } else {
                countWhere.push('1=0');
            }
        } else if (privacy === 'private') {
            if (viewerId) {
                countWhere.push('p.privacy = ? AND p.user_id = ?');
                countParams.push('private', viewerId);
            } else {
                countWhere.push('1=0');
            }
        } else {
            const clauses = ['p.privacy = ?'];
            const vals = ['public'];
            if (userHasCommitteeRole) { clauses.push('p.privacy = ?'); vals.push('committee'); }
            if (viewerId) { clauses.push('(p.privacy = ? AND p.user_id = ?)'); vals.push('private', viewerId); }
            countWhere.push(`(${clauses.join(' OR ')})`);
            countParams.push(...vals);
        }
        if (postType && ['post', 'achievement', 'announcement', 'blog', 'issue', 'event'].includes(postType)) {
            countWhere.push('p.post_type = ?');
            countParams.push(postType);
        }
        countWhere.push(`(
            p.name LIKE ? OR 
            p.tags LIKE ? OR 
            p.post_type LIKE ? OR 
            p.description LIKE ? OR
            u.name LIKE ?
        )`);
        countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        countQuery += ` AND ${countWhere.join(' AND ')}`;
        
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({ 
            success: true, 
            data: posts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            },
            searchQuery: q.trim()
        });
    } catch (error) {
        console.error('Error searching posts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error searching posts',
            error: error.message 
        });
    }
};

// Get single post with privacy enforcement
exports.getPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const viewerId = req.user?.userId || null;
        
        const postsTable = await getPostsTableName();
        
        const [posts] = await db.query(
            `SELECT p.*, u.username, u.name as user_name, u.email as user_email 
             FROM ${postsTable} p 
             JOIN users u ON p.user_id = u.id 
             WHERE p.id = ?`,
            [postId]
        );
        
        if (posts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        const post = posts[0];

        // Enforce privacy
        if (post.privacy === 'private') {
            if (!viewerId || viewerId != post.user_id) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        } else if (post.privacy === 'committee') {
            if (!viewerId) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [viewerId]);
            const userHasCommitteeRole = committeeCheck[0].count > 0;
            if (!userHasCommitteeRole) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        }
        
        res.json({ 
            success: true, 
            data: post 
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching post',
            error: error.message 
        });
    }
};

// Get all posts by user
exports.getUserPosts = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const viewerId = req.user?.userId || null;
        
        const postsTable = await getPostsTableName();
        const likesInfo = await getPostLikesFkCol();
        
        // Build query with privacy filtering
        let query = `
            SELECT p.*, u.username, u.name as user_name,
                   (SELECT COUNT(*) FROM ${likesInfo.table} WHERE ${likesInfo.col} = p.id) as likes_count,
                   ${viewerId ? `(SELECT COUNT(*) FROM ${likesInfo.table} pl WHERE pl.${likesInfo.col} = p.id AND pl.user_id = ?) as user_liked,` : '0 as user_liked,'}
                   p.comments_count as total_comments
            FROM ${postsTable} p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.user_id = ?
        `;
        
        const params = viewerId ? [viewerId, userId] : [userId];
        
        // Privacy filter: if viewing someone else's profile, exclude private posts
        if (viewerId && parseInt(viewerId) !== parseInt(userId)) {
            // Check if viewer has committee role for committee posts
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [viewerId]);
            const userHasCommitteeRole = committeeCheck[0].count > 0;
            
            // Show only public posts, or public + committee posts if viewer is committee member
            if (userHasCommitteeRole) {
                query += ` AND (p.privacy = 'public' OR p.privacy = 'committee')`;
            } else {
                query += ` AND p.privacy = 'public'`;
            }
        }
        // If viewing own profile, show all posts
        
        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const [posts] = await db.query(query, params);
        
        res.json({ 
            success: true, 
            data: posts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching user posts',
            error: error.message 
        });
    }
};

// Create new post
exports.createPost = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            link,
            registration_link,
            event_end_time,
            tags, 
            privacy = 'public',
            post_type = 'post'
        } = req.body;
        
        // Get user ID from JWT token
        const user_id = req.user.userId;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title is required' 
            });
        }
        
        // Validate post_type
        if (!['post', 'achievement', 'announcement', 'blog', 'issue', 'event'].includes(post_type)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid post type' 
            });
        }
        
        // Validate privacy
        if (!['public', 'private', 'committee'].includes(privacy)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid privacy setting' 
            });
        }
        
        const postsTable = await getPostsTableName();
        const totalPostsCol = await getUserTotalPostsCol();
        
        // Insert new post
        const [result] = await db.query(
            `INSERT INTO ${postsTable} (name, description, post_type, link, registration_link, event_end_time, user_id, tags, privacy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description, post_type, link, registration_link, event_end_time, user_id, tags, privacy]
        );
        
        // Update user's total posts count
        await db.query(
            `UPDATE users SET ${totalPostsCol} = ${totalPostsCol} + 1 WHERE id = ?`,
            [user_id]
        );
        
        // Create notifications for committee members if privacy is 'committee'
        if (privacy === 'committee') {
            try {
                // Get all users with committee roles
                const [committeeMembers] = await db.query(`
                    SELECT DISTINCT u.id, u.name, u.email
                    FROM users u
                    JOIN user_roles ur ON u.id = ur.user_id
                    JOIN roles r ON ur.role_id = r.id
                    WHERE r.role_category = 'committee' 
                    AND ur.is_active = TRUE
                    AND u.id != ?
                `, [user_id]);
                
                // Get post creator info
                const [creator] = await db.query('SELECT name FROM users WHERE id = ?', [user_id]);
                const creatorName = creator[0]?.name || 'A member';
                
                // Create notification for each committee member
                for (const member of committeeMembers) {
                    await db.query(
                        `INSERT INTO notifications (user_id, type, title, message, post_id, actor_user_id, entity_type, entity_id, is_read)
                         VALUES (?, 'comment', ?, ?, ?, ?, 'post', ?, FALSE)`,
                        [
                            member.id,
                            `Committee ${post_type.charAt(0).toUpperCase() + post_type.slice(1)}`,
                            `${creatorName} posted a committee-only ${post_type}: ${name}`,
                            result.insertId,
                            user_id,
                            result.insertId
                        ]
                    );
                }
            } catch (error) {
                console.error('Error creating committee notifications:', error);
            }
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Post created successfully',
            data: { postId: result.insertId }
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating post',
            error: error.message 
        });
    }
};

// Update post (partial update)
exports.updatePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const updates = req.body;
        
        const postsTable = await getPostsTableName();
        
        // Check if post exists
        const [posts] = await db.query(`SELECT id, user_id FROM ${postsTable} WHERE id = ?`, [postId]);
        if (posts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }

        // Authorization: ensure the requesting user owns the post
        const requestingUserId = req.user && req.user.userId;
        if (!requestingUserId || requestingUserId != posts[0].user_id) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. You are not the owner of this post.'
            });
        }
        
        // Validate privacy if provided
        if (updates.privacy && !['public', 'private', 'committee'].includes(updates.privacy)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Privacy must be public, private, or committee' 
            });
        }
        
        // Validate post_type if provided
        if (updates.post_type && !['post', 'achievement', 'announcement', 'blog', 'issue', 'event'].includes(updates.post_type)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid post type' 
            });
        }
        
        // Fields that can be updated
        const allowedFields = [
            'name', 
            'description', 
            'link',
            'registration_link',
            'event_end_time',
            'post_type', 
            'tags', 
            'privacy'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(updates[field]);
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No valid fields to update' 
            });
        }
        
        updateValues.push(postId);
        
        await db.query(
            `UPDATE ${postsTable} SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        res.json({ 
            success: true, 
            message: 'Post updated successfully' 
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating post',
            error: error.message 
        });
    }
};

// Delete post
exports.deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        
        const postsTable = await getPostsTableName();
        const totalPostsCol = await getUserTotalPostsCol();
        
        // Check if post exists and get user_id
        const [posts] = await db.query(`SELECT user_id FROM ${postsTable} WHERE id = ?`, [postId]);
        if (posts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        const userId = posts[0].user_id;

        // Authorization: ensure the requesting user owns the post
        const requestingUserId = req.user && req.user.userId;
        if (!requestingUserId || requestingUserId != userId) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. You are not the owner of this post.'
            });
        }
        
        // Delete post
        await db.query(`DELETE FROM ${postsTable} WHERE id = ?`, [postId]);
        
        // Update user's total posts count
        await db.query(
            `UPDATE users SET ${totalPostsCol} = GREATEST(${totalPostsCol} - 1, 0) WHERE id = ?`,
            [userId]
        );
        
        res.json({ 
            success: true, 
            message: 'Post deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting post',
            error: error.message 
        });
    }
};

// Like/Unlike post
exports.toggleLike = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId; // Get from JWT
        
        const postsTable = await getPostsTableName();
        const likesInfo = await getPostLikesFkCol();
        
        // Check if post exists and access allowed
        const [posts] = await db.query(`SELECT id, user_id, privacy FROM ${postsTable} WHERE id = ?`, [postId]);
        if (posts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        const post = posts[0];
        if (post.privacy === 'private' && userId != post.user_id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        if (post.privacy === 'committee') {
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [userId]);
            if (committeeCheck[0].count === 0) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        }
        
        // Check if already liked
        const [existingLikes] = await db.query(
            `SELECT id FROM ${likesInfo.table} WHERE ${likesInfo.col} = ? AND user_id = ?`,
            [postId, userId]
        );
        
        let liked;
        if (existingLikes.length > 0) {
            // Unlike
            await db.query(
                `DELETE FROM ${likesInfo.table} WHERE ${likesInfo.col} = ? AND user_id = ?`,
                [postId, userId]
            );
            await db.query(
                `UPDATE ${postsTable} SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?`,
                [postId]
            );
            liked = false;
        } else {
            // Like
            await db.query(
                `INSERT INTO ${likesInfo.table} (${likesInfo.col}, user_id) VALUES (?, ?)`,
                [postId, userId]
            );
            await db.query(
                `UPDATE ${postsTable} SET likes_count = likes_count + 1 WHERE id = ?`,
                [postId]
            );
            liked = true;
            
            // Create like notification
            try {
                await notificationController.createLikeNotification(postId, userId);
            } catch (error) {
                console.error('Error creating like notification:', error);
            }
        }
        
        // Get updated like count
        const [updatedPost] = await db.query(
            `SELECT likes_count FROM ${postsTable} WHERE id = ?`,
            [postId]
        );
        
        res.json({
            success: true,
            message: liked ? 'Post liked' : 'Post unliked',
            data: {
                liked,
                likesCount: updatedPost[0].likes_count
            }
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating like status',
            error: error.message 
        });
    }
};

// Get post comments
exports.getComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const viewerId = req.user?.userId || null;
        
        const postsTable = await getPostsTableName();
        const commentsPostCol = await getCommentsPostCol();
        
        // Check if post exists and enforce privacy
        const [posts] = await db.query(`SELECT id, user_id, privacy FROM ${postsTable} WHERE id = ?`, [postId]);
        if (posts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        const post = posts[0];
        if (post.privacy === 'private') {
            if (!viewerId || viewerId != post.user_id) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        } else if (post.privacy === 'committee') {
            if (!viewerId) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [viewerId]);
            if (committeeCheck[0].count === 0) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        }
        
        let query = `
            SELECT c.*, u.username, u.name as user_name,
                   ${viewerId ? `(SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked_comment,` : ''}
                   (SELECT COUNT(*) FROM comments replies WHERE replies.parent_comment_id = c.id) as replies_count
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.${commentsPostCol} = ? AND c.parent_comment_id IS NULL
            ORDER BY c.created_at DESC 
            LIMIT ? OFFSET ?
        `;
        const params = viewerId ? [viewerId, postId, parseInt(limit), parseInt(offset)] : [postId, parseInt(limit), parseInt(offset)];
        
        const [comments] = await db.query(query, params);
        
        res.json({
            success: true,
            data: comments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching comments',
            error: error.message 
        });
    }
};

// Add comment to post
exports.addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, parentCommentId = null } = req.body;
        const userId = req.user.userId; // Get from JWT
        
        if (!content || content.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Content is required'
            });
        }
        
        const postsTable = await getPostsTableName();
        const commentsPostCol = await getCommentsPostCol();
        
        // Check if post exists and access allowed
        const [posts] = await db.query(`SELECT id, user_id, privacy FROM ${postsTable} WHERE id = ?`, [postId]);
        if (posts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        const post = posts[0];
        if (post.privacy === 'private' && userId != post.user_id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        if (post.privacy === 'committee') {
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [userId]);
            if (committeeCheck[0].count === 0) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        }
        
        // If parent comment ID is provided, check if it exists
        if (parentCommentId) {
            const [parentComments] = await db.query(
                `SELECT id FROM comments WHERE id = ? AND ${commentsPostCol} = ?`,
                [parentCommentId, postId]
            );
            if (parentComments.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Parent comment not found' 
                });
            }
        }
        
        // Insert comment
        const [result] = await db.query(
            `INSERT INTO comments (${commentsPostCol}, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)`,
            [postId, userId, content.trim(), parentCommentId]
        );
        
        // Update post comments count (only for top-level comments)
        if (!parentCommentId) {
            await db.query(
                `UPDATE ${postsTable} SET comments_count = comments_count + 1 WHERE id = ?`,
                [postId]
            );
        }
        
        // Create comment notification
        try {
            await notificationController.createCommentNotification(postId, result.insertId, userId);
        } catch (error) {
            console.error('Error creating comment notification:', error);
        }
        
        // Get the created comment with user info
        const [newComment] = await db.query(`
            SELECT c.*, u.username, u.name as user_name,
                   0 as user_liked_comment, 0 as likes_count, 0 as replies_count
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.id = ?
        `, [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: newComment[0]
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding comment',
            error: error.message 
        });
    }
};

// Toggle comment like
exports.toggleCommentLike = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.userId; // Get from JWT
        
        // Check if comment exists
        const [comments] = await db.query('SELECT id FROM comments WHERE id = ?', [commentId]);
        if (comments.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
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
        
        // Check if already liked
        const [existingLikes] = await db.query(
            'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
            [commentId, userId]
        );
        
        let liked;
        if (existingLikes.length > 0) {
            // Unlike
            await db.query(
                'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
                [commentId, userId]
            );
            await db.query(
                'UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?',
                [commentId]
            );
            liked = false;
        } else {
            // Like
            await db.query(
                'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
                [commentId, userId]
            );
            await db.query(
                'UPDATE comments SET likes_count = likes_count + 1 WHERE id = ?',
                [commentId]
            );
            liked = true;
        }
        
        // Get updated like count
        const [updatedComment] = await db.query(
            'SELECT likes_count FROM comments WHERE id = ?',
            [commentId]
        );
        
        res.json({
            success: true,
            message: liked ? 'Comment liked' : 'Comment unliked',
            data: {
                liked,
                likesCount: updatedComment[0].likes_count
            }
        });
    } catch (error) {
        console.error('Error toggling comment like:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating comment like status',
            error: error.message 
        });
    }
};

// Get comment replies
exports.getCommentReplies = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const viewerId = req.user?.userId || null;
        
        const postsTable = await getPostsTableName();
        const commentsPostCol = await getCommentsPostCol();
        
        // Check if comment exists and enforce parent post privacy
        const [comments] = await db.query(`SELECT id, ${commentsPostCol} as post_id FROM comments WHERE id = ?`, [commentId]);
        if (comments.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }
        const postId = comments[0].post_id;
        const [posts] = await db.query(`SELECT id, user_id, privacy FROM ${postsTable} WHERE id = ?`, [postId]);
        if (posts.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        const post = posts[0];
        if (post.privacy === 'private') {
            if (!viewerId || viewerId != post.user_id) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        } else if (post.privacy === 'committee') {
            if (!viewerId) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
            const [committeeCheck] = await db.query(`
                SELECT COUNT(*) as count FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ? AND r.role_category = 'committee' AND ur.is_active = TRUE
            `, [viewerId]);
            if (committeeCheck[0].count === 0) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        }
        
        let query = `
            SELECT c.*, u.username, u.name as user_name
                   ${viewerId ? `, (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked_comment` : ''}
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.parent_comment_id = ?
            ORDER BY c.created_at ASC 
            LIMIT ? OFFSET ?
        `;
        const params = viewerId ? [viewerId, commentId, parseInt(limit), parseInt(offset)] : [commentId, parseInt(limit), parseInt(offset)];
        
        const [replies] = await db.query(query, params);
        
        res.json({
            success: true,
            data: replies,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching comment replies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching comment replies',
            error: error.message 
        });
    }
};

// Get all organizations for filter dropdown
exports.getOrganizations = async (req, res) => {
    try {
        // Get unique organizations from users table
        const [organizations] = await db.query(`
            SELECT DISTINCT organization 
            FROM users 
            WHERE organization IS NOT NULL 
            AND organization != ''
            ORDER BY organization ASC
        `);
        
        // Extract organization names into array
        const orgList = organizations.map(row => row.organization);
        
        res.json({
            success: true,
            data: orgList
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching organizations',
            error: error.message
        });
    }
};

// Get all tags for filter dropdown
exports.getTags = async (req, res) => {
    try {
        const postsTable = await getPostsTableName();
        
        const [posts] = await db.query(`
            SELECT DISTINCT p.tags 
            FROM ${postsTable} p 
            WHERE p.tags IS NOT NULL 
            AND p.tags != ''
        `);
        
        // Extract individual tags from comma-separated strings
        const tagSet = new Set();
        posts.forEach(post => {
            if (post.tags) {
                const tags = post.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                tags.forEach(tag => tagSet.add(tag));
            }
        });
        
        // Convert set to array and sort
        const uniqueTags = Array.from(tagSet).sort();
        
        res.json({
            success: true,
            data: uniqueTags
        });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tags',
            error: error.message
        });
    }
};
