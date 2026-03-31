// Usages :
//   requireRole('admin')               → admins uniquement
//   requireRole('admin', 'organizer')  → admins ou organisateurs
//   isOwnerOrAdmin(getEventOwnerId)    → propriétaire ou admin

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Non authentifié.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle requis : ${roles.join(' ou ')}.`,
      });
    }
    next();
  };
}

// Vérifie que l'utilisateur est le propriétaire d'une ressource OU admin
function isOwnerOrAdmin(getOwnerId) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Non authentifié.' });
    }
    if (req.user.role === 'admin') return next();

    try {
      const ownerId = await getOwnerId(req);
      if (ownerId === req.user.id) return next();
      return res.status(403).json({ success: false, message: 'Accès refusé. Ressource appartenant à un autre utilisateur.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  };
}

module.exports = { requireRole, isOwnerOrAdmin };
