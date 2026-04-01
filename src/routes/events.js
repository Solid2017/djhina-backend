const router = require('express').Router();
const ctrl   = require('../controllers/eventController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole, isOwnerOrAdmin } = require('../middleware/roles');
const upload = require('../middleware/upload');
const { pool } = require('../config/database');

const getEventOwner = async (req) => {
  const [[row]] = await pool.execute('SELECT organizer_id FROM events WHERE id = ?', [req.params.id]);
  return row?.organizer_id;
};

// ── Publiques ──────────────────────────────────────────────────
router.get('/',    optionalAuth, ctrl.list);
router.get('/:id', optionalAuth, ctrl.getOne);

// ── Sous-routeurs imbriqués ────────────────────────────────────
router.use('/:eventId/ticket-types', require('./ticket-types'));  // CRUD types de billets
router.use('/:id/comments',          require('./comments'));       // CRUD commentaires

// ── Auth requise ───────────────────────────────────────────────
router.post('/:id/like', authenticate, ctrl.like);
router.post('/:id/save', authenticate, ctrl.save);

// ── Organisateur ou admin ──────────────────────────────────────
router.post(
  '/',
  authenticate, requireRole('organizer', 'admin'),
  upload.single('cover'), ctrl.create
);
router.put(
  '/:id',
  authenticate, requireRole('organizer', 'admin'),
  isOwnerOrAdmin(getEventOwner),
  upload.single('cover'), ctrl.update
);
router.put(
  '/:id/publish',
  authenticate, requireRole('organizer', 'admin'),
  ctrl.publish
);
router.delete(
  '/:id',
  authenticate, requireRole('organizer', 'admin'),
  isOwnerOrAdmin(getEventOwner),
  ctrl.remove
);

module.exports = router;
