const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { verifyToken, optionalAuth } = require('../middleware/auth');

// Public Routes (no auth required)
router.get('/search', optionalAuth, postController.searchPosts);
router.get('/organizations', postController.getOrganizations);
router.get('/tags', postController.getTags);
router.get('/', optionalAuth, postController.getAllPosts);
router.get('/user/:userId', optionalAuth, postController.getUserPosts);
router.get('/:postId', optionalAuth, postController.getPost);
router.get('/:postId/comments', optionalAuth, postController.getComments);
router.get('/comments/:commentId/replies', optionalAuth, postController.getCommentReplies);

// Protected Routes (auth required)
router.post('/', verifyToken, postController.createPost);
router.patch('/:postId', verifyToken, postController.updatePost);
router.delete('/:postId', verifyToken, postController.deletePost);

// Like Routes (auth required)
router.post('/:postId/like', verifyToken, postController.toggleLike);

// Comment Routes (auth required for posting/liking)
router.post('/:postId/comments', verifyToken, postController.addComment);
router.post('/comments/:commentId/like', verifyToken, postController.toggleCommentLike);

module.exports = router;
