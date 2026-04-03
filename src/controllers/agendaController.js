/**
 * Djhina — Agenda / Sessions Controller
 * Admin : CRUD sessions + assignation speakers
 * Public (auth) : lecture agenda, booking, messages speakers
 */
const { v4: uuidv4 } = require('uuid');
const { pool }       = require('../config/database');

// ═══════════════════════════ ADMIN ═══════════════════════════

// ── GET /api/admin/events/:id/sessions ───────────────────────
exports.listSessions = async (req, res) => {
  const [sessions] = await pool.execute(
    `SELECT s.id, s.title, s.description, s.room, s.type, s.start_time, s.end_time,
            s.capacity, s.registered, s.access_conditions, s.order_index, s.is_visible,
            s.created_at
     FROM agenda_sessions s
     WHERE s.event_id = ?
     ORDER BY s.order_index ASC, s.start_time ASC`,
    [req.params.id]
  );

  // Charger les speakers de chaque session
  const sessionIds = sessions.map(s => s.id);
  let speakersMap = {};
  if (sessionIds.length) {
    const placeholders = sessionIds.map(() => '?').join(',');
    const [spRows] = await pool.execute(
      `SELECT ss.session_id, ss.role, sp.id, sp.name, sp.photo, sp.job_title, sp.company
       FROM session_speakers ss
       JOIN speakers sp ON ss.speaker_id = sp.id
       WHERE ss.session_id IN (${placeholders})`,
      sessionIds
    );
    spRows.forEach(r => {
      if (!speakersMap[r.session_id]) speakersMap[r.session_id] = [];
      speakersMap[r.session_id].push({
        id: r.id, name: r.name, photo: r.photo
          ? `${req.protocol}://${req.get('host')}/uploads/speakers/${r.photo}` : null,
        job_title: r.job_title, company: r.company, role: r.role,
      });
    });
  }

  const data = sessions.map(s => ({ ...s, speakers: speakersMap[s.id] || [] }));
  return res.json({ success: true, data });
};

