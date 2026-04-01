const router = require('express').Router();
const ctrl   = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate); // toutes les routes nécessitent une auth

router.get   ('/',              ctrl.list);
router.put   ('/read-all',      ctrl.markAllRead);
router.delete('/',              ctrl.removeAll);
router.get   ('/:id',           ctrl.getOne);
router.put   ('/:id/read',      ctrl.markRead);
router.delete('/:id',           ctrl.remove);

module.exports = router;
