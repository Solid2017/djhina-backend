const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// ════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════
//  GESTION DES EVENEMENTS
// ════════════════════════════════════════════════════════════════

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

exports.getEvent = async (req, res) => {
  const [[event]] = await pool.execute(
    `SELECT e.*, c.label AS category_label,
       (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) AS total_tickets,
       (SELECT COALESCE(SUM(p.total),0) FROM payments p WHERE p.event_id = e.id AND p.status='completed') AS revenue
     FROM events e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.id = ? AND e.organizer_id = ?`,
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });
  return res.json({ success: true, data: event });
};

exports.createEvent = async (req, res) => {
  const { title, subtitle, description, category_id, date, time, end_time, location, city, country, capacity, tags } = req.body;

  if (!title || !date || !location) {
    return res.status(400).json({ success: false, message: 'Titre, date et lieu sont requis.' });
  }

  const cover_image = req.file ? `/admin/media/events/${req.file.filename}` : (req.body.cover_image || null);
  const id = uuidv4();

  let eventDate = date, eventTime = time || null;
  if (date && date.includes('T')) { [eventDate, eventTime] = date.split('T'); }
  let eventEndTime = end_time || null;
  if (eventEndTime && eventEndTime.includes('T')) { eventEndTime = eventEndTime.split('T')[1]; }

  await pool.execute(
    `INSERT INTO events
      (id, organizer_id, category_id, title, subtitle, description,
       cover_image, date, time, end_time, location, city, country, capacity, tags, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, req.user.id, category_id || null, title, subtitle || null, description || null,
     cover_image, eventDate, eventTime, eventEndTime, location,
     city || "N'Djamena", country || 'Tchad', capacity || 0, JSON.stringify(tags || []), 'draft']
  );

  return res.status(201).json({ success: true, message: 'Evenement cree en brouillon.', data: { id } });
};

exports.updateEvent = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const body = { ...req.body };
  if (body.date && body.date.includes('T')) {
    const [d, t] = body.date.split('T');
    body.date = d;
    if (!body.time) body.time = t;
  }
  if (body.end_time && body.end_time.includes('T')) { body.end_time = body.end_time.split('T')[1]; }

  const allowed = ['title', 'subtitle', 'description', 'category_id', 'date', 'time', 'end_time', 'location', 'city', 'country', 'capacity', 'tags'];
  const fields = [];
  const values = [];

  allowed.forEach(key => {
    if (body[key] !== undefined && body[key] !== '') {
      fields.push(`${key} = ?`);
      values.push(key === 'tags' ? JSON.stringify(body[key]) : body[key]);
    }
  });

  if (req.file) { fields.push('cover_image = ?'); values.push(`/admin/media/events/${req.file.filename}`); }
  if (!fields.length) return res.status(400).json({ success: false, message: 'Aucune modification fournie.' });

  values.push(req.params.id, req.user.id);
  await pool.execute(`UPDATE events SET ${fields.join(', ')} WHERE id = ? AND organizer_id = ?`, values);
  return res.json({ success: true, message: 'Evenement mis a jour.' });
};

exports.deleteEvent = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id, status FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });
  if (event.status === 'published') {
    return res.status(400).json({ success: false, message: 'Annulez l\'evenement avant de le supprimer.' });
  }
  await pool.execute('UPDATE events SET status = "cancelled" WHERE id = ? AND organizer_id = ?', [req.params.id, req.user.id]);
  return res.json({ success: true, message: 'Evenement annule.' });
};

exports.submitEvent = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id, status FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });
  if (event.status !== 'draft') {
    return res.status(400).json({ success: false, message: 'Seul un brouillon peut etre soumis.' });
  }
  await pool.execute('UPDATE events SET status = "pending_review" WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Evenement soumis pour validation par l\'administrateur.' });
};

exports.setEventStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = ['draft', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Statut non autorise. La publication est reservee a l\'administrateur.' });
  }
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });
  await pool.execute('UPDATE events SET status = ? WHERE id = ?', [status, req.params.id]);
  return res.json({ success: true, message: `Evenement passe en "${status}".` });
};

// ════════════════════════════════════════════════════════════════
//  BILLETS & STATISTIQUES
// ════════════════════════════════════════════════════════════════

exports.eventTickets = async (req, res) => {
  const { page = 1, limit = 50, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

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

exports.eventStats = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id, title, capacity, registered FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const [ticketTypes] = await pool.execute(
    'SELECT id, name, price, currency, available, sold, color FROM ticket_types WHERE event_id = ?',
    [req.params.id]
  );
  const [[{ revenue }]] = await pool.execute(
    `SELECT COALESCE(SUM(total), 0) AS revenue FROM payments WHERE event_id = ? AND status = 'completed'`,
    [req.params.id]
  );
  const [[{ active }]] = await pool.execute(
    "SELECT COUNT(*) AS active FROM tickets WHERE event_id = ? AND status = 'active'", [req.params.id]
  );
  const [[{ used }]] = await pool.execute(
    "SELECT COUNT(*) AS used FROM tickets WHERE event_id = ? AND status = 'used'", [req.params.id]
  );
  const [scansByHour] = await pool.execute(
    `SELECT HOUR(created_at) AS hour, COUNT(*) AS count
     FROM scan_logs WHERE event_id = ? AND result = 'valid' AND created_at > NOW() - INTERVAL 24 HOUR
     GROUP BY HOUR(created_at) ORDER BY hour`, [req.params.id]
  );

  return res.json({
    success: true,
    data: { event, ticketTypes, revenue: parseFloat(revenue), activeTickets: active, usedTickets: used, scansByHour },
  });
};

exports.eventScanLogs = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const [logs] = await pool.execute(
    `SELECT sl.id, sl.result, sl.created_at, sl.ip_address,
       t.ticket_number, t.holder_name,
       u.name AS scanned_by
     FROM scan_logs sl
     LEFT JOIN tickets t ON sl.ticket_id = t.id
     LEFT JOIN users   u ON sl.scanned_by = u.id
     WHERE sl.event_id = ? ORDER BY sl.created_at DESC LIMIT 200`, [req.params.id]
  );
  return res.json({ success: true, data: logs });
};

exports.updateTicketTypes = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const { ticket_types } = req.body;
  if (!Array.isArray(ticket_types)) {
    return res.status(400).json({ success: false, message: 'ticket_types doit etre un tableau.' });
  }

  for (const tt of ticket_types) {
    if (tt.id) {
      await pool.execute(
        'UPDATE ticket_types SET name=?, price=?, available=?, color=?, is_active=? WHERE id=? AND event_id=?',
        [tt.name, tt.price, tt.available, tt.color || '#0000FF', tt.is_active ? 1 : 0, tt.id, req.params.id]
      );
    } else {
      await pool.execute(
        'INSERT INTO ticket_types (id, event_id, name, price, currency, benefits, available, color) VALUES (?,?,?,?,?,?,?,?)',
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

// ════════════════════════════════════════════════════════════════
//  GESTION DES SPEAKERS
// ════════════════════════════════════════════════════════════════

exports.listEventSpeakers = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const [speakers] = await pool.execute(
    `SELECT s.* FROM speakers s
     JOIN session_speakers ss ON ss.speaker_id = s.id
     JOIN sessions ses ON ses.id = ss.session_id
     WHERE ses.event_id = ? GROUP BY s.id`, [req.params.id]
  );
  return res.json({ success: true, data: speakers });
};

exports.listSpeakers = async (req, res) => {
  const [speakers] = await pool.execute(
    `SELECT DISTINCT s.* FROM speakers s
     JOIN session_speakers ss ON ss.speaker_id = s.id
     JOIN sessions ses ON ses.id = ss.session_id
     JOIN events e ON e.id = ses.event_id
     WHERE e.organizer_id = ? ORDER BY s.name ASC`, [req.user.id]
  );
  return res.json({ success: true, data: speakers });
};

exports.createSpeaker = async (req, res) => {
  const { name, title, company, bio, linkedin, twitter, event_id } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Le nom du speaker est requis.' });

  if (event_id) {
    const [[event]] = await pool.execute(
      'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
      [event_id, req.user.id]
    );
    if (!event) return res.status(403).json({ success: false, message: 'Evenement non autorise.' });
  }

  const photo = req.file ? `/admin/media/speakers/${req.file.filename}` : (req.body.photo || null);
  const id = uuidv4();

  await pool.execute(
    'INSERT INTO speakers (id, name, title, company, bio, photo, linkedin, twitter) VALUES (?,?,?,?,?,?,?,?)',
    [id, name, title || null, company || null, bio || null, photo, linkedin || null, twitter || null]
  );

  return res.status(201).json({ success: true, message: 'Speaker cree.', data: { id } });
};

exports.updateSpeaker = async (req, res) => {
  const [[linked]] = await pool.execute(
    `SELECT s.id FROM speakers s
     JOIN session_speakers ss ON ss.speaker_id = s.id
     JOIN sessions ses ON ses.id = ss.session_id
     JOIN events e ON e.id = ses.event_id
     WHERE s.id = ? AND e.organizer_id = ? LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (!linked) return res.status(403).json({ success: false, message: 'Speaker non autorise.' });

  const { name, title, company, bio, linkedin, twitter } = req.body;
  const fields = [];
  const values = [];
  if (name)     { fields.push('name = ?');     values.push(name); }
  if (title)    { fields.push('title = ?');    values.push(title); }
  if (company)  { fields.push('company = ?');  values.push(company); }
  if (bio)      { fields.push('bio = ?');      values.push(bio); }
  if (linkedin) { fields.push('linkedin = ?'); values.push(linkedin); }
  if (twitter)  { fields.push('twitter = ?');  values.push(twitter); }
  if (req.file) { fields.push('photo = ?');    values.push(`/admin/media/speakers/${req.file.filename}`); }

  if (!fields.length) return res.status(400).json({ success: false, message: 'Aucune modification.' });

  values.push(req.params.id);
  await pool.execute(`UPDATE speakers SET ${fields.join(', ')} WHERE id = ?`, values);
  return res.json({ success: true, message: 'Speaker mis a jour.' });
};

exports.deleteSpeaker = async (req, res) => {
  const [[linked]] = await pool.execute(
    `SELECT s.id FROM speakers s
     JOIN session_speakers ss ON ss.speaker_id = s.id
     JOIN sessions ses ON ses.id = ss.session_id
     JOIN events e ON e.id = ses.event_id
     WHERE s.id = ? AND e.organizer_id = ? LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (!linked) return res.status(403).json({ success: false, message: 'Speaker non autorise.' });

  await pool.execute('DELETE FROM session_speakers WHERE speaker_id = ?', [req.params.id]);
  await pool.execute('DELETE FROM speakers WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Speaker supprime.' });
};

// ════════════════════════════════════════════════════════════════
//  GESTION DE L'AGENDA / SESSIONS
// ════════════════════════════════════════════════════════════════

exports.listSessions = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const [sessions] = await pool.execute(
    `SELECT s.*, sec.name AS section_name,
       GROUP_CONCAT(sp.name SEPARATOR ', ') AS speakers
     FROM sessions s
     LEFT JOIN agenda_sections sec ON sec.id = s.section_id
     LEFT JOIN session_speakers ss ON ss.session_id = s.id
     LEFT JOIN speakers sp ON sp.id = ss.speaker_id
     WHERE s.event_id = ?
     GROUP BY s.id ORDER BY s.start_time ASC`, [req.params.id]
  );
  return res.json({ success: true, data: sessions });
};

exports.createSession = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const { title, description, start_time, end_time, location, type, section_id, speaker_ids } = req.body;
  if (!title || !start_time) {
    return res.status(400).json({ success: false, message: 'Titre et heure de debut requis.' });
  }

  const id = uuidv4();
  await pool.execute(
    'INSERT INTO sessions (id, event_id, section_id, title, description, start_time, end_time, location, type) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, req.params.id, section_id || null, title, description || null, start_time, end_time || null, location || null, type || 'talk']
  );

  if (Array.isArray(speaker_ids) && speaker_ids.length) {
    for (const spId of speaker_ids) {
      await pool.execute('INSERT IGNORE INTO session_speakers (session_id, speaker_id) VALUES (?,?)', [id, spId]);
    }
  }

  return res.status(201).json({ success: true, message: 'Session creee.', data: { id } });
};

exports.updateSession = async (req, res) => {
  const [[session]] = await pool.execute(
    `SELECT s.id FROM sessions s JOIN events e ON e.id = s.event_id
     WHERE s.id = ? AND e.organizer_id = ?`,
    [req.params.id, req.user.id]
  );
  if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

  const { title, description, start_time, end_time, location, type, section_id, speaker_ids } = req.body;
  const fields = [];
  const values = [];
  if (title)       { fields.push('title = ?');       values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (start_time)  { fields.push('start_time = ?');  values.push(start_time); }
  if (end_time)    { fields.push('end_time = ?');    values.push(end_time); }
  if (location)    { fields.push('location = ?');    values.push(location); }
  if (type)        { fields.push('type = ?');        values.push(type); }
  if (section_id)  { fields.push('section_id = ?');  values.push(section_id); }

  if (fields.length) {
    values.push(req.params.id);
    await pool.execute(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  if (Array.isArray(speaker_ids)) {
    await pool.execute('DELETE FROM session_speakers WHERE session_id = ?', [req.params.id]);
    for (const spId of speaker_ids) {
      await pool.execute('INSERT IGNORE INTO session_speakers (session_id, speaker_id) VALUES (?,?)', [req.params.id, spId]);
    }
  }

  return res.json({ success: true, message: 'Session mise a jour.' });
};

exports.deleteSession = async (req, res) => {
  const [[session]] = await pool.execute(
    `SELECT s.id FROM sessions s JOIN events e ON e.id = s.event_id
     WHERE s.id = ? AND e.organizer_id = ?`,
    [req.params.id, req.user.id]
  );
  if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });
  await pool.execute('DELETE FROM session_speakers WHERE session_id = ?', [req.params.id]);
  await pool.execute('DELETE FROM sessions WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Session supprimee.' });
};

// ════════════════════════════════════════════════════════════════
//  NOTIFICATIONS & EXPORT
// ════════════════════════════════════════════════════════════════

exports.notifyAttendees = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id, title FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const { title, message, type = 'info' } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Titre et message requis.' });
  }

  const [attendees] = await pool.execute(
    "SELECT DISTINCT user_id FROM tickets WHERE event_id = ? AND status IN ('active', 'used')",
    [req.params.id]
  );

  if (!attendees.length) {
    return res.json({ success: true, message: 'Aucun participant a notifier.', data: { sent: 0 } });
  }

  const values = attendees.map(a => [uuidv4(), a.user_id, type, title, message, req.params.id]);
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, message, event_id) VALUES ?',
    [values]
  );

  return res.json({
    success: true,
    message: `Notification envoyee a ${attendees.length} participant(s).`,
    data: { sent: attendees.length },
  });
};

exports.exportAttendees = async (req, res) => {
  const [[event]] = await pool.execute(
    'SELECT id, title FROM events WHERE id = ? AND organizer_id = ?',
    [req.params.id, req.user.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Evenement introuvable.' });

  const [attendees] = await pool.execute(
    `SELECT t.ticket_number, t.holder_name, t.holder_email, t.holder_phone,
       t.status, t.price_paid, t.currency, t.created_at, t.used_at,
       tt.name AS ticket_type, u.country
     FROM tickets t
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.event_id = ? ORDER BY t.created_at ASC`, [req.params.id]
  );

  const headers = ['N Billet', 'Nom', 'Email', 'Telephone', 'Type', 'Statut', 'Prix', 'Devise', 'Pays', 'Achete le', 'Utilise le'];
  const rows = attendees.map(a => [
    a.ticket_number, a.holder_name, a.holder_email || '', a.holder_phone || '',
    a.ticket_type, a.status, a.price_paid, a.currency, a.country || '',
    a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : '',
    a.used_at    ? new Date(a.used_at).toISOString().slice(0, 10) : '',
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="participants-${req.params.id}.csv"`);
  return res.send('\uFEFF' + csv);
};

// ════════════════════════════════════════════════════════════════
//  DIVERS
// ════════════════════════════════════════════════════════════════

exports.listCategories = async (req, res) => {
  const [cats] = await pool.execute('SELECT id, label, slug, color FROM categories ORDER BY label ASC');
  return res.json({ success: true, data: cats });
};

exports.notifications = async (req, res) => {
  const [notifs] = await pool.execute(
    'SELECT n.* FROM notifications n WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50',
    [req.user.id]
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
