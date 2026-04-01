const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

// ── GET /api/admin/stats ─────────────────────────────────────
exports.stats = async (req, res) => {
  const [[users]]   = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE role = "user"');
  const [[orgs]]    = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE role = "organizer"');
  const [[events]]  = await pool.execute('SELECT COUNT(*) AS total FROM events');
  const [[tickets]] = await pool.execute('SELECT COUNT(*) AS total FROM tickets');
  const [[revenue]] = await pool.execute('SELECT COALESCE(SUM(total),0) AS total FROM payments WHERE status = "completed"');
  const [[scans]]   = await pool.execute('SELECT COUNT(*) AS total FROM scan_logs WHERE result = "valid"');

  const [recentEvents] = await pool.execute(
    `SELECT e.id, e.title, e.date, e.status, e.registered,
       u.name AS organizer_name
     FROM events e JOIN users u ON e.organizer_id = u.id
     ORDER BY e.created_at DESC LIMIT 5`
  );

  const [recentPayments] = await pool.execute(
    `SELECT p.id, p.total, p.currency, p.created_at,
       u.name AS user_name, e.title AS event_title
     FROM payments p
     JOIN users  u ON p.user_id  = u.id
     JOIN events e ON p.event_id = e.id
     WHERE p.status = 'completed'
     ORDER BY p.created_at DESC LIMIT 5`
  );

  return res.json({
    success: true,
    data: {
      users:    users.total,
      organizers: orgs.total,
      events:   events.total,
      tickets:  tickets.total,
      revenue:  parseFloat(revenue.total),
      validScans: scans.total,
      recentEvents,
      recentPayments,
    },
  });
};

// ── GET /api/admin/users ─────────────────────────────────────
exports.listUsers = async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = ['1=1'];
  const params = [];

  if (role)   { where.push('role = ?');                                 params.push(role); }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM users WHERE ${whereClause}`, params
  );
  const [users] = await pool.execute(
    `SELECT id, name, email, phone, role, avatar, country, city, is_active, is_verified, last_login, created_at
     FROM users WHERE ${whereClause}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: users,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── GET /api/admin/users/:id ─────────────────────────────────
exports.getUser = async (req, res) => {
  const [[user]] = await pool.execute(
    'SELECT id, name, email, phone, role, avatar, country, city, bio, is_active, is_verified, last_login, created_at FROM users WHERE id = ?',
    [req.params.id]
  );
  if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

  const [[{ events }]]  = await pool.execute('SELECT COUNT(*) AS events  FROM events  WHERE organizer_id = ?', [req.params.id]);
  const [[{ tickets }]] = await pool.execute('SELECT COUNT(*) AS tickets FROM tickets WHERE user_id = ?',      [req.params.id]);

  return res.json({ success: true, data: { ...user, stats: { events, tickets } } });
};

// ── PUT /api/admin/users/:id ─────────────────────────────────
exports.updateUser = async (req, res) => {
  const { name, email, role, is_active, is_verified, phone, country } = req.body;
  const allowed = { name, email, role, is_active, is_verified, phone, country };

  const fields = [];
  const values = [];

  Object.entries(allowed).forEach(([key, val]) => {
    if (val !== undefined) { fields.push(`${key} = ?`); values.push(val); }
  });

  if (!fields.length) return res.status(400).json({ success: false, message: 'Aucune modification fournie.' });

  values.push(req.params.id);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

  return res.json({ success: true, message: 'Utilisateur mis à jour.' });
};

// ── DELETE /api/admin/users/:id ──────────────────────────────
exports.deleteUser = async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  await pool.execute('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Compte désactivé.' });
};

// ── POST /api/admin/users ────────────────────────────────────
exports.createUser = async (req, res) => {
  const { name, email, phone, password, role = 'user', country } = req.body;

  const [exists] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) return res.status(409).json({ success: false, message: 'Email déjà utilisé.' });

  const hash = await bcrypt.hash(password, 12);
  const id   = uuidv4();

  await pool.execute(
    'INSERT INTO users (id, name, email, phone, password, role, country, is_verified) VALUES (?,?,?,?,?,?,?,1)',
    [id, name, email, phone || null, hash, role, country || 'Tchad']
  );

  return res.status(201).json({ success: true, message: 'Utilisateur créé.', data: { id } });
};

// ── GET /api/admin/events ────────────────────────────────────
exports.listEvents = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = ['1=1'];
  const params = [];

  if (status) { where.push('e.status = ?'); params.push(status); }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM events e WHERE ${whereClause}`, params
  );
  const [events] = await pool.execute(
    `SELECT e.id, e.title, e.date, e.status, e.capacity, e.registered, e.is_featured, e.created_at,
       u.name AS organizer_name, u.email AS organizer_email,
       c.label AS category
     FROM events e
     JOIN users u ON e.organizer_id = u.id
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE ${whereClause}
     ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: events,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── PUT /api/admin/events/:id/status ────────────────────────