// ── POST /api/admin/events/:id/sessions ──────────────────────
exports.createSession = async (req, res) => {
  const { title, description, room, type = 'conference', start_time, end_time,
          capacity, access_conditions, order_index = 0, is_visible = 1, speakers = [] } = req.body;

  if (!title)      return res.status(400).json({ success: false, message: 'Le titre est requis.' });
  if (!start_time) return res.status(400).json({ success: false, message: "L'heure de début est requise." });

  // Vérifier que l'événement existe
  const [[event]] = await pool.execute('SELECT id FROM events WHERE id = ?', [req.params.id]);
  if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const id = uuidv4();
  await pool.execute(
    `INSERT INTO agenda_sessions
      (id, event_id, title, description, room, type, start_time, end_time,
       capacity, access_conditions, order_index, is_visible)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, req.params.id, title, description || null, room || null, type,
     start_time, end_time || null, capacity ? parseInt(capacity) : null,
     access_conditions || null, parseInt(order_index), parseInt(is_visible)]
  );

  // Assigner les speakers
  if (Array.isArray(speakers) && speakers.length) {
    for (const sp of speakers) {
      await pool.execute(
        'INSERT IGNORE INTO session_speakers (id, session_id, speaker_id, role) VALUES (?,?,?,?)',
        [uuidv4(), id, sp.speaker_id || sp.id, sp.role || 'speaker']
      );
    }
  }

  const [[session]] = await pool.execute('SELECT * FROM agenda_sessions WHERE id = ?', [id]);
  return res.status(201).json({ success: true, message: 'Session créée.', data: session });
};

// ── GET /api/admin/sessions/:id ──────────────────────────────
exports.getSession = async (req, res) => {
  const [[session]] = await pool.execute(
    `SELECT s.*, e.title AS event_title FROM agenda_sessions s JOIN events e ON s.event_id = e.id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

  const [speakers] = await pool.execute(
    `SELECT sp.id, sp.name, sp.photo, sp.job_title, sp.company, ss.role
     FROM session_speakers ss JOIN speakers sp ON ss.speaker_id = sp.id
     WHERE ss.session_id = ?`,
    [req.params.id]
  );

  const [bookings] = await pool.execute(
    `SELECT COUNT(*) AS total FROM session_bookings WHERE session_id = ? AND status = 'confirmed'`,
    [req.params.id]
  );

  return res.json({
    success: true,
    data: {
      ...session,
      speakers: speakers.map(s => ({
        ...s,
        photo: s.photo ? `${req.protocol}://${req.get('host')}/uploads/speakers/${s.photo}` : null,
      })),
      bookings_count: bookings[0].total,
    },
  });
};

// ── PUT /api/admin/sessions/:id ──────────────────────────────
exports.updateSession = async (req, res) => {
  const [[existing]] = await pool.execute('SELECT * FROM agenda_sessions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, message: 'Session introuvable.' });

  const { title, description, room, type, start_time, end_time,
          capacity, access_conditions, order_index, is_visible, speakers } = req.body;

  await pool.execute(
    `UPDATE agenda_sessions SET
       title=?, description=?, room=?, type=?, start_time=?, end_time=?,
       capacity=?, access_conditions=?, order_index=?, is_visible=?
     WHERE id=?`,
    [
      title       !== undefined ? title       : existing.title,
      description !== undefined ? description : existing.description,
      room        !== undefined ? room        : existing.room,
      type        !== undefined ? type        : existing.type,
      start_time  !== undefined ? start_time  : existing.start_time,
      end_time    !== undefined ? end_time    : existing.end_time,
      capacity    !== undefined ? (capacity ? parseInt(capacity) : null) : existing.capacity,
      access_conditions !== undefined ? access_conditions : existing.access_conditions,
      order_index !== undefined ? parseInt(order_index) : existing.order_index,
      is_visible  !== undefined ? parseInt(is_visible)  : existing.is_visible,
      req.params.id,
    ]
  );

  // Remplacer les speakers si fournis
  if (Array.isArray(speakers)) {
    await pool.execute('DELETE FROM session_speakers WHERE session_id = ?', [req.params.id]);
    for (const sp of speakers) {
      await pool.execute(
        'INSERT IGNORE INTO session_speakers (id, session_id, speaker_id, role) VALUES (?,?,?,?)',
        [uuidv4(), req.params.id, sp.speaker_id || sp.id, sp.role || 'speaker']
      );
    }
  }

  const [[updated]] = await pool.execute('SELECT * FROM agenda_sessions WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Session mise à jour.', data: updated });
};

// ── DELETE /api/admin/sessions/:id ──────────────────────────
exports.deleteSession = async (req, res) => {
  const [[existing]] = await pool.execute('SELECT id FROM agenda_sessions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, message: 'Session introuvable.' });

  await pool.execute('DELETE FROM agenda_sessions WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Session supprimée.' });
};

// ── PUT /api/admin/sessions/:id/speakers ────────────────────
exports.setSpeakers = async (req, res) => {
  const { speakers = [] } = req.body;
  // speakers = [{speaker_id, role}, ...]

  const [[existing]] = await pool.execute('SELECT id FROM agenda_sessions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, message: 'Session introuvable.' });

  await pool.execute('DELETE FROM session_speakers WHERE session_id = ?', [req.params.id]);
  for (const sp of speakers) {
    if (!sp.speaker_id) continue;
    await pool.execute(
      'INSERT IGNORE INTO session_speakers (id, session_id, speaker_id, role) VALUES (?,?,?,?)',
      [uuidv4(), req.params.id, sp.speaker_id, sp.role || 'speaker']
    );
  }

  const [updated] = await pool.execute(
    `SELECT sp.id, sp.name, sp.photo, sp.job_title, sp.company, ss.role
     FROM session_speakers ss JOIN speakers sp ON ss.speaker_id = sp.id
     WHERE ss.session_id = ?`,
    [req.params.id]
  );
  return res.json({ success: true, message: 'Speakers mis à jour.', data: updated });
};

// ── GET /api/admin/sessions/:id/bookings ────────────────────
exports.listBookings = async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM session_bookings WHERE session_id = ? AND status = 'confirmed'`,
    [req.params.id]
  );
  const [rows] = await pool.execute(
    `SELECT b.id, b.status, b.created_at, u.id AS user_id, u.name AS user_name, u.email
     FROM session_bookings b JOIN users u ON b.user_id = u.id
     WHERE b.session_id = ? AND b.status = 'confirmed'
     ORDER BY b.created_at DESC
     LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
    [req.params.id]
  );

  return res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
};

