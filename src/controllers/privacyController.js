const bcrypt  = require('bcryptjs');
const { pool } = require('../config/database');

// ── GET /api/privacy/settings ─────────────────────────────────
exports.getSettings = async (req, res) => {
  const [[user]] = await pool.execute(
    `SELECT
       privacy_profile_public, privacy_show_activity,
       privacy_show_tickets,   data_share_analytics,
       biometric_enabled
     FROM users WHERE id = ?`,
    [req.user.id]
  );

  return res.json({
    success: true,
    data: {
      privacy_profile_public: !!user.privacy_profile_public,
      privacy_show_activity:  !!user.privacy_show_activity,
      privacy_show_tickets:   !!user.privacy_show_tickets,
      data_share_analytics:   !!user.data_share_analytics,
      biometric_enabled:      !!user.biometric_enabled,
    },
  });
};

// ── PUT /api/privacy/settings ─────────────────────────────────
exports.updateSettings = async (req, res) => {
  const allowed = [
    'privacy_profile_public', 'privacy_show_activity',
    'privacy_show_tickets', 'data_share_analytics', 'biometric_enabled',
  ];

  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key] ? 1 : 0);
    }
  }

  if (!fields.length) {
    return res.status(400).json({ success: false, message: 'Aucun paramètre fourni.' });
  }

  values.push(req.user.id);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

  return res.json({ success: true, message: 'Paramètres mis à jour.' });
};

// ── GET /api/privacy/export ───────────────────────────────────
exports.exportData = async (req, res) => {
  const userId = req.user.id;

  const [[user]] = await pool.execute(
    'SELECT id, name, email, phone, country, city, bio, created_at, last_login FROM users WHERE id = ?',
    [userId]
  );

  const [tickets] = await pool.execute(
    `SELECT t.ticket_number, t.holder_name, t.status, t.created_at,
            e.title AS event_title, e.date AS event_date,
            tt.name AS ticket_type, p.total, p.provider, p.paid_at
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     LEFT JOIN payments p ON p.id = t.payment_id
     WHERE t.user_id = ?`,
    [userId]
  );

  const [payments] = await pool.execute(
    `SELECT p.transaction_id, p.total, p.currency, p.provider,
            p.status, p.paid_at, e.title AS event_title
     FROM payments p JOIN events e ON e.id = p.event_id
     WHERE p.user_id = ?`,
    [userId]
  );

  return res.json({
    success: true,
    data: {
      exported_at: new Date().toISOString(),
      profile:     user,
      tickets,
      payments,
    },
  });
};

// ── POST /api/privacy/delete-account ─────────────────────────
exports.deleteAccount = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Mot de passe requis pour confirmer la suppression.' });
  }

  const [[user]] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(400).json({ success: false, message: 'Mot de passe incorrect.' });
  }

  // Désactiver le compte (soft delete)
  await pool.execute(
    "UPDATE users SET is_active = 0, email = CONCAT('deleted_', id, '_', email) WHERE id = ?",
    [req.user.id]
  );
  await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);

  return res.json({
    success: true,
    message: 'Votre compte a été supprimé. Toutes vos données seront effacées sous 30 jours.',
  });
};

// ── PUT /api/privacy/change-password ─────────────────────────
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Les deux mots de passe sont requis.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });
  }

  const [[user]] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
  const match    = await bcrypt.compare(currentPassword, user.password);

  if (!match) {
    return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect.' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
  await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);

  return res.json({ success: true, message: 'Mot de passe modifié avec succès. Reconnectez-vous.' });
};
