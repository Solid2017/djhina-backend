# Plan de déploiement — Djhina

---

## 1. Hébergement Backend sur LWS (djhina.igotech.tech)

### 1.1 Offre recommandée — LWS VPS Cloud

| Critère | Choix |
|---|---|
| Hébergeur | LWS (lws.fr) |
| Offre | **VPS Cloud 1** (ou supérieur) |
| CPU | 1 vCPU |
| RAM | 2 Go (min) |
| Stockage | 20 Go SSD NVMe |
| Bande passante | Illimitée |
| OS | **Ubuntu 22.04 LTS** |
| Coût estimé | ~5–8 €/mois |

> Pour une application en production active (>500 utilisateurs), passer au **VPS Cloud 2** (4 Go RAM, ~12 €/mois).

---

### 1.2 Architecture sur le VPS

```
[Client Expo App]  ──HTTPS──>  [Nginx reverse proxy]
                                       │
                              [Node.js :3000 (PM2)]
                                       │
                              [MySQL 8.0 (local)]
                                       │
                              [Uploads /var/www/djhina/uploads]
```

---

### 1.3 Étapes de déploiement

#### Étape 1 — Préparer le VPS Ubuntu

```bash
# Connexion SSH
ssh root@IP_VPS

# Mise à jour système
apt update && apt upgrade -y

# Installer Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Installer PM2 (gestionnaire de processus)
npm install -g pm2

# Installer MySQL 8.0
apt install -y mysql-server
mysql_secure_installation

# Installer Nginx
apt install -y nginx certbot python3-certbot-nginx
```

#### Étape 2 — Configurer MySQL

```sql
-- Connecté en root MySQL
CREATE DATABASE djhina_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'djhina_user'@'localhost' IDENTIFIED BY 'MotDePasseUltraSecure123!';
GRANT ALL PRIVILEGES ON djhina_db.* TO 'djhina_user'@'localhost';
FLUSH PRIVILEGES;
```

```bash
# Exécuter les migrations
cd /var/www/djhina/backend
node database/migrate.js --seed
```

#### Étape 3 — Déployer le backend

```bash
# Créer le répertoire
mkdir -p /var/www/djhina/backend
cd /var/www/djhina/backend

# Uploader via Git (recommandé) ou SFTP
git clone https://github.com/VOTRE_REPO/djhina-backend.git .
# ou via sftp : sftp> put -r DjhinaBackend/* .

# Installer les dépendances (production uniquement)
npm install --omit=dev

# Créer le .env depuis le modèle
cp .env.example .env
nano .env  # Remplir les vraies valeurs

# Créer le dossier uploads
mkdir -p uploads/avatars uploads/events

# Lancer avec PM2
pm2 start server.js --name djhina-api
pm2 save
pm2 startup   # pour démarrage automatique au reboot
```

#### Étape 4 — Configurer Nginx