// ═════════════════════════ PUBLIC (auth) ══════════════════════

// ── GET /api/agenda/:eventId ─────────────────────────────────
exports.getEventAgenda = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id, title, date FROM events WHERE id = ? AND status = "published"',
    [req.params.eventId]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const [sessions] = await pool.execute(
    `SELECT id, title, description, room, type, start_time, end_time,
            capacity, registered, access_conditions, order_index, is_visible
     FROM agenda_sessions
     WHERE event_id = ? AND is_visible = 1
     ORDER BY order_index ASC, start_time ASC`,
    [req.params.eventId]
  );

  const sessionIds = sessions.map(s => s.id);
  let speakersMap = {};
  if (sessionIds.length) {
    const ph = sessionIds.map(() => '?').join(',');
    const [spRows] = await pool.execute(
      `SELECT ss.session_id, ss.role, sp.id, sp.name, sp.photo, sp.job_title, sp.company, sp.bio, sp.social_links
       FROM session_speakers ss JOIN speakers sp ON ss.speaker_id = sp.id
       WHERE ss.session_id IN (${ph}) AND sp.is_active = 1`,
      sessionIds
    );
    spRows.forEach(r => {
      if (!speakersMap[r.session_id]) speakersMap[r.session_id] = [];
      speakersMap[r.session_id].push({
        id: r.id, name: r.name,
        photo: r.photo ? `${req.protocol}://${req.get('host')}/uploads/speakers/${r.photo}` : null,
        job_title: r.job_title, company: r.company, bio: r.bio,
        social_links: typeof r.social_links === 'string' ? JSON.parse(r.social_links) : (r.social_links || {}),
        role: r.role,
      });
    });
  }

  // Bookings de l'utilisateur connecté (si authentifié)
  let myBookings = new Set();
  if (req.user && sessionIds.length) {
    const ph = sessionIds.map(() => '?').join(',');
    const [bRows] = await pool.execute(
      `SELECT session_id FROM session_bookings WHERE user_id = ? AND session_id IN (${ph}) AND status = 'confirmed'`,
      [req.user.id, ...sessionIds]
    );
    bRows.forEach(r => myBookings.add(r.session_id));
  }

  const data = sessions.map(s => ({
    ...s,
    speakers: speakersMap[s.id] || [],
    booked: myBookings.has(s.id),
  }));

  return res.json({ success: true, data: { event, sessions: data } });
};

