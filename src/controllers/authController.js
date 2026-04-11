const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function signRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

// ── POST /api/auth/register ──────────────────────────────────
exports.register = async (req, res) => {
  const { name, email, phone, password, country } = req.body;

  const [exists] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) {
    return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const id   = uuidv4();

  await pool.execute(
    'INSERT INTO users (id, name, email, phone, password, country, is_verified) VALUES (?,?,?,?,?,?,?)',
    [id, name, email, phone || null, hash, country || 'Tchad', 0]
  );

  const token        = signAccessToken({ id, role: 'user', email });
  const refreshToken = signRefreshToken(id);

  await pool.execute(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
    [uuidv4(), id, refreshToken]
  );

  return res.status(201).json({
    success: true,
    message: 'Compte créé avec succès.',
    data: {
      token,
      refreshToken,
      user: { id, name, email, phone, role: 'user', country: country || 'Tchad' },
    },
  });
};

// ── POST /api/auth/login ─────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await pool.execute(
    'SELECT id, name, email, phone, password, role, avatar, country, is_active FROM users WHERE email = ?',
    [email]
  );

  if (!rows.length) {
    return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
  }

  const user = rows[0];
  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'Compte désactivé. Contactez le support.' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
  }

  await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

  const token        = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);

  await pool.execute(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
    [uuidv4(), user.id, refreshToken]
  );

  const { password: _, ...safeUser } = user;

  return res.json({
    success: true,
    message: 'Connexion réussie.',
    data: { token, refreshToken, user: safeUser },
  });
};

// ── POST /api/auth/refresh ───────────────────────────────────
exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token manquant.' });
  }

  const [rows] = await pool.execute(
    'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
    [refreshToken]
  );
  if (!rows.length) {
    return res.status(401).json({ success: false, message: 'Refresh token invalide ou expiré.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const [users] = await pool.execute('SELECT id, email, role FROM users WHERE id = ?', [decoded.id]);
    if (!users.length) return res.status(401).json({ success: false, message: 'Utilisateur introuvable.' });

    const newToken = signAccessToken(users[0]);
    return res.json({ success: true, data: { token: newToken } });
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
};

// ── POST /api/auth/logout ────────────────────────────────────
exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
  }
  return res.json({ success: true, message: 'Déconnexion réussie.' });
};

// ── GET /api/auth/me ─────────────────────────────────────────
exports.me = async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, phone, role, avatar, country, city, bio, is_verified, last_login, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  return res.json({ success: true, data: rows[0] });
};

// ── PUT /api/auth/profile ────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const { name, phone, country, city, bio } = req.body;
  const avatar = req.file ? `/media/avatars/${req.file.filename}` : undefined;

  const fields = [];
  const values = [];

  if (name)    { fields.push('name = ?');    values.push(name); }
  if (phone)   { fields.push('phone = ?');   values.push(phone); }
  if (country) { fields.push('country = ?'); values.push(country); }
  if (city)    { fields.push('city = ?');    values.push(city); }
  if (bio)     { fields.push('bio = ?');     values.push(bio); }
  if (avatar)  { fields.push('avatar = ?');  values.push(avatar); }

  if (!fields.length) {
    return res.status(400).json({ success: false, message: 'Aucune modification fournie.' });
  }

  values.push(req.user.id);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

  const [rows] = await pool.execute(
    'SELECT id, name, email, phone, role, avatar, country, city, bio FROM users WHERE id = ?',
    [req.user.id]
  );
  return res.json({ success: true, message: 'Profil mis à jour.', data: rows[0] });
};

// ── PUT /api/auth/change-password ────────────────────────────
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
  const match  = await bcrypt.compare(currentPassword, rows[0].password);

  if (!match) {
    return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect.' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
  await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);

  return res.json({ success: true, message: 'Mot de passe modifié. Reconnectez-vous.' });
};
