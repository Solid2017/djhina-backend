const { pool } = require('../config/database');

// ── GET /api/organizer/dashboard ─────────────────────────────
exports.dashboard = async (req, res) => {
  const orgId = req.user.id;

  const [[{ totalEvents }]] = await pool.execute(
    'SELECT COUNT(*) AS totalEvents FROM events WHERE organizer_id = ?', [orgId]
  );
  const [[{ totalTickets }]] = await pool.execute(
    `SELECT COALESCE(SUM(tt.sold), 0) AS totalTickets
     FROM ticket_types tt JOIN events e ON tt.event_id = e.id
     WHERE e.organizer_id = ?`, [orgId]
  );
  const [[{ totalRevenue }]] = await pool.execute(
    `SELECT COALESCE(SUM(p.total), 0) AS totalRevenue
     FROM payments p JOIN events e ON p.event_id = e.id
     WHERE e.organizer_id = ? AND p.status = 'completed'`, [orgId]
  );
  const [[{ totalScans }]] = await pool.execute(
    `SELECT COUNT(*) AS totalScans FROM scan_logs sl
     JOIN events e ON sl.event_id = e.id
     WHERE e.organizer_id = ? AND sl.result = 'valid'`, [orgId]
  );

  const [myEvents] = await pool.execute(
    `SELECT e.id, e.title, e.date, e.status, e.capacity, e.registered,
       (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'active') AS active_tickets,
       (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'used')   AS used_tickets
     FROM events e
     WHERE e.organizer_id = ?
     ORDER BY e.date DESC LIMIT 10`, [orgId]
  );

  return res.json({
    success: true,
    data: {
      stats: { totalEvents, totalTickets, totalRevenue: parseFloat(totalRevenue), totalScans },
      recentEvents: myEvents,
    },
  });
};

// ── GET /api/organizer/events ─────────────────────────────────
exports.myEvents = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const orgId  = req.user.id;

  const where  = ['e.organizer_id = ?'];
  const params = [orgId];

  if (status) { where.push('e.status = ?'); params.push(status); }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM events e WHERE ${whereClause}`, params
  );

  const [events] = await pool.execute(
    `SELECT e.*,
       c.label AS category_label,
       (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) AS total_tickets,
       (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'used') AS used_tickets,
       (SELECT COALESCE(SUM(p.total),0) FROM payments p WHERE p.event_id = e.id AND p.status='completed') AS revenue
     FROM events e
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

// ── GET /api/organizer/events/:id/tickets ───────────────────
exports.eventTickets = async (req, res) => {
  const { page = 1, limit = 50, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Vérifier propriété
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const where  = ['t.event_id = ?'];
  const params = [req.params.id];

  if (status) { where.push('t.status = ?'); params.push(status); }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM tickets t WHERE ${whereClause}`, params
  );
  const [tickets] = await pool.execute(
    `SELECT t.ticket_number, t.holder_name, t.holder_email, t.holder_phone,
       t.status, t.price_paid, t.currency, t.created_at, t.used_at,
       tt.name AS ticket_type_name
     FROM tickets t
     JOIN ticket_types tt ON t.ticket_type_id = tt.id
     WHERE ${whereClause}
     ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return res.json({
    success: true,
    data: tickets,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

// ── GET /api/organizer/events/:id/stats ─────────────────────
exports.eventStats = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id, title, capacity, registered FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const [ticketTypes] = await pool.execute(
    'SELECT id, name, price, currency, available, sold, color FROM ticket_types WHERE event_id = ?',
    [req.params.id]
  );

  const [[{ revenue }]] = await pool.execute(
    `SELECT COALESCE(SUM(total), 0) AS revenue FROM payments
     WHERE event_id = ? AND status = 'completed'`, [req.params.id]
  );

  const [[{ active }]] = await pool.execute(
    "SELECT COUNT(*) AS active FROM tickets WHERE event_id = ? AND status = 'active'",
    [req.params.id]
  );
  const [[{ used }]] = await pool.execute(
    "SELECT COUNT(*) AS used FROM tickets WHERE event_id = ? AND status = 'used'",
    [req.params.id]
  );

  // Scans par heure (dernières 24h)
  const [scansByHour] = await pool.execute(
    `SELECT HOUR(created_at) AS hour, COUNT(*) AS count
     FROM scan_logs
     WHERE event_id = ? AND result = 'valid'
       AND created_at > NOW() - INTERVAL 24 HOUR
     GROUP BY HOUR(created_at)
     ORDER BY hour`, [req.params.id]
  );

  return res.json({
    success: true,
    data: {
      event,
      ticketTypes,
      revenue:   parseFloat(revenue),
      activeTickets: active,
      usedTickets:   used,
      scansByHour,
    },
  });
};

// ── GET /api/organizer/events/:id/scan-logs ─────────────────
exports.eventScanLogs = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const [logs] = await pool.execute(
    `SELECT sl.id, sl.result, sl.created_at, sl.ip_address,
       t.ticket_number, t.holder_name,
       u.name AS scanned_by
     FROM scan_logs sl
     LEFT JOIN tickets t ON sl.ticket_id = t.id
     LEFT JOIN users   u ON sl.scanned_by = u.id
     WHERE sl.event_id = ?
     ORDER BY sl.created_at DESC LIMIT 200`, [req.params.id]
  );

  return res.json({ success: true, data: logs });
};

// ── PUT /api/organizer/events/:id/ticket-types ──────────────
exports.updateTicketTypes = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

  const { ticket_types } = req.body;
  if (!Array.isArray(ticket_types)) {
    return res.status(400).json({ success: false, message: 'ticket_types doit être un tableau.' });
  }

  for (const tt of ticket_types) {
    if (tt.id) {
      // Mise à jour type existant
      await pool.execute(
        `UPDATE ticket_types SET name=?, price=?, available=?, color=?, is_active=?
         WHERE id=? AND event_id=?`,
        [tt.name, tt.price, tt.available, tt.color || '#0000FF', tt.is_active ? 1 : 0, tt.id, req.params.id]
      );
    } else {
      // Nouveau type
      const { v4: uuidv4 } = require('uuid');
      await pool.execute(
        `INSERT INTO ticket_types (id, event_id, name, price, currency, benefits, available, color)
         VALUES (?,?,?,?,?,?,?,?)`,
        [uuidv4(), req.params.id, tt.name, tt.price || 0, tt.currency || 'XAF',
         JSON.stringify(tt.benefits || []), tt.available || 0, tt.color || '#0000FF']
      );
    }
  }

  const [types] = await pool.execute(
    'SELECT * FROM ticket_types WHERE event_id = ? ORDER BY price ASC', [req.params.id]
  );
  return res.json({ success: true, data: types });
};

// ── GET /api/organizer/notifications ────────────────────────
exports.notifications = async (req, res) => {
  const [notifs] = await pool.execute(
    `SELECT n.* FROM notifications n
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC LIMIT 50`, [req.user.id]
  );
  return res.json({ success: true, data: notifs });
};

exports.markNotifRead = async (req, res) => {
  await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  return res.json({ success: true });
};
