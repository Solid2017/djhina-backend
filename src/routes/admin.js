const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Toutes les routes admin nécessitent le rôle "admin"
router.use(authenticate, requireRole('admin'));

// Stats globales
router.get('/stats', ctrl.stats);

// Gestion des utilisateurs
router.get   ('/users',        ctrl.listUsers);
router.post  ('/users',        ctrl.createUser);
router.get   ('/users/:id',    ctrl.getUser);
router.put   ('/users/:id',    ctrl.updateUser);
router.delete('/users/:id',    ctrl.deleteUser);

// Gestion des événements
router.get('/events',                    ctrl.listEvents);
router.put('/events/:id/status',         ctrl.setEventStatus);
router.put('/events/:id/feature',        ctrl.featureEvent);

// Paiements & logs
router.get('/payments',   ctrl.listPayments);
router.get('/scan-logs',  ctrl.scanLogs);

// Catégories
router.get   ('/categories',        ctrl.listCategories);
router.post  ('/categories',        ctrl.createCategory);
router.put   ('/categories/:id',    ctrl.updateCategory);
router.delete('/categories/:id',    ctrl.deleteCategory);

module.exports = router;
