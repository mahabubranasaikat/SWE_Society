const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken } = require('../middleware/auth');

// Public listing (no auth required to view)
router.get('/', eventController.listEvents);

// Get single event with updates
router.get('/:id', eventController.getEventById);

// Create event (society members only)
router.post('/', verifyToken, eventController.createEvent);

// Delete event (creator or society members)
router.delete('/:id', verifyToken, eventController.deleteEvent);

// Add update to event (any authenticated user)
router.post('/:id/updates', verifyToken, eventController.addEventUpdate);

// Get event updates
router.get('/:id/updates', eventController.getEventUpdates);

module.exports = router;
