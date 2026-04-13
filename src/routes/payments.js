const router = require('express').Router();
const ctrl   = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get ('/',            ctrl.history);
router.get ('/:id',         ctrl.getPayment);
router.post('/initiate',    ctrl.initiate);
router.post('/:id/confirm', ctrl.confirm);
router.post('/:id/cancel',  ctrl.cancel);

module.exports = router;
