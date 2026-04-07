#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Djhina Backend — Script de déploiement cPanel (SSH)
# Usage: bash setup-server.sh
# ─────────────────────────────────────────────────────────────────────
set -e

APP_DIR="$HOME/djhina-backend"
echo "=== Déploiement Djhina Backend ==="
echo "Répertoire : $APP_DIR"

# 1. Créer le dossier de l'app
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/uploads/speakers"
mkdir -p "$APP_DIR/uploads/avatars"
mkdir -p "$APP_DIR/uploads/events"

# 2. Installer les dépendances Node.js
cd "$APP_DIR"
echo "Installation des dépendances..."
npm install --omit=dev

# 3. Vérifier le fichier .env
if [ ! -f ".env" ]; then
  echo "⚠️  ATTENTION: Fichier .env manquant !"
  echo "   Copie .env.production en .env et remplis les valeurs."
  exit 1
fi

# 4. Lancer les migrations DB
echo "Migration de la base de données..."
node database/migrate.js

# 5. Configurer PM2 (gestionnaire de processus)
if command -v pm2 &> /dev/null; then
  pm2 stop djhina-backend 2>/dev/null || true
  pm2 start server.js --name "djhina-backend" --env production
  pm2 save
  pm2 startup 2>/dev/null || echo "Note: pm2 startup nécessite les droits root"
  echo "✓ PM2 démarré"
else
  echo "PM2 non trouvé, démarrage direct..."
  NODE_ENV=production node server.js &
fi

echo ""
echo "✅ Déploiement terminé !"
echo "   Backend accessible sur : https://djhina.igotech.tech"
echo "   Health check : https://djhina.igotech.tech/health"
