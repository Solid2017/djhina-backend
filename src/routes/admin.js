const router      = require('express').Router();
const ctrl        = require('../controllers/adminController');
const speakerCtrl = require('../controllers/speakerController');
const agendaCtrl  = require('../controllers/agendaController');
const notifCtrl   = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const upload = require('../middleware/upload');

// Wrapper qui catch les erreurs async et les passe à Express
const w = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Toutes les routes admin nécessitent le rôle "admin"
router.use(authenticate, requireRole('admin'));

// ── Stats globales ────────────────────────────────────────────
router.get('/stats', w(ctrl.stats));

// ── Utilisateurs — CRUD complet ───────────────────────────────
router.get   ('/users',        w(ctrl.listUsers));
router.post  ('/users',        upload.single('avatar'), w(ctrl.createUser));
router.get   ('/users/:id',    w(ctrl.getUser));
router.put   ('/users/:id',    upload.single('avatar'), w(ctrl.updateUser));
router.delete('/users/:id',    w(ctrl.deleteUser));

// ── Événements ────────────────────────────────────────────────
router.get   ('/events',          w(ctrl.listEvents));
router.post  ('/events',          upload.single('cover'), w(ctrl.createEvent));
router.get   ('/events/:id',      w(ctrl.getEvent));
router.put   ('/events/:id',      upload.single('cover'), w(ctrl.updateEvent));
router.put   ('/events/:id/status',  w(ctrl.setEventStatus));
router.put   ('/events/:id/feature', w(ctrl.featureEvent));
router.delete('/events/:id',         w(ctrl.deleteEvent));

// ── Tickets — lecture + annulation ───────────────────────────
router.get('/tickets',                 w(ctrl.listTickets));
router.get('/tickets/:number',         w(ctrl.getTicket));
router.put('/tickets/:number/cancel',  w(ctrl.cancelTicket));

// ── Paiements — lecture + changement statut ───────────────────
router.get('/payments',                w(ctrl.listPayments));
router.get('/payments/:id',            w(ctrl.getPayment));
router.put('/payments/:id/status',     w(ctrl.updatePaymentStatus));

// ── Logs de scan ──────────────────────────────────────────────
router.get('/scan-logs',               w(ctrl.scanLogs));

// ── Catégories — CRUD complet ─────────────────────────────────
router.get   ('/categories',        w(ctrl.listCategories));
router.post  ('/categories',        w(ctrl.createCategory));
router.put   ('/categories/:id',    w(ctrl.updateCategory));
router.delete('/categories/:id',    w(ctrl.deleteCategory));

// ── Notifications broadcast ───────────────────────────────────
router.post('/notifications/broadcast', w(notifCtrl.broadcast));

// ── Speakers — CRUD complet ───────────────────────────────────
router.get   ('/speakers',              w(speakerCtrl.listSpeakers));
router.post  ('/speakers',              upload.single('photo'), w(speakerCtrl.createSpeaker));
router.get   ('/speakers/:id',          w(speakerCtrl.getSpeaker));
router.put   ('/speakers/:id',          upload.single('photo'), w(speakerCtrl.updateSpeaker));
router.delete('/speakers/:id',          w(speakerCtrl.deleteSpeaker));

// ── Messages speakers (admin) ─────────────────────────────────
router.get('/speaker-messages',         w(speakerCtrl.listMessages));
router.put('/speaker-messages/:id/reply', w(speakerCtrl.replyMessage));

// ── Agenda — sessions par événement ──────────────────────────
router.get   ('/events/:id/sessions',   w(agendaCtrl.listSessions));
router.post  ('/events/:id/sessions',   w(agendaCtrl.createSession));
router.get   ('/sessions/:id',          w(agendaCtrl.getSession));
router.put   ('/sessions/:id',          w(agendaCtrl.updateSession));
router.delete('/sessions/:id',          w(agendaCtrl.deleteSession));
router.put   ('/sessions/:id/speakers', w(agendaCtrl.setSpeakers));
router.get   ('/sessions/:id/bookings', w(agendaCtrl.listBookings));

module.exports = router;