// ── POST /api/agenda/sessions/:id/book ───────────────────────
exports.bookSession = async (req, res) => {
  const [[session]] = await pool.execute(
    'SELECT id, title, capacity, registered FROM agenda_sessions WHERE id = ? AND is_visible = 1',
    [req.params.id]
  );
  if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

  // Vérifier capacité
  if (session.capacity !== null && session.registered >= session.capacity) {
    return res.status(409).json({ success: false, message: 'Cette session est complète.' });
  }

  // Vérifier si déjà réservé
  const [[existing]] = await pool.execute(
    'SELECT id, status FROM session_bookings WHERE session_id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );

  if (existing) {
    if (existing.status === 'confirmed')
      return res.status(409).json({ success: false, message: 'Vous avez déjà réservé cette session.' });
    // Réactiver une réservation annulée
    await pool.execute(
      'UPDATE session_bookings SET status = "confirmed" WHERE id = ?',
      [existing.id]
    );
  } else {
    await pool.execute(
      'INSERT INTO session_bookings (id, session_id, user_id, status) VALUES (?,?,?,?)',
      [uuidv4(), req.params.id, req.user.id, 'confirmed']
    );
  }

  await pool.execute(
    'UPDATE agenda_sessions SET registered = registered + 1 WHERE id = ?',
    [req.params.id]
  );

  return res.status(201).json({ success: true, message: `Participation confirmée : "${session.title}".` });
};

// ── DELETE /api/agenda/sessions/:id/book ─────────────────────
exports.cancelBooking = async (req, res) => {
  const [[booking]] = await pool.execute(
    'SELECT id FROM session_bookings WHERE session_id = ? AND user_id = ? AND status = "confirmed"',
    [req.params.id, req.user.id]
  );
  if (!booking) return res.status(404).json({ success: false, message: 'Aucune réservation active pour cette session.' });

  await pool.execute('UPDATE session_bookings SET status = "cancelled" WHERE id = ?', [booking.id]);
  await pool.execute(
    'UPDATE agenda_sessions SET registered = GREATEST(registered - 1, 0) WHERE id = ?',
    [req.params.id]
  );

  return res.json({ success: true, message: 'Réservation annulée.' });
};

// ── GET /api/speakers/:id ────────────────────────────────────
exports.getSpeakerProfile = async (req, res) => {
  const [[speaker]] = await pool.execute(
    'SELECT id, name, bio, photo, job_title, company, email, phone, social_links FROM speakers WHERE id = ? AND is_active = 1',
    [req.params.id]
  );
  if (!speaker) return res.status(404).json({ success: false, message: 'Speaker introuvable.' });

  const [sessions] = await pool.execute(
    `SELECT s.id, s.title, s.start_time, s.end_time, s.room, s.type, e.title AS event_title, e.id AS event_id, ss.role
     FROM session_speakers ss
     JOIN agenda_sessions s ON ss.session_id = s.id
     JOIN events e ON s.event_id = e.id
     WHERE ss.speaker_id = ? AND s.is_visible = 1 AND e.status = 'published'
     ORDER BY s.start_time ASC`,
    [req.params.id]
  );

  return res.json({
    success: true,
    data: {
      ...speaker,
      photo: speaker.photo ? `${req.protocol}://${req.get('host')}/uploads/speakers/${speaker.photo}` : null,
      social_links: typeof speaker.social_links === 'string' ? JSON.parse(speaker.social_links) : (speaker.social_links || {}),
      sessions,
    },
  });
};

// ── POST /api/speakers/:id/messages ──────────────────────────
exports.sendMessage = async (req, res) => {
  const { content, event_id } = req.body;
  if (!content?.trim()) return res.status(400).json({ success: false, message: 'Le message est requis.' });

  const [[speaker]] = await pool.execute('SELECT id FROM speakers WHERE id = ? AND is_active = 1', [req.params.id]);
  if (!speaker) return res.status(404).json({ success: false, message: 'Speaker introuvable.' });

  const id = uuidv4();
  await pool.execute(
    'INSERT INTO speaker_messages (id, speaker_id, user_id, event_id, content) VALUES (?,?,?,?,?)',
    [id, req.params.id, req.user.id, event_id || null, content.trim()]
  );

  return res.status(201).json({ success: true, message: 'Message envoyé.', data: { id } });
};

// ── GET /api/speakers/:id/messages ───────────────────────────
exports.getMessages = async (req, res) => {
  const [messages] = await pool.execute(
    `SELECT id, content, reply, replied_at, created_at
     FROM speaker_messages
     WHERE speaker_id = ? AND user_id = ?
     ORDER BY created_at ASC`,
    [req.params.id, req.user.id]
  );
  return res.json({ success: true, data: messages });
};
