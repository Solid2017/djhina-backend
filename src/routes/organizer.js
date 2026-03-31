const router = require('express').Router();
const ctrl   = require('../controllers/organizerController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Toutes les routes nécessitent organisateur OU admin
router.use(authenticate, requireRole('organizer', 'admin'));

router.get('/dashboard',                          ctrl.dashboard);
router.get('/events',                             ctrl.myEvents);
router.get('/events/:id/tickets',                 ctrl.eventTickets);
router.get('/events/:id/stats',                   ctrl.eventStats);
router.get('/events/:id/scan-logs',               ctrl.eventScanLogs);
router.put('/events/:id/ticket-types',            ctrl.updateTicketTypes);
router.get('/notifications',                      ctrl.notifications);
router.put('/notifications/:id/read',             ctrl.markNotifRead);

module.exports = router;
