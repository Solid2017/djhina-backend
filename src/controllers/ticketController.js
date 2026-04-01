const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { pool } = require('../config/database');
const renderTicket = require('../templates/ticketTemplate');

function generateTicketNumber() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `DJH-TD-${ts}-${rand}`;
}

// ── POST /api/tickets/purchase ───────────────────────────────
exports.purchase = async (req, res) => {
  const {
    event_id, ticket_type_id, quantity = 1,
    provider, phone, holder_name,
  } = req.body;

  // Vérifier l'événement
  const [[event]] = await pool.execute(
    'SELECT id, title, date, status FROM events WHERE id = ?',
    [event_id]
  );
  if (!event || event.status !== 'published') {
    return res.status(404).json({ success: false, message: 'Événement introuvable ou non publié.' });
  }

  // Vérifier le type de billet
  const [[ticketType]] = await pool.execute(
    'SELECT * FROM ticket_types WHERE id = ? AND event_id = ? AND is_active = 1',
    [ticket_type_id, event_id]
  );
  if (!ticketType) {
    return res.status(404).json({ success: false, message: 'Type de billet introuvable.' });
  }

  const remaining = ticketType.available - ticketType.sold;
  if (remaining < quantity) {
    return res.status(400).json({
      success: false,
      message: `Seulement ${remaining} billet(s) disponible(s).`,
    });
  }

  const unitPrice  = parseFloat(ticketType.price);
  const fees       = Math.round(unitPrice * quantity * 0.02);
  const total      = unitPrice * quantity + fees;

  // Créer le paiement
  const paymentId = uuidv4();
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;

  await pool.execute(
    `INSERT INTO payments
      (id, user_id, event_id, ticket_type_id, quantity, unit_price, fees, total, currency, provider, phone, transaction_id, status, paid_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'completed', NOW())`,
    [paymentId, req.user.id, event_id, ticket_type_id, quantity, unitPrice, fees, total,
     ticketType.currency || 'XAF', provider, phone, transactionId]
  );

  // Émettre les billets
  const issuedTickets = [];
  for (let i = 0; i < quantity; i++) {
    const ticketId     = uuidv4();
    const ticketNumber = generateTicketNumber();

    const qrData = JSON.stringify({
      ticketId:     ticketNumber,
      eventId:      event_id,
      eventTitle:   event.title,
      type:         ticketType.name,
      holder:       holder_name || req.user.name,
      userId:       req.user.id,
      ts:           Date.now(),
      v:            1,
    });

    // Générer l'image QR (base64 PNG)
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300, margin: 2,
      color: { dark: '#00071A', light: '#FFFFFF' },
    });

    await pool.execute(
      `INSERT INTO tickets
        (id, ticket_number, payment_id, event_id, ticket_type_id, user_id, holder_name, holder_email, holder_phone, qr_data, qr_image, price_paid, currency)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ticketId, ticketNumber, paymentId, event_id, ticket_type_id,
        req.user.id, holder_name || req.user.name,
        req.user.email, phone,
        qrData, qrImage,
        unitPrice, ticketType.currency || 'XAF',
      ]
    );

    issuedTickets.push({ id: ticketId, ticketNumber, qrData, qrImage });
  }

  // MAJ compteurs
  await pool.execute(
    'UPDATE ticket_types SET sold = sold + ? WHERE id = ?',
    [quantity, ticket_type_id]
  );
  await pool.execute(
    'UPDATE events SET registered = registered + ? WHERE id = ?',
    [quantity, event_id]
  );

  // Notification
  await pool.execute(
    `INSERT INTO notifications (id, user_id, type, title, message, data)
     VALUES (?,?,'ticket',?,?,?)`,
    [
      uuidv4(), req.user.id,
      `Billet confirmé — ${event.title}`,
      `Votre commande de ${quantity} billet(s) a été traitée avec succès.`,
      JSON.stringify({ event_id, payment_id: paymentId, ticket_count: quantity }),
    ]
  );

  return res.status(201).json({
    success: true,
    message: `${quantity} billet(s) émis avec succès.`,
    data: {
      paymentId,
      transactionId,
      total,
      currency: ticketType.currency || 'XAF',
      tickets: issuedTickets,
    },
  });
};

// ── GET /api/tickets/my ──────────────────────────────────────
exports.myTickets = async (req, res) => {
  const { status } = req.query;
  const where  = ['t.user_id = ?'];
  const params = [req.user.id];

  if (status) { where.push('t.status = ?'); params.push(status); }

  const [tickets] = await pool.execute(
    `SELECT t.*,
       e.title AS event_title, e.date AS event_date,
       e.time AS event_time, e.location AS event_location,
       e.cover_image AS event_cover,
       tt.name AS ticket_type_name, tt.color AS ticket_type_color,
       tt.benefits AS ticket_benefits
     FROM tickets t
     JOIN events       e  ON t.event_id       = e.id
     JOIN ticket_types tt ON t.ticket_type_id  = tt.id
     WHERE ${where.join(' AND ')}
     ORDER BY t.created_at DESC`,
    params
  );

  return res.json({ success: true, data: tickets });
};

// ── GET /api/tickets/:id ─────────────────────────────────────
exports.getTicket = async (req, res) => {
  const [[ticket]] = await pool.execute(
    `SELECT t.*,
       e.title AS event_title, e.date AS event_date,
       e.time AS event_time, e.location AS event_location,
       e.cover_image AS event_cover, e.city AS event_city,
       tt.name AS ticket_type_name, tt.color AS ticket_type_color,
       tt.benefits AS ticket_benefits
     FROM tickets t
     JOIN events       e  ON t.event_id       = e.id
     JOIN ticket_types tt ON t.ticket_type_id  = tt.id
     WHERE t.id = ? AND (t.user_id = ? OR ? = 'admin')`,
    [req.params.id, req.user.id, req.user.role]
  );

  if (!ticket) return res.status(404).json({ success: false, message: 'Billet introuvable.' });
  return res.json({ success: true, data: ticket });
};

// ── GET /tickets/:number/view  (public — HTML) ───────────────
exports.viewTicket = async (req, res) => {
  const [[ticket]] = await pool.execute(
    `SELECT t.*,
       e.title       AS event_title,
       e.date        AS event_date,
       e.time        AS event_time,
       e.location    AS event_location,
       e.city        AS event_city,
       e.cover_image AS event_cover,
       tt.name       AS ticket_type_name,
       tt.color      AS ticket_type_color,
       c.label       AS category_label
     FROM tickets t
     JOIN events       e  ON t.event_id      = e.id
     JOIN ticket_types tt ON t.ticket_type_id = tt.id
     LEFT JOIN categories c ON e.category_id  = c.id
     WHERE t.ticket_number = ?`,
    [req.params.number]
  );

  if (!ticket) {
    return res.status(404).send(`
      <!DOCTYPE html><html><body style="background:#00071A;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
        <div><h2 style="color:#f87171">Billet introuvable</h2><p style="color:#7ea3ff;margin-top:.5rem">Le numéro de billet "${req.params.number}" n'existe pas.</p></div>
      </body></html>`);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderTicket(ticket));
};

// ── POST /api/tickets/verify ─────────────────────────────────
// Appelé par le scanner QR (organisateur ou admin uniquement)
exports.verify = async (req, res) => {
  const { qr_data, event_id } = req.body;
  let ticketData;

  try {
    ticketData = JSON.parse(qr_data);
  } catch {
    return res.status(400).json({ success: false, message: 'QR code invalide.' });
  }

  const [[ticket]] = await pool.execute(
    `SELECT t.*, e.title AS event_title, e.date AS event_date
     FROM tickets t JOIN events e ON t.event_id = e.id
     WHERE t.ticket_number = ?`,
    [ticketData.ticketId]
  );

  const scanId = uuidv4();
  let result   = 'invalid';
  let message  = 'Billet invalide.';
  let httpCode = 400;

  if (!ticket) {
    result  = 'invalid';
    message = 'Billet non trouvé dans la base de données.';
  } else if (event_id && ticket.event_id !== event_id) {
    result  = 'invalid';
    message = 'Billet non valide pour cet événement.';
  } else if (ticket.status === 'used') {
    result  = 'already_used';
    message = `Billet déjà utilisé le ${new Date(ticket.used_at).toLocaleString('fr-FR')}.`;
    httpCode = 409;
  } else if (ticket.status === 'cancelled' || ticket.status === 'expired') {
    result  = 'expired';
    message = 'Billet annulé ou expiré.';
  } else if (ticket.status === 'active') {
    // Valider le billet
    await pool.execute(
      'UPDATE tickets SET status = "used", used_at = NOW(), used_by = ? WHERE id = ?',
      [req.user.id, ticket.id]
    );
    result   = 'valid';
    message  = 'Accès autorisé ! Bienvenue.';
    httpCode = 200;
  }

  // Log du scan
  await pool.execute(
    `INSERT INTO scan_logs (id, ticket_id, scanned_by, event_id, result, raw_qr, ip_address)
     VALUES (?,?,?,?,?,?,?)`,
    [scanId, ticket?.id || null, req.user.id, ticket?.event_id || event_id || null,
     result, qr_data, req.ip]
  );

  return res.status(httpCode).json({
    success: result === 'valid',
    result,
    message,
    data: ticket ? {
      ticketNumber: ticket.ticket_number,
      holderName:   ticket.holder_name,
      ticketType:   ticket.ticket_type_id,
      eventTitle:   ticket.event_title,
      eventDate:    ticket.event_date,
    } : null,
  });
};