exports.setEventStatus = async (req, res) => {
  const { status } = req.body;
  const valid = ['draft', 'published', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ success: false, message: 'Statut invalide.' });
  }

  const [rows] = await pool.execute('SELECT id FROM events WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  await pool.execute('UPDATE events SET status = ? WHERE id = ?', [status, req.params.id]);
  return res.json({ success: true, message: `Statut mis à jour : ${status}.` });
};

// ── PUT /api/admin/events/:id/feature ───────────────────────
exports.featureEvent = async (req, res) => {
  const [rows] = await pool.execute('SELECT id, is_featured FROM events WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const newVal = rows[0].is_featured ? 0 : 1;
  await pool.execute('UPDATE events SET is_featured = ? WHERE id = ?', [newVal, req.params.id]);

  return res.json({ success: true, data: { is_featured: !!newVal } });
};

// ── GET /api/admin/payments ──────────────────────────────────
exports.listPayments = async (req, res) => {
  const { page = 1, limit = 20, status, user_id, event_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = ['1=1'];
  const params = [];
  if (status)   { where.push('p.status = ?');   params.push(status); }
  if (user_id)  { where.push('p.user_id = ?');  params.push(user_id); }
  if (event_id) { where.push('p.event_id = ?'); params.push(event_id); }

  const wc = where.join(' AND ');
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM payments p WHERE ${wc}`, params);
  const [payments] = await pool.execute(
    `SELECT p.*, u.name AS user_name, e.title AS event_title,
       tt.name AS ticket_type_name
     FROM payments p
     JOIN users       u  ON p.user_id       = u.id
     JOIN events      e  ON p.event_id      = e.id
     LEFT JOIN ticket_types tt ON p.ticket_type_id = tt.id
     WHERE ${wc}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: payments,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── GET /api/admin/payments/:id ──────────────────────────────
exports.getPayment = async (req, res) => {
  const [[payment]] = await pool.execute(
    `SELECT p.*, u.name AS user_name, u.email AS user_email,
       e.title AS event_title, tt.name AS ticket_type_name
     FROM payments p
     JOIN users       u  ON p.user_id       = u.id
     JOIN events      e  ON p.event_id      = e.id
     LEFT JOIN ticket_types tt ON p.ticket_type_id = tt.id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (!payment) return res.status(404).json({ success: false, message: 'Paiement introuvable.' });

  // tickets associés
  const [tickets] = await pool.execute(
    'SELECT ticket_number, status, holder_name FROM tickets WHERE payment_id = ?',
    [req.params.id]
  );

  return res.json({ success: true, data: { ...payment, tickets } });
};

// ── PUT /api/admin/payments/:id/status ───────────────────────
exports.updatePaymentStatus = async (req, res) => {
  const { status, reason } = req.body;
  const valid = ['pending', 'completed', 'failed', 'refunded'];
  if (!valid.includes(status)) {
    return res.status(400).json({ success: false, message: `Statut invalide. Valeurs acceptées : ${valid.join(', ')}` });
  }

  const [[payment]] = await pool.execute('SELECT id, status, event_id FROM payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ success: false, message: 'Paiement introuvable.' });

  await pool.execute(
    'UPDATE payments SET status = ?, refund_reason = ? WHERE id = ?',
    [status, reason || null, req.params.id]
  );

  // Si remboursé → annuler les tickets associés
  if (status === 'refunded') {
    await pool.execute(
      "UPDATE tickets SET status = 'cancelled' WHERE payment_id = ?",
      [req.params.id]
    );
    // MAJ compteur
    const [[{ qty }]] = await pool.execute('SELECT quantity FROM payments WHERE id = ?', [req.params.id]);
    if (qty) {
      const [[pay]] = await pool.execute('SELECT ticket_type_id, quantity FROM payments WHERE id = ?', [req.params.id]);
      if (pay) {
        await pool.execute('UPDATE ticket_types SET sold = GREATEST(0, sold - ?) WHERE id = ?', [pay.quantity, pay.ticket_type_id]);
        await pool.execute('UPDATE events SET registered = GREATEST(0, registered - ?) WHERE id = ?', [pay.quantity, payment.event_id]);
      }
    }
  }

  return res.json({ success: true, message: `Statut mis à jour : ${status}.` });
};

// ── GET /api/admin/tickets ───────────────────────────────────
exports.listTickets = async (req, res) => {
  const { page = 1, limit = 20, status, event_id, user_id, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = ['1=1'];
  const params = [];
  if (status)   { where.push('t.status = ?');          params.push(status); }
  if (event_id) { where.push('t.event_id = ?');        params.push(event_id); }
  if (user_id)  { where.push('t.user_id = ?');         params.push(user_id); }
  if (search)   { where.push('(t.ticket_number LIKE ? OR t.holder_name LIKE ? OR t.holder_email LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const wc = where.join(' AND ');
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM tickets t WHERE ${wc}`, params);
  const [tickets] = await pool.execute(
    `SELECT t.ticket_number, t.holder_name, t.holder_email, t.holder_phone,
       t.status, t.price_paid, t.currency, t.created_at, t.used_at,
       e.title AS event_title, e.date AS event_date,
       tt.name AS ticket_type_name,
       u.name AS buyer_name
     FROM tickets t
     JOIN events       e  ON t.event_id      = e.id
     JOIN ticket_types tt ON t.ticket_type_id = tt.id
     JOIN users        u  ON t.user_id        = u.id
     WHERE ${wc}
     ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: tickets,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── GET /api/admin/tickets/:number ───────────────────────────
exports.getTicket = async (req, res) => {
  const [[ticket]] = await pool.execute(
    `SELECT t.*,
       e.title AS event_title, e.date AS event_date, e.location AS event_location,
       tt.name AS ticket_type_name, tt.price AS ticket_type_price,
       u.name AS buyer_name, u.email AS buyer_email,
       p.transaction_id, p.provider, p.phone AS payment_phone, p.status AS payment_status
     FROM tickets t
     JOIN events       e  ON t.event_id      = e.id
     JOIN ticket_types tt ON t.ticket_type_id = tt.id
     JOIN users        u  ON t.user_id        = u.id
     LEFT JOIN payments p ON t.payment_id     = p.id
     WHERE t.ticket_number = ?`,
    [req.params.number]
  );
  if (!ticket) return res.status(404).json({ success: false, message: 'Billet introuvable.' });
  return res.json({ success: true, data: ticket });
};

// ── PUT /api/admin/tickets/:number/cancel ────────────────────
exports.cancelTicket = async (req, res) => {
  const { reason } = req.body;
  const [[ticket]] = await pool.execute(
    'SELECT id, status, event_id, ticket_type_id FROM tickets WHERE ticket_number = ?',
    [req.params.number]
  );
  if (!ticket) return res.status(404).json({ success: false, message: 'Billet introuvable.' });
  if (ticket.status === 'cancelled') {
    return res.status(409).json({ success: false, message: 'Ce billet est déjà annulé.' });
  }

  await pool.execute(
    "UPDATE tickets SET status = 'cancelled', cancel_reason = ? WHERE id = ?",
    [reason || null, ticket.id]
  );
  await pool.execute('UPDATE ticket_types SET sold = GREATEST(0, sold - 1) WHERE id = ?', [ticket.ticket_type_id]);
  await pool.execute('UPDATE events SET registered = GREATEST(0, registered - 1) WHERE id = ?', [ticket.event_id]);

  return res.json({ success: true, message: 'Billet annulé.' });
};

// ── GET /api/admin/scan-logs ─────────────────────────────────
exports.scanLogs = async (req, res) => {
  const { event_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = ['1=1'];
  const params = [];

  if (event_id) { where.push('sl.event_id = ?'); params.push(event_id); }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM scan_logs sl WHERE ${whereClause}`, params
  );
  const [logs] = await pool.execute(
    `SELECT sl.*, t.ticket_number, u.name AS scanned_by_name,
       e.title AS event_title
     FROM scan_logs sl
     LEFT JOIN tickets t ON sl.ticket_id = t.id
     LEFT JOIN users   u ON sl.scanned_by = u.id
     LEFT JOIN events  e ON sl.event_id   = e.id
     WHERE ${whereClause}
     ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: logs,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── GET /api/admin/categories ────────────────────────────────
exports.listCategories = async (req, res) => {
  const [cats] = await pool.execute('SELECT * FROM categories ORDER BY label ASC');
  return res.json({ success: true, data: cats });
};

exports.createCategory = async (req, res) => {
  const { label, slug, icon, color } = req.body;
  const id = uuidv4();
  await pool.execute(
    'INSERT INTO categories (id, slug, label, icon, color) VALUES (?,?,?,?,?)',
    [id, slug, label, icon || null, color || '#0000FF']
  );
  return res.status(201).json({ success: true, data: { id } });
};

exports.updateCategory = async (req, res) => {
  const { label, slug, icon, color } = req.body;
  await pool.execute(
    'UPDATE categories SET label=?, slug=?, icon=?, color=? WHERE id=?',
    [label, slug, icon || null, color || '#0000FF', req.params.id]
  );
  return res.json({ success: true, message: 'Catégorie mise à jour.' });
};

exports.deleteCategory = async (req, res) => {
  await pool.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Catégorie supprimée.' });
};
