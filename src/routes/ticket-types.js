const router = require('express').Router({ mergeParams: true }); // mergeParams pour accéder à :eventId
const ctrl   = require('../controllers/ticketTypeController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Lecture publique (auth optionnelle)
router.get('/',    optionalAuth, ctrl.list);
router.get('/:id', optionalAuth, ctrl.getOne);

// Création / modification — organisateur ou admin
router.post('/',              authenticate, requireRole('organizer', 'admin'), ctrl.create);
router.put ('/:id',           authenticate, requireRole('organizer', 'admin'), ctrl.update);
router.put ('/:id/toggle',    authenticate, requireRole('organizer', 'admin'), ctrl.toggle);
router.delete('/:id',         authenticate, requireRole('organizer', 'admin'), ctrl.remove);

module.exports = router;
