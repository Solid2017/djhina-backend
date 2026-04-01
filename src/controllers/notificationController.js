const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// ── GET /api/notifications ───────────────────────────────────
exports.list = async (req, res) => {
  const { page = 1, limit = 30, unread } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = ['user_id = ?'];
  const params = [req.user.id];

  if (unread === '1') { where.push('is_read = 0'); }

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM notifications WHERE ${where.join(' AND ')}`, params
  );
  const [[{ unread_count }]] = await pool.execute(
    'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]
  );

  const [notifications] = await pool.execute(
    `SELECT * FROM notifications WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: notifications,
    meta: { total, unread_count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── GET /api/notifications/:id ───────────────────────────────
exports.getOne = async (req, res) => {
  const [[notif]] = await pool.execute(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!notif) return res.status(404).json({ success: false, message: 'Notification introuvable.' });

  // Marquer comme lue automatiquement
  if (!notif.is_read) {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
  }

  return res.json({ success: true, data: { ...notif, is_read: true } });
};

// ── PUT /api/notifications/:id/read ──────────────────────────
exports.markRead = async (req, res) => {
  const [[notif]] = await pool.execute(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!notif) return res.status(404).json({ success: false, message: 'Notification introuvable.' });

  await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Notification marquée comme lue.' });
};

// ── PUT /api/notifications/read-all ──────────────────────────
exports.markAllRead = async (req, res) => {
  const [result] = await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  return res.json({ success: true, message: `${result.affectedRows} notification(s) marquée(s) comme lues.` });
};

// ── DELETE /api/notifications/:id ────────────────────────────
exports.remove = async (req, res) => {
  const [[notif]] = await pool.execute(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!notif) return res.status(404).json({ success: false, message: 'Notification introuvable.' });

  await pool.execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Notification supprimée.' });
};

// ── DELETE /api/notifications ─────────────────────────────────
exports.removeAll = async (req, res) => {
  const [result] = await pool.execute(
    'DELETE FROM notifications WHERE user_id = ?', [req.user.id]
  );
  return res.json({ success: true, message: `${result.affectedRows} notification(s) supprimée(s).` });
};

// ── POST /api/admin/notifications ────────────────────────────
// Envoyer une notification broadcast à tous (admin)
exports.broadcast = async (req, res) => {
  const { title, message, type = 'info', target_role } = req.body;
  if (!title || !message) return res.status(400).json({ success: false, message: 'Titre et message requis.' });

  const where  = ['is_active = 1'];
  const params = [];
  if (target_role) { where.push('role = ?'); params.push(target_role); }

  const [users] = await pool.execute(
    `SELECT id FROM users WHERE ${where.join(' AND ')}`, params
  );

  if (!users.length) return res.json({ success: true, message: 'Aucun destinataire trouvé.', sent: 0 });

  const values = users.map(u => [uuidv4(), u.id, type, title, message, null]);
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES ?',
    [values]
  );

  return res.status(201).json({ success: true, message: `Notification envoyée à ${users.length} utilisateur(s).`, sent: users.length });
};
