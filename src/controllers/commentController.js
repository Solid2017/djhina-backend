const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// ── GET /api/events/:id/comments ─────────────────────────────
exports.list = async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [[{ total }]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM comments WHERE event_id = ? AND parent_id IS NULL',
    [req.params.id]
  );

  const [comments] = await pool.execute(
    `SELECT c.*,
       u.name AS author_name, u.avatar AS author_avatar, u.role AS author_role,
       (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) AS reply_count
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.event_id = ? AND c.parent_id IS NULL
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.params.id, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: comments,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── GET /api/events/:id/comments/:commentId/replies ──────────
exports.replies = async (req, res) => {
  const [replies] = await pool.execute(
    `SELECT c.*, u.name AS author_name, u.avatar AS author_avatar
     FROM comments c JOIN users u ON c.user_id = u.id
     WHERE c.parent_id = ? ORDER BY c.created_at ASC`,
    [req.params.commentId]
  );
  return res.json({ success: true, data: replies });
};

// ── POST /api/events/:id/comments ────────────────────────────
exports.create = async (req, res) => {
  const { content, parent_id } = req.body;
  if (!content?.trim()) return res.status(400).json({ success: false, message: 'Le commentaire ne peut pas être vide.' });

  // Vérifier que l'événement existe
  const [[event]] = await pool.execute('SELECT id FROM events WHERE id = ?', [req.params.id]);
  if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  // Si reply, vérifier que le parent existe
  if (parent_id) {
    const [[parent]] = await pool.execute('SELECT id FROM comments WHERE id = ? AND event_id = ?', [parent_id, req.params.id]);
    if (!parent) return res.status(404).json({ success: false, message: 'Commentaire parent introuvable.' });
  }

  const id = uuidv4();
  await pool.execute(
    'INSERT INTO comments (id, event_id, user_id, content, parent_id) VALUES (?,?,?,?,?)',
    [id, req.params.id, req.user.id, content.trim(), parent_id || null]
  );

  const [[created]] = await pool.execute(
    `SELECT c.*, u.name AS author_name, u.avatar AS author_avatar
     FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`, [id]
  );

  return res.status(201).json({ success: true, data: created });
};

// ── PUT /api/events/:id/comments/:commentId ──────────────────
exports.update = async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ success: false, message: 'Contenu requis.' });

  const [[comment]] = await pool.execute(
    'SELECT id, user_id FROM comments WHERE id = ? AND event_id = ?',
    [req.params.commentId, req.params.id]
  );
  if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });

  if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Vous ne pouvez modifier que vos propres commentaires.' });
  }

  await pool.execute(
    'UPDATE comments SET content = ?, updated_at = NOW() WHERE id = ?',
    [content.trim(), req.params.commentId]
  );

  return res.json({ success: true, message: 'Commentaire modifié.' });
};

// ── DELETE /api/events/:id/comments/:commentId ───────────────
exports.remove = async (req, res) => {
  const [[comment]] = await pool.execute(
    'SELECT id, user_id FROM comments WHERE id = ? AND event_id = ?',
    [req.params.commentId, req.params.id]
  );
  if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });

  if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Vous ne pouvez supprimer que vos propres commentaires.' });
  }

  // Supprimer aussi les réponses
  await pool.execute('DELETE FROM comments WHERE parent_id = ?', [req.params.commentId]);
  await pool.execute('DELETE FROM comments WHERE id = ?', [req.params.commentId]);

  return res.json({ success: true, message: 'Commentaire supprimé.' });
};

// ── POST /api/events/:id/comments/:commentId/like ────────────
exports.like = async (req, res) => {
  const [[comment]] = await pool.execute(
    'SELECT id, likes FROM comments WHERE id = ?', [req.params.commentId]
  );
  if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });

  await pool.execute('UPDATE comments SET likes = likes + 1 WHERE id = ?', [req.params.commentId]);
  return res.json({ success: true, data: { likes: comment.likes + 1 } });
};
