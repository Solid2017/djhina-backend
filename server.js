require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const { testConnection } = require('./src/config/database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité ─────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      scriptSrcAttr:  ["'unsafe-inline'"],          // onclick=, onchange=, onsubmit=…
      styleSrc:       ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      fontSrc:        ["'self'", "data:", "cdn.jsdelivr.net", "fonts.gstatic.com"],
      imgSrc:         ["'self'", "data:", "blob:"],
      connectSrc:     ["'self'"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:8081', 'https://djhina.igotech.tech'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Réessayez dans 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

app.use(globalLimiter);

// ── Parsers ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Fichiers statiques (uploads) ──────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

// ── Ticket viewer (public, HTML) ──────────────────────────────
const { viewTicket } = require('./src/controllers/ticketController');
app.get('/tickets/:number/view', viewTicket);

// ── Interface admin ───────────────────────────────────────────
// Cache désactivé pour les fichiers JS/CSS admin (évite les versions obsolètes en cache)
app.use('/admin', (req, res, next) => {
  if (/\.(js|css)$/.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
}, express.static(path.join(__dirname, 'public/admin'), {
  index: 'login.html',
  etag:  false,
}));
app.get('/admin', (req, res) => res.redirect('/admin/login.html'));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, require('./src/routes/auth'));
app.use('/api/events',                     require('./src/routes/events'));
app.use('/api/tickets',                    require('./src/routes/tickets'));
app.use('/api/notifications',              require('./src/routes/notifications'));
app.use('/api/admin',                      require('./src/routes/admin'));
app.use('/api/organizer',                  require('./src/routes/organizer'));

// ── Page d'accueil ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    app:     '🎭 Djhina API',
    version: '1.0.0',
    description: 'Plateforme événementielle du Tchad',
    status:  'En ligne',
    endpoints: {
      auth:             '/api/auth',
      events:           '/api/events',
      ticketTypes:      '/api/events/:id/ticket-types',
      comments:         '/api/events/:id/comments',
      tickets:          '/api/tickets',
      notifications:    '/api/notifications',
      organizer:        '/api/organizer',
      admin:            '/api/admin',
      ticketViewer:     '/tickets/:number/view',
      health:           '/health',
      uploads:          '/uploads',
    },
    docs: {
      login:    'POST /api/auth/login',
      register: 'POST /api/auth/register',
      events:   'GET  /api/events',
    },
  });
});

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app:     'Djhina API',
    version: '1.0.0',
    env:     process.env.NODE_ENV || 'development',
    time:    new Date().toISOString(),
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} introuvable.` });
});

// ── Gestionnaire d'erreurs global ────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);

  // Erreur de validation express-validator
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'JSON invalide.' });
  }

  // Erreur multer
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'Fichier trop volumineux (max 5 Mo).'
      : err.message;
    return res.status(400).json({ success: false, message: msg });
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Erreur serveur interne.' : err.message,
  });
});

// ── Démarrage ─────────────────────────────────────────────────
async function start() {
  await testConnection();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Djhina API démarrée`);
    console.log(`   ► http://localhost:${PORT}`);
    console.log(`   ► Env : ${process.env.NODE_ENV || 'development'}\n`);
  });
}

start().catch(err => {
  console.error('Impossible de démarrer le serveur :', err.message);
  process.exit(1);
});

module.exports = app;
