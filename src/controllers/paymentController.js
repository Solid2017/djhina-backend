const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// ── GET /api/payments/history ─────────────────────────────────
exports.history = async (req, res) => {
  const userId = req.user.id;
  const limit  = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  const [rows] = await pool.execute(
    `SELECT
       p.id, p.transaction_id, p.quantity, p.unit_price, p.fees, p.total,
       p.currency, p.provider, p.phone, p.status, p.paid_at, p.created_at,
       e.title  AS event_title,
       e.date   AS event_date,
       e.cover_image,
       tt.name  AS ticket_type_name
     FROM payments p
     JOIN events       e  ON e.id  = p.event_id
     JOIN ticket_types tt ON tt.id = p.ticket_type_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const [total] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM payments WHERE user_id = ?',
    [userId]
  );

  const BASE = process.env.BASE_URL || '';
  const formatted = rows.map(p => ({
    ...p,
    cover_image: p.cover_image
      ? (p.cover_image.startsWith('http') ? p.cover_image : `${BASE}${p.cover_image}`)
      : null,
    provider_label: providerLabel(p.provider),
    status_label:   statusLabel(p.status),
  }));

  return res.json({
    success: true,
    data: formatted,
    total: total[0].cnt,
  });
};

// ── GET /api/payments/:id ─────────────────────────────────────
exports.getPayment = async (req, res) => {
  const [[payment]] = await pool.execute(
    `SELECT
       p.*, e.title AS event_title, e.date AS event_date, e.location,
       tt.name AS ticket_type_name
     FROM payments p
     JOIN events e ON e.id = p.event_id
     JOIN ticket_types tt ON tt.id = p.ticket_type_id
     WHERE p.id = ? AND p.user_id = ?`,
    [req.params.id, req.user.id]
  );

  if (!payment) {
    return res.status(404).json({ success: false, message: 'Paiement introuvable.' });
  }

  return res.json({ success: true, data: { ...payment, provider_label: providerLabel(payment.provider) } });
};

// ── POST /api/payments/initiate ───────────────────────────────
// Démarre une transaction de paiement (en attente de confirmation OTP)
exports.initiate = async (req, res) => {
  const { event_id, ticket_type_id, quantity = 1, provider, phone } = req.body;

  if (!event_id || !ticket_type_id || !provider) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants.' });
  }

  if (['airtel_money', 'moov_tchad'].includes(provider) && !phone) {
    return res.status(400).json({ success: false, message: 'Numéro de téléphone requis pour le paiement mobile.' });
  }

  const [[event]] = await pool.execute(
    'SELECT id, title, status FROM events WHERE id = ?', [event_id]
  );
  if (!event || event.status !== 'published') {
    return res.status(404).json({ success: false, message: 'Événement introuvable.' });
  }

  const [[tt]] = await pool.execute(
    'SELECT * FROM ticket_types WHERE id = ? AND event_id = ? AND is_active = 1',
    [ticket_type_id, event_id]
  );
  if (!tt) {
    return res.status(404).json({ success: false, message: 'Type de billet introuvable.' });
  }

  if ((tt.available - tt.sold) < quantity) {
    return res.status(400).json({ success: false, message: 'Plus assez de billets disponibles.' });
  }

  const unitPrice = parseFloat(tt.price);
  const fees      = Math.round(unitPrice * quantity * 0.02);
  const total     = unitPrice * quantity + fees;

  // Créer un paiement en statut "pending"
  const paymentId     = uuidv4();
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;

  await pool.execute(
    `INSERT INTO payments
       (id, user_id, event_id, ticket_type_id, quantity, unit_price, fees, total,
        currency, provider, phone, transaction_id, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
    [paymentId, req.user.id, event_id, ticket_type_id, quantity,
     unitPrice, fees, total, tt.currency || 'XAF', provider, phone || null, transactionId]
  );

  return res.status(201).json({
    success: true,
    message: 'Paiement initié. En attente de confirmation.',
    data: {
      payment_id:     paymentId,
      transaction_id: transactionId,
      total,
      fees,
      currency:       tt.currency || 'XAF',
      provider,
      provider_label: providerLabel(provider),
      // Instructions selon le provider
      instructions:   getInstructions(provider, phone, total),
    },
  });
};

// ── POST /api/payments/:id/confirm ────────────────────────────
// Simule la confirmation d'un paiement (à connecter à l'API du provider)
exports.confirm = async (req, res) => {
  const [[payment]] = await pool.execute(
    'SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = ?',
    [req.params.id, req.user.id, 'pending']
  );

  if (!payment) {
    return res.status(404).json({ success: false, message: 'Paiement introuvable ou déjà traité.' });
  }

  // Simulation : on marque comme complété
  // En production : vérifier avec l'API Airtel/Moov
  await pool.execute(
    'UPDATE payments SET status = ?, paid_at = NOW() WHERE id = ?',
    ['completed', payment.id]
  );

  // Déclencher la création des billets via le ticket controller
  return res.json({
    success: true,
    message: 'Paiement confirmé avec succès.',
    data: { payment_id: payment.id, status: 'completed' },
  });
};

// ── DELETE /api/payments/:id ──────────────────────────────────
exports.cancel = async (req, res) => {
  const [[payment]] = await pool.execute(
    'SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = ?',
    [req.params.id, req.user.id, 'pending']
  );

  if (!payment) {
    return res.status(404).json({ success: false, message: 'Paiement introuvable ou non annulable.' });
  }

  await pool.execute('UPDATE payments SET status = ? WHERE id = ?', ['failed', payment.id]);

  return res.json({ success: true, message: 'Paiement annulé.' });
};

// ── Helpers ───────────────────────────────────────────────────
function providerLabel(provider) {
  const map = {
    airtel_money: 'Airtel Money',
    moov_tchad:   'Moov Tchad',
    cash:         'Espèces',
    free:         'Gratuit',
  };
  return map[provider] || provider;
}

function statusLabel(status) {
  const map = {
    pending:   'En attente',
    completed: 'Complété',
    failed:    'Échoué',
    refunded:  'Remboursé',
  };
  return map[status] || status;
}

function getInstructions(provider, phone, total) {
  switch (provider) {
    case 'airtel_money':
      return `Composez *555# sur ${phone}, choisissez "Paiement marchand", entrez le montant ${total.toLocaleString('fr-FR')} XAF.`;
    case 'moov_tchad':
      return `Composez *155# sur ${phone}, choisissez "Payer facture", entrez le montant ${total.toLocaleString('fr-FR')} XAF.`;
    case 'cash':
      return 'Présentez votre commande à l\'accueil pour régler en espèces.';
    case 'free':
      return 'Événement gratuit — aucun paiement requis.';
    default:
      return '';
  }
}
