const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { verifyToken } = require('../middleware/auth');

router.post('/', verifyToken, registrationController.createRegistration);
router.get('/', verifyToken, registrationController.getRegistrations);
router.post('/:id/register', verifyToken, registrationController.registerFree);
router.put('/:id/close', verifyToken, registrationController.closeRegistration);
router.delete('/:id', verifyToken, registrationController.deleteRegistration);
router.get('/:id/participants', verifyToken, registrationController.getParticipants);
router.get('/:id/payments', verifyToken, registrationController.getPayments);

module.exports = router;
