const router = require('express').Router();
const ctrl   = require('../controllers/eventController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, isOwnerOrAdmin } = require('../middleware/roles');
const upload = require('../middleware/upload');
const { pool } = require('../config/database');

// Résoudre l'organisateur d'un événement
const getEventOwner = async (req) => {
  const [[row]] = await pool.execute('SELECT organizer_id FROM events WHERE id = ?', [req.params.id]);
  return row?.organizer_id;
};

// ── Routes publiques (auth optionnelle) ──
router.get('/',     optionalAuth, ctrl.list);
router.get('/:id',  optionalAuth, ctrl.getOne);
router.get('/:id/comments', ctrl.getComments);

// ── Routes authentifiées ──
router.post('/:id/like',    authenticate, ctrl.like);
router.post('/:id/save',    authenticate, ctrl.save);
router.post('/:id/comments',authenticate, ctrl.addComment);

// ── Organisateur ou admin ──
router.post(
  '/',
  authenticate,
  requireRole('organizer', 'admin'),
  upload.single('cover'),
  ctrl.create
);
router.put(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  isOwnerOrAdmin(getEventOwner),
  upload.single('cover'),
  ctrl.update
);
router.put(
  '/:id/publish',
  authenticate,
  requireRole('organizer', 'admin'),
  ctrl.publish
);
router.delete(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  isOwnerOrAdmin(getEventOwner),
  ctrl.remove
);

module.exports = router;
