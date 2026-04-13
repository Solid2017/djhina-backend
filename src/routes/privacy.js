const router = require('express').Router();
const ctrl   = require('../controllers/privacyController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get ('/settings',        ctrl.getSettings);
router.put ('/settings',        ctrl.updateSettings);
router.get ('/export',          ctrl.exportData);
router.post('/delete-account',  ctrl.deleteAccount);
router.put ('/change-password', ctrl.changePassword);

module.exports = router;
