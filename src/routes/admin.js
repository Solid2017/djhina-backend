const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const notifCtrl = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Wrapper qui catch les erreurs async et les passe à Express
const w = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Toutes les routes admin nécessitent le rôle "admin"
router.use(authenticate, requireRole('admin'));

// ── Stats globales ────────────────────────────────────────────
router.get('/stats', w(ctrl.stats));

// ── Utilisateurs — CRUD complet ───────────────────────────────
router.get   ('/users',        w(ctrl.listUsers));
router.post  ('/users',        w(ctrl.createUser));
router.get   ('/users/:id',    w(ctrl.getUser));
router.put   ('/users/:id',    w(ctrl.updateUser));
router.delete('/users/:id',    w(ctrl.deleteUser));

// ── Événements ────────────────────────────────────────────────
router.get('/events',                  w(ctrl.listEvents));
router.get('/events/:id',              w(ctrl.getEvent));
router.put('/events/:id/status',       w(ctrl.setEventStatus));
router.put('/events/:id/feature',      w(ctrl.featureEvent));

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

module.exports = router;
