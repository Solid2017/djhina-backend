/**
 * Djhina — Speaker Controller (Admin)
 * CRUD speakers + gestion des messages (réponses organisateur)
 */
const { v4: uuidv4 } = require('uuid');
const { pool }       = require('../config/database');
const path           = require('path');
const fs             = require('fs');

// ── helper photo path ────────────────────────────────────────
function photoUrl(req, filename) {
  if (!filename) return null;
  return `${req.protocol}://${req.get('host')}/uploads/speakers/${filename}`;
}

function deletePhotoFile(filename) {
  if (!filename) return;
  const filePath = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads', 'speakers', filename);
  fs.unlink(filePath, () => {});
}

// ── GET /api/admin/speakers ──────────────────────────────────
exports.listSpeakers = async (req, res) => {
  const { search, organizer_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = ['1=1'];
  const params = [];

  if (organizer_id) { where.push('s.organizer_id = ?'); params.push(organizer_id); }
  if (search) {
    where.push('(s.name LIKE ? OR s.company LIKE ? OR s.job_title LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const wc = where.join(' AND ');
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM speakers s WHERE ${wc}`, params
  );
  const [rows] = await pool.execute(
    `SELECT s.id, s.organizer_id, s.name, s.bio, s.photo, s.job_title, s.company,
            s.email, s.phone, s.social_links, s.is_active, s.created_at,
            u.name AS organizer_name
     FROM speakers s
     JOIN users u ON s.organizer_id = u.id
     WHERE ${wc}
     ORDER BY s.created_at DESC
     LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
    params
  );

  const speakers = rows.map(r => ({
    ...r,
    social_links: typeof r.social_links === 'string' ? JSON.parse(r.social_links) : (r.social_links || {}),
    photo: r.photo ? `${req.protocol}://${req.get('host')}/uploads/speakers/${r.photo}` : null,
  }));

  return res.json({
    success: true,
    data: speakers,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── POST /api/admin/speakers ─────────────────────────────────
exports.createSpeaker = async (req, res) => {
  const { organizer_id, name, bio, job_title, company, email, phone, social_links, is_active = 1 } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Le nom est requis.' });

  // organizer_id par défaut = celui de l'admin connecté si non fourni
  const orgId = organizer_id || req.user.id;

  const id = uuidv4();
  const photo = req.file ? req.file.filename : null;
  let sl = null;
  try { sl = social_links ? JSON.stringify(typeof social_links === 'string' ? JSON.parse(social_links) : social_links) : null; } catch { sl = null; }

  await pool.execute(
    `INSERT INTO speakers (id, organizer_id, name, bio, photo, job_title, company, email, phone, social_links, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, orgId, name, bio || null, photo, job_title || null, company || null, email || null, phone || null, sl, parseInt(is_active)]
  );

  const [[speaker]] = await pool.execute('SELECT * FROM speakers WHERE id = ?', [id]);
  return res.status(201).json({
    success: true,
    message: 'Speaker créé.',
    data: { ...speaker, photo: speaker.photo ? `${req.protocol}://${req.get('host')}/uploads/speakers/${speaker.photo}` : null },
  });
};

// ── GET /api/admin/speakers/:id ──────────────────────────────
exports.getSpeaker = async (req, res) => {
  const [[speaker]] = await pool.execute(
    `SELECT s.*, u.name AS organizer_name FROM speakers s JOIN users u ON s.organizer_id = u.id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!speaker) return res.status(404).json({ success: false, message: 'Speaker introuvable.' });

  // Sessions où ce speaker intervient
  const [sessions] = await pool.execute(
    `SELECT as2.id, as2.title, as2.start_time, as2.room, as2.type, e.title AS event_title, ss.role
     FROM session_speakers ss
     JOIN agenda_sessions as2 ON ss.session_id = as2.id
     JOIN events e ON as2.event_id = e.id
     WHERE ss.speaker_id = ?
     ORDER BY as2.start_time ASC`,
    [req.params.id]
  );

  return res.json({
    success: true,
    data: {
      ...speaker,
      social_links: typeof speaker.social_links === 'string' ? JSON.parse(speaker.social_links) : (speaker.social_links || {}),
      photo: speaker.photo ? `${req.protocol}://${req.get('host')}/uploads/speakers/${speaker.photo}` : null,
      sessions,
    },
  });
};

// ── PUT /api/admin/speakers/:id ──────────────────────────────
exports.updateSpeaker = async (req, res) => {
  const { name, bio, job_title, company, email, phone, social_links, is_active, organizer_id } = req.body;

  const [[existing]] = await pool.execute('SELECT * FROM speakers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, message: 'Speaker introuvable.' });

  let photo = existing.photo;
  if (req.file) {
    deletePhotoFile(existing.photo); // Supprimer l'ancienne photo
    photo = req.file.filename;
  }

  let sl = existing.social_links;
  if (social_links !== undefined) {
    try { sl = JSON.stringify(typeof social_links === 'string' ? JSON.parse(social_links) : social_links); } catch { sl = null; }
  }

  const fields = {
    name:        name        !== undefined ? name        : existing.name,
    bio:         bio         !== undefined ? bio         : existing.bio,
    photo,
    job_title:   job_title   !== undefined ? job_title   : existing.job_title,
    company:     company     !== undefined ? company     : existing.company,
    email:       email       !== undefined ? email       : existing.email,
    phone:       phone       !== undefined ? phone       : existing.phone,
    social_links: sl,
    is_active:   is_active   !== undefined ? parseInt(is_active) : existing.is_active,
    organizer_id: organizer_id || existing.organizer_id,
  };

  await pool.execute(
    `UPDATE speakers SET name=?, bio=?, photo=?, job_title=?, company=?, email=?, phone=?,
            social_links=?, is_active=?, organizer_id=? WHERE id=?`,
    [fields.name, fields.bio, fields.photo, fields.job_title, fields.company,
     fields.email, fields.phone, fields.social_links, fields.is_active, fields.organizer_id, req.params.id]
  );

  const [[updated]] = await pool.execute('SELECT * FROM speakers WHERE id = ?', [req.params.id]);
  return res.json({
    success: true,
    message: 'Speaker mis à jour.',
    data: { ...updated, photo: updated.photo ? `${req.protocol}://${req.get('host')}/uploads/speakers/${updated.photo}` : null },
  });
};

// ── DELETE /api/admin/speakers/:id ───────────────────────────
exports.deleteSpeaker = async (req, res) => {
  const [[existing]] = await pool.execute('SELECT photo FROM speakers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, message: 'Speaker introuvable.' });

  deletePhotoFile(existing.photo);
  await pool.execute('DELETE FROM speakers WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Speaker supprimé.' });
};

// ── GET /api/admin/speaker-messages — tous les messages ──────
exports.listMessages = async (req, res) => {
  const { speaker_id, event_id, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = ['1=1'];
  const params = [];
  if (speaker_id) { where.push('m.speaker_id = ?'); params.push(speaker_id); }
  if (event_id)   { where.push('m.event_id = ?');   params.push(event_id); }

  const wc = where.join(' AND ');
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM speaker_messages m WHERE ${wc}`, params);
  const [rows] = await pool.execute(
    `SELECT m.*, u.name AS user_name, s.name AS speaker_name, e.title AS event_title
     FROM speaker_messages m
     JOIN users    u ON m.user_id    = u.id
     JOIN speakers s ON m.speaker_id = s.id
     LEFT JOIN events e ON m.event_id = e.id
     WHERE ${wc}
     ORDER BY m.created_at DESC
     LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
    params
  );

  return res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
};

// ── PUT /api/admin/speaker-messages/:id/reply ────────────────
exports.replyMessage = async (req, res) => {
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ success: false, message: 'La réponse est requise.' });

  const [[msg]] = await pool.execute('SELECT * FROM speaker_messages WHERE id = ?', [req.params.id]);
  if (!msg) return res.status(404).json({ success: false, message: 'Message introuvable.' });

  await pool.execute(
    'UPDATE speaker_messages SET reply = ?, replied_at = NOW() WHERE id = ?',
    [reply, req.params.id]
  );
  return res.json({ success: true, message: 'Réponse enregistrée.' });
};