```nginx
# /etc/nginx/sites-available/djhina
server {
    listen 80;
    server_name djhina.igotech.tech;

    # Redirection HTTPS gérée par Certbot
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name djhina.igotech.tech;

    # SSL (généré par Certbot)
    ssl_certificate     /etc/letsencrypt/live/djhina.igotech.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/djhina.igotech.tech/privkey.pem;

    # Sécurité headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # Limite taille upload
    client_max_body_size 10M;

    # Proxy vers Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Servir les images uploadées directement
    location /uploads/ {
        alias /var/www/djhina/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check public
    location /health {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

```bash
# Activer le site
ln -s /etc/nginx/sites-available/djhina /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Générer le certificat SSL gratuit (Let's Encrypt)
certbot --nginx -d djhina.igotech.tech
```

#### Étape 5 — DNS (Registrar / LWS)

Ajouter dans la zone DNS du domaine `igotech.tech` :

| Type | Nom | Valeur | TTL |
|------|-----|---------|-----|
| A | djhina | IP_VPS | 300 |

---

### 1.4 Variables d'environnement en production (.env)

```env
NODE_ENV=production
PORT=3000
APP_URL=https://djhina.igotech.tech

DB_HOST=localhost
DB_PORT=3306
DB_NAME=djhina_db
DB_USER=djhina_user
DB_PASSWORD=MotDePasseUltraSecure123!

JWT_SECRET=<générer avec: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<générer de la même façon>
JWT_REFRESH_EXPIRES_IN=30d

ALLOWED_ORIGINS=https://djhina.igotech.tech

SMTP_HOST=mail.igotech.tech
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@djhina.igotech.tech
SMTP_PASS=***
```

---

### 1.5 Commandes de maintenance

```bash
# Voir les logs en temps réel
pm2 logs djhina-api

# Redémarrer après un déploiement
pm2 restart djhina-api

# Mettre à jour l'application
cd /var/www/djhina/backend
git pull origin main
npm install --omit=dev
pm2 restart djhina-api

# Backup MySQL (à planifier en cron)
mysqldump -u djhina_user -p djhina_db > /backup/djhina_$(date +%Y%m%d).sql
```

---

## 2. Publication Android APK sur Google Play Store

### 2.1 Prérequis

- Compte Google Play Developer : **25 USD** (frais unique)
  → https://play.google.com/console/signup
- Expo Application Services (EAS) : `npm install -g eas-cli`

### 2.2 Configuration EAS (Expo)

```bash
cd DjhinaApp
eas login
eas build:configure
```

Créer/mettre à jour `eas.json` :

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-services-key.json",
        "track": "production"
      }
    }
  }
}
```

Mettre à jour `app.json` :

```json
{
  "expo": {
    "name": "Djhina",
    "slug": "djhina",
    "version": "1.0.0",
    "android": {
      "package": "tech.igotech.djhina",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#00071A"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.VIBRATE",
        "android.permission.INTERNET"
      ]
    }
  }
}
```

### 2.3 Build & Publication

```bash
# APK de test (partage direct, pas via Play Store)
eas build -p android --profile preview

# AAB pour le Play Store (format requis depuis août 2021)
eas build -p android --profile production

# Soumettre directement sur Play Store (après config serviceAccountKey)
eas submit -p android --latest
```

> Le build EAS se fait dans le cloud (gratuit pour le premier). Il dure ~10–20 minutes.
> Le fichier `.aab` généré est téléchargeable depuis https://expo.dev

### 2.4 Étapes sur Google Play Console

1. **Créer une application** → "Djhina" → Français (fr-FR) par défaut
2. **Fiche Play Store** :
   - Titre : `Djhina — Événements au Tchad`
   - Courte description : `Découvrez et réservez les meilleurs événements du Tchad.`
   - Description complète : présenter les fonctionnalités (feed, ticketing, QR, Mobile Money)
   - Captures d'écran : minimum 2 captures par type d'écran (téléphone + tablette)
   - Icône haute résolution : 512×512 px PNG
   - Image de bannière : 1024×500 px
3. **Classification du contenu** : PEGI 3 / Tout public
4. **Politique de confidentialité** : URL requise (ex: https://djhina.igotech.tech/privacy)
5. **Distribution** : Monde entier (ou restreindre au Tchad + pays voisins)
6. **Piste de lancement** : Commencer par **Test interne** → **Test fermé** → **Production**

### 2.5 Politique de confidentialité minimale requise

Héberger un fichier simple sur le serveur :

```
GET https://djhina.igotech.tech/privacy
```

Contenu minimum :
- Données collectées (nom, email, téléphone)
- Usage des données (authentification, billetterie)
- Partage avec tiers (Mobile Money : Airtel/Moov)
- Contact DPO : privacy@djhina.igotech.tech

---

## 3. Résumé des coûts

| Poste | Coût | Fréquence |
|---|---|---|
| VPS LWS Cloud 1 | ~7 € | / mois |
| Nom de domaine igotech.tech | Déjà possédé | — |
| SSL Let's Encrypt | Gratuit | — |
| Google Play Developer | 25 USD | Unique |
| EAS Build (Expo) | Gratuit (plan Free) | — |
| **Total lancement** | **~34 USD** | — |
| **Total mensuel** | **~7 €/mois** | — |

---

## 4. URL API de production

```
Base URL  : https://djhina.igotech.tech/api
Auth      : https://djhina.igotech.tech/api/auth
Événements: https://djhina.igotech.tech/api/events
Billets   : https://djhina.igotech.tech/api/tickets
Admin     : https://djhina.igotech.tech/api/admin
Organisat.: https://djhina.igotech.tech/api/organizer
Health    : https://djhina.igotech.tech/health
```

Dans l'application Expo, remplacer `API_BASE_URL` dans `src/config/api.js` par :
```js
export const API_BASE_URL = 'https://djhina.igotech.tech/api';
```
