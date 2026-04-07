# ─────────────────────────────────────────────────────────────────────
# Djhina Backend — Script de déploiement SSH automatique (Windows)
# Usage: .\deploy\deploy.ps1
# ─────────────────────────────────────────────────────────────────────

param(
    [string]$SSH_HOST     = "REMPLACER",
    [string]$SSH_PORT     = "22",
    [string]$SSH_USER     = "REMPLACER",
    [string]$SSH_PASS     = "REMPLACER",
    [string]$DB_NAME      = "REMPLACER",
    [string]$DB_USER      = "REMPLACER",
    [string]$DB_PASS      = "REMPLACER",
    [string]$REMOTE_DIR   = "~/djhina-backend"
)

$APP_DIR   = "D:\APPS\DjhinaBackend"
$EXCLUDE   = @("node_modules", ".git", "deploy", ".env", "*.log", "uploads")

Write-Host "=== Déploiement Djhina Backend → $SSH_HOST ===" -ForegroundColor Cyan

# ── 1. Vérifier plink/pscp (PuTTY) ou ssh/scp natif ──────────────────
$useNativeSSH = $true
if (-not (Get-Command "ssh" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ssh non trouvé. Installe OpenSSH ou PuTTY." -ForegroundColor Red
    exit 1
}
Write-Host "✓ SSH natif Windows détecté" -ForegroundColor Green

# ── 2. Générer les secrets JWT ─────────────────────────────────────────
$JWT_SECRET     = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
$JWT_REFRESH    = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ── 3. Créer le .env de production ────────────────────────────────────
$envContent = @"
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=$JWT_REFRESH
JWT_REFRESH_EXPIRES_IN=30d
ALLOWED_ORIGINS=https://djhina.igotech.tech
UPLOAD_DIR=uploads
PUBLIC_URL=https://djhina.igotech.tech
"@
$envContent | Out-File -FilePath "$APP_DIR\.env.deploy" -Encoding utf8 -NoNewline
Write-Host "✓ .env de production généré" -ForegroundColor Green

# ── 4. Créer une archive du projet (sans node_modules) ────────────────
Write-Host "Compression du projet..." -ForegroundColor Yellow
$zipPath = "$env:TEMP\djhina-backend.tar.gz"

# Utiliser tar natif Windows 10+
$excludeArgs = $EXCLUDE | ForEach-Object { "--exclude=./$_" }
Push-Location $APP_DIR
tar -czf $zipPath $excludeArgs . 2>&1
Pop-Location
Write-Host "✓ Archive créée : $zipPath" -ForegroundColor Green

# ── 5. Transférer via SCP ─────────────────────────────────────────────
Write-Host "Transfert SSH en cours..." -ForegroundColor Yellow
$sshTarget = "${SSH_USER}@${SSH_HOST}"

# Commandes SSH batch
$sshCommands = @"
mkdir -p $REMOTE_DIR
mkdir -p $REMOTE_DIR/uploads/speakers
mkdir -p $REMOTE_DIR/uploads/avatars
mkdir -p $REMOTE_DIR/uploads/events
"@

# Créer répertoire distant
$sshCommands | ssh -p $SSH_PORT -o "StrictHostKeyChecking=no" `
    -o "BatchMode=no" `
    "$sshTarget" "bash -s"

# Copier l'archive
scp -P $SSH_PORT "$zipPath" "${sshTarget}:$REMOTE_DIR/app.tar.gz"
scp -P $SSH_PORT "$APP_DIR\.env.deploy" "${sshTarget}:$REMOTE_DIR/.env"
Write-Host "✓ Fichiers transférés" -ForegroundColor Green

# ── 6. Installer et démarrer sur le serveur ───────────────────────────
Write-Host "Installation sur le serveur..." -ForegroundColor Yellow

$remoteScript = @"
set -e
cd $REMOTE_DIR
echo '→ Extraction...'
tar -xzf app.tar.gz
rm app.tar.gz

echo '→ Installation dépendances npm...'
npm install --omit=dev --silent

echo '→ Migration base de données...'
node database/migrate.js

echo '→ Démarrage avec PM2...'
if command -v pm2 &>/dev/null; then
    pm2 stop djhina-backend 2>/dev/null || true
    pm2 start server.js --name djhina-backend --env production
    pm2 save
    echo '✓ PM2 lancé'
else
    npm install -g pm2
    pm2 start server.js --name djhina-backend --env production
    pm2 save
    echo '✓ PM2 installé et lancé'
fi

echo '→ Test santé...'
sleep 3
curl -s http://localhost:3000/health | grep -q 'ok' && echo '✓ Backend répond OK' || echo '⚠ Health check échoué'
"@

$remoteScript | ssh -p $SSH_PORT -o "StrictHostKeyChecking=no" "$sshTarget" "bash -s"

# ── 7. Nettoyage local ────────────────────────────────────────────────
Remove-Item "$APP_DIR\.env.deploy" -Force
Remove-Item $zipPath -Force

Write-Host ""
Write-Host "✅ DÉPLOIEMENT TERMINÉ !" -ForegroundColor Green
Write-Host "   URL : https://djhina.igotech.tech" -ForegroundColor Cyan
Write-Host "   Health : https://djhina.igotech.tech/health" -ForegroundColor Cyan
