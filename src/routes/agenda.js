/**
 * Djhina — Routes publiques Agenda & Speakers
 * /api/agenda   → sessions d'un événement, booking
 * /api/speakers → profil speaker + messagerie
 */
const router = require('express').Router();
const ctrl   = require('../controllers/agendaController');
const { authenticate, optionalAuth } = require('../middleware/auth');

const w = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Agenda d'un événement (optionnel auth pour voir ses bookings)
router.get('/agenda/:eventId',              optionalAuth, w(ctrl.getEventAgenda));
router.post('/agenda/sessions/:id/book',    authenticate, w(ctrl.bookSession));
router.delete('/agenda/sessions/:id/book',  authenticate, w(ctrl.cancelBooking));

// Profil speaker
router.get('/speakers/:id',                 w(ctrl.getSpeakerProfile));
router.post('/speakers/:id/messages',       authenticate, w(ctrl.sendMessage));
router.get('/speakers/:id/messages',        authenticate, w(ctrl.getMessages));

module.exports = router;
