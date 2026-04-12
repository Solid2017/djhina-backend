const router  = require('express').Router();
const ctrl    = require('../controllers/organizerController');
const { authenticate }  = require('../middleware/auth');
const { requireRole }   = require('../middleware/roles');
const upload            = require('../middleware/upload');

// Toutes les routes necessitent organisateur OU admin
router.use(authenticate, requireRole('organizer', 'admin'));

// ── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', ctrl.dashboard);

// ── Categories (lecture seule) ───────────────────────────────
router.get('/categories', ctrl.listCategories);

// ── Evenements ───────────────────────────────────────────────
router.get   ('/events',                    ctrl.myEvents);
router.post  ('/events',                    upload.single('cover'), ctrl.createEvent);
router.get   ('/events/:id',                ctrl.getEvent);
router.put   ('/events/:id',                upload.single('cover'), ctrl.updateEvent);
router.delete('/events/:id',                ctrl.deleteEvent);
router.post  ('/events/:id/submit',         ctrl.submitEvent);
router.put   ('/events/:id/status',         ctrl.setEventStatus);
router.put   ('/events/:id/ticket-types',   ctrl.updateTicketTypes);
router.get   ('/events/:id/tickets',        ctrl.eventTickets);
router.get   ('/events/:id/stats',          ctrl.eventStats);
router.get   ('/events/:id/scan-logs',      ctrl.eventScanLogs);
router.post  ('/events/:id/notify',         ctrl.notifyAttendees);
router.get   ('/events/:id/export',         ctrl.exportAttendees);
router.get   ('/events/:id/speakers',       ctrl.listEventSpeakers);
router.get   ('/events/:id/sessions',       ctrl.listSessions);
router.post  ('/events/:id/sessions',       ctrl.createSession);

// ── Sessions ─────────────────────────────────────────────────
router.put   ('/sessions/:id',  ctrl.updateSession);
router.delete('/sessions/:id',  ctrl.deleteSession);

// ── Speakers ─────────────────────────────────────────────────
router.get   ('/speakers',      ctrl.listSpeakers);
router.post  ('/speakers',      upload.single('photo'), ctrl.createSpeaker);
router.put   ('/speakers/:id',  upload.single('photo'), ctrl.updateSpeaker);
router.delete('/speakers/:id',  ctrl.deleteSpeaker);

// ── Notifications ────────────────────────────────────────────
router.get('/notifications',          ctrl.notifications);
router.put('/notifications/:id/read', ctrl.markNotifRead);

module.exports = router;
