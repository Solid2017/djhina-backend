const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const notifCtrl = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Toutes les routes admin nécessitent le rôle "admin"
router.use(authenticate, requireRole('admin'));

// ── Stats globales ────────────────────────────────────────────
router.get('/stats', ctrl.stats);

// ── Utilisateurs — CRUD complet ───────────────────────────────
router.get   ('/users',        ctrl.listUsers);
router.post  ('/users',        ctrl.createUser);
router.get   ('/users/:id',    ctrl.getUser);
router.put   ('/users/:id',    ctrl.updateUser);
router.delete('/users/:id',    ctrl.deleteUser);

// ── Événements ────────────────────────────────────────────────
router.get('/events',                  ctrl.listEvents);
router.get('/events/:id',              ctrl.getEvent);
router.put('/events/:id/status',       ctrl.setEventStatus);
router.put('/events/:id/feature',      ctrl.featureEvent);

// ── Tickets — lecture + annulation ───────────────────────────
router.get('/tickets',                 ctrl.listTickets);
router.get('/tickets/:number',         ctrl.getTicket);
router.put('/tickets/:number/cancel',  ctrl.cancelTicket);

// ── Paiements — lecture + changement statut ───────────────────
router.get('/payments',                ctrl.listPayments);
router.get('/payments/:id',            ctrl.getPayment);
router.put('/payments/:id/status',     ctrl.updatePaymentStatus);

// ── Logs de scan ──────────────────────────────────────────────
router.get('/scan-logs',               ctrl.scanLogs);

// ── Catégories — CRUD complet ─────────────────────────────────
router.get   ('/categories',        ctrl.listCategories);
router.post  ('/categories',        ctrl.createCategory);
router.put   ('/categories/:id',    ctrl.updateCategory);
router.delete('/categories/:id',    ctrl.deleteCategory);

// ── Notifications broadcast ───────────────────────────────────
router.post('/notifications/broadcast', notifCtrl.broadcast);

module.exports = router;
