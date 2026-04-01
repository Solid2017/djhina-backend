const router = require('express').Router({ mergeParams: true });
const ctrl   = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');

router.get ('/',                            ctrl.list);
router.post('/',             authenticate,  ctrl.create);
router.put ('/:commentId',   authenticate,  ctrl.update);
router.delete('/:commentId', authenticate,  ctrl.remove);
router.get ('/:commentId/replies',          ctrl.replies);
router.post('/:commentId/like', authenticate, ctrl.like);

module.exports = router;
