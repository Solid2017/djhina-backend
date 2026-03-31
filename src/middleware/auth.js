const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token manquant. Veuillez vous connecter.' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, avatar, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Compte introuvable ou désactivé.' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expirée. Reconnectez-vous.', expired: true });
    }
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
}

// Middleware optionnel — ne bloque pas si pas de token
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, avatar FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );
    if (rows.length) req.user = rows[0];
  } catch {}
  next();
}

module.exports = { authenticate, optionalAuth };
