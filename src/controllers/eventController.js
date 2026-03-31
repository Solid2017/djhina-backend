const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// ── GET /api/events ──────────────────────────────────────────
exports.list = async (req, res) => {
  const {
    category, city, search, featured,
    page = 1, limit = 20,
    sort = 'date', order = 'ASC',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const where  = ['e.status = "published"'];
  const params = [];

  if (category) { where.push('c.slug = ?');           params.push(category); }
  if (city)     { where.push('e.city LIKE ?');         params.push(`%${city}%`); }
  if (featured) { where.push('e.is_featured = 1'); }
  if (search) {
    where.push('(e.title LIKE ? OR e.location LIKE ? OR e.city LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const validSorts  = { date: 'e.date', created: 'e.created_at', popular: 'likes_count' };
  const sortField   = validSorts[sort] || 'e.date';
  const sortDir     = order === 'DESC' ? 'DESC' : 'ASC';
  const whereClause = where.join(' AND ');

  const countSql = `
    SELECT COUNT(*) AS total
    FROM events e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE ${whereClause}`;

  const dataSql = `
    SELECT
      e.id, e.title, e.subtitle, e.date, e.time, e.end_time,
      e.location, e.city, e.country, e.cover_image,
      e.capacity, e.registered, e.is_featured, e.tags, e.status,
      e.organizer_id,
      u.name  AS organizer_name,
      u.avatar AS organizer_avatar,
      u.is_verified AS organizer_verified,
      c.slug AS category, c.label AS category_label, c.color AS category_color,
      (SELECT COUNT(*) FROM event_likes  WHERE event_id = e.id) AS likes_count,
      (SELECT COUNT(*) FROM comments     WHERE event_id = e.id AND is_hidden = 0) AS comments_count,
      (SELECT MIN(price) FROM ticket_types WHERE event_id = e.id AND is_active = 1) AS min_price,
      (SELECT MAX(price) FROM ticket_types WHERE event_id = e.id AND is_active = 1) AS max_price
    FROM events e
    JOIN users u ON e.organizer_id = u.id
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE ${whereClause}
    ORDER BY ${sortField} ${sortDir}
    LIMIT ? OFFSET ?`;

  const [[{ total }]] = await pool.execute(countSql, [...params]);
  const [events]      = await pool.execute(dataSql, [...params, parseInt(limit), offset]);

  // Si utilisateur connecté, ajouter ses interactions
  if (req.user) {
    const ids = events.map(e => e.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const [likes] = await pool.execute(
        `SELECT event_id FROM event_likes WHERE user_id = ? AND event_id IN (${placeholders})`,
        [req.user.id, ...ids]
      );
      const [saves] = await pool.execute(
        `SELECT event_id FROM event_saves WHERE user_id = ? AND event_id IN (${placeholders})`,
        [req.user.id, ...ids]
      );
      const likedSet = new Set(likes.map(l => l.event_id));
      const savedSet = new Set(saves.map(s => s.event_id));
      events.forEach(e => {
        e.is_liked = likedSet.has(e.id);
        e.is_saved = savedSet.has(e.id);
      });
    }
  }

  return res.json({
    success: true,
    data: events,
    meta: {
      total, page: parseInt(page), limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
};

// ── GET /api/events/:id ──────────────────────────────────────
exports.getOne = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT e.*,
       u.name AS organizer_name, u.avatar AS organizer_avatar, u.is_verified AS organizer_verified,
       c.slug AS category, c.label AS category_label, c.color AS category_color,
       (SELECT COUNT(*) FROM event_likes WHERE event_id = e.id) AS likes_count,
       (SELECT COUNT(*) FROM comments    WHERE event_id = e.id AND is_hidden = 0) AS comments_count
     FROM events e
     JOIN users u ON e.organizer_id = u.id
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.id = ? AND (e.status = 'published' OR e.organizer_id = ?)`,
    [req.params.id, req.user?.id || '']
  );

  if (!rows.length) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const event = rows[0];
  const [ticketTypes] = await pool.execute(
    'SELECT * FROM ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY price ASC',
    [event.id]
  );

  if (req.user) {
    const [[like]] = await pool.execute(
      'SELECT 1 FROM event_likes WHERE user_id = ? AND event_id = ?',
      [req.user.id, event.id]
    );
    const [[save]] = await pool.execute(
      'SELECT 1 FROM event_saves WHERE user_id = ? AND event_id = ?',
      [req.user.id, event.id]
    );
    event.is_liked = !!like;
    event.is_saved = !!save;
  }

  event.tickets = ticketTypes.map(t => ({
    ...t,
    sold_out: t.sold >= t.available,
  }));

  return res.json({ success: true, data: event });
};

// ── POST /api/events ─────────────────────────────────────────
exports.create = async (req, res) => {
  const {
    title, subtitle, description, category_id,
    date, time, end_time, location, city, country,
    capacity, is_featured, tags, images,
    ticket_types,
  } = req.body;

  const cover_image = req.file ? `/uploads/events/${req.file.filename}` : req.body.cover_image;
  const id = uuidv4();

  await pool.execute(
    `INSERT INTO events
      (id, organizer_id, category_id, title, subtitle, description,
       cover_image, date, time, end_time, location, city, country,
       capacity, is_featured, tags, images, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, req.user.id, category_id || null,
      title, subtitle || null, description || null,
      cover_image || null, date, time, end_time || null,
      location, city || 'N\'Djaména', country || 'Tchad',
      capacity || 0, is_featured ? 1 : 0,
      JSON.stringify(tags || []),
      JSON.stringify(images || []),
      'draft',
    ]
  );

  // Types de billets
  if (ticket_types && Array.isArray(ticket_types)) {
    for (const tt of ticket_types) {
      await pool.execute(
        `INSERT INTO ticket_types (id, event_id, name, price, currency, benefits, available, color)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          uuidv4(), id, tt.name, tt.price || 0, tt.currency || 'XAF',
          JSON.stringify(tt.benefits || []), tt.available || 0, tt.color || '#0000FF',
        ]
      );
    }
  }

  return res.status(201).json({
    success: true, message: 'Événement créé (brouillon).', data: { id },
  });
};

// ── PUT /api/events/:id ──────────────────────────────────────
exports.update = async (req, res) => {
  const allowed = [
    'title', 'subtitle', 'description', 'category_id',
    'date', 'time', 'end_time', 'location', 'city', 'country',
    'capacity', 'is_featured', 'tags', 'images',
  ];

  const fields = [];
  const values = [];

  allowed.forEach(key => {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      const val = ['tags', 'images'].includes(key) ? JSON.stringify(req.body[key]) : req.body[key];
      values.push(val);
    }
  });

  if (req.file) {
    fields.push('cover_image = ?');
    values.push(`/uploads/events/${req.file.filename}`);
  }

  if (!fields.length) {
    return res.status(400).json({ success: false, message: 'Aucune modification fournie.' });
  }

  values.push(req.params.id);
  await pool.execute(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, values);

  return res.json({ success: true, message: 'Événement mis à jour.' });
};

// ── PUT /api/events/:id/publish ──────────────────────────────
exports.publish = async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, organizer_id, status FROM events WHERE id = ?',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const event = rows[0];
  if (req.user.role !== 'admin' && event.organizer_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Accès refusé.' });
  }

  const newStatus = event.status === 'published' ? 'draft' : 'published';
  await pool.execute('UPDATE events SET status = ? WHERE id = ?', [newStatus, event.id]);

  return res.json({
    success: true,
    message: newStatus === 'published' ? 'Événement publié.' : 'Événement dépublié.',
    data: { status: newStatus },
  });
};

// ── DELETE /api/events/:id ───────────────────────────────────
exports.remove = async (req, res) => {
  await pool.execute('UPDATE events SET status = "cancelled" WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Événement annulé.' });
};

// ── POST /api/events/:id/like ────────────────────────────────
exports.like = async (req, res) => {
  const { id: eventId } = req.params;
  const { id: userId } = req.user;

  const [[existing]] = await pool.execute(
    'SELECT 1 FROM event_likes WHERE user_id = ? AND event_id = ?',
    [userId, eventId]
  );

  if (existing) {
    await pool.execute('DELETE FROM event_likes WHERE user_id = ? AND event_id = ?', [userId, eventId]);
    return res.json({ success: true, liked: false });
  }

  await pool.execute('INSERT INTO event_likes (user_id, event_id) VALUES (?,?)', [userId, eventId]);
  return res.json({ success: true, liked: true });
};

// ── POST /api/events/:id/save ────────────────────────────────
exports.save = async (req, res) => {
  const { id: eventId } = req.params;
  const { id: userId }  = req.user;

  const [[existing]] = await pool.execute(
    'SELECT 1 FROM event_saves WHERE user_id = ? AND event_id = ?',
    [userId, eventId]
  );

  if (existing) {
    await pool.execute('DELETE FROM event_saves WHERE user_id = ? AND event_id = ?', [userId, eventId]);
    return res.json({ success: true, saved: false });
  }

  await pool.execute('INSERT INTO event_saves (user_id, event_id) VALUES (?,?)', [userId, eventId]);
  return res.json({ success: true, saved: true });
};

// ── GET/POST /api/events/:id/comments ───────────────────────
exports.getComments = async (req, res) => {
  const [comments] = await pool.execute(
    `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar
     FROM comments c JOIN users u ON c.user_id = u.id
     WHERE c.event_id = ? AND c.is_hidden = 0 AND c.parent_id IS NULL
     ORDER BY c.created_at DESC LIMIT 50`,
    [req.params.id]
  );
  return res.json({ success: true, data: comments });
};

exports.addComment = async (req, res) => {
  const { content, parent_id } = req.body;
  const id = uuidv4();

  await pool.execute(
    'INSERT INTO comments (id, event_id, user_id, parent_id, content) VALUES (?,?,?,?,?)',
    [id, req.params.id, req.user.id, parent_id || null, content]
  );

  const [[comment]] = await pool.execute(
    `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar
     FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
    [id]
  );
  return res.status(201).json({ success: true, data: comment });
};
