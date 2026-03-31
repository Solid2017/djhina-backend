const router = require('express').Router();
const ctrl   = require('../controllers/ticketController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.post('/purchase', authenticate, ctrl.purchase);
router.get ('/my',       authenticate, ctrl.myTickets);
router.get ('/:id',      authenticate, ctrl.getTicket);

// Vérification QR — organisateur ou admin uniquement
router.post('/verify',   authenticate, requireRole('organizer', 'admin'), ctrl.verify);

module.exports = router;
