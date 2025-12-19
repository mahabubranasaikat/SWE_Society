const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { verifyToken } = require('../middleware/auth');

router.post('/', verifyToken, feeController.createFeeCollection);
router.get('/', verifyToken, feeController.getFeeCollections);
router.post('/pay', verifyToken, feeController.submitPayment);
router.put('/:id/close', verifyToken, feeController.closeFeeCollection);
router.delete('/:id', verifyToken, feeController.deleteFeeCollection);
router.get('/:id/payments', verifyToken, feeController.getFeePayments);
router.put('/transactions/:id/status', verifyToken, feeController.updatePaymentStatus);

module.exports = router;
