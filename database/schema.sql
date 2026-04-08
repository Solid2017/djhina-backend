-- ═══════════════════════════════════════════════════════════════
--  DJHINA DATABASE SCHEMA
--  Plateforme événementielle du Tchad
--  Version 1.0 — djhina.igotech.tech
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS djhina_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE djhina_db;

-- ───────────────────────────────────────────────────────────────
-- UTILISATEURS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(100)    NOT NULL,
  email       VARCHAR(150)    UNIQUE NOT NULL,
  phone       VARCHAR(20),
  password    VARCHAR(255)    NOT NULL,
  role        ENUM('user','organizer','admin') DEFAULT 'user',
  avatar      VARCHAR(500),
  country     VARCHAR(80)     DEFAULT 'Tchad',
  city        VARCHAR(80),
  bio         TEXT,
  is_active   TINYINT(1)      DEFAULT 1,
  is_verified TINYINT(1)      DEFAULT 0,
  verify_token VARCHAR(100),
  reset_token  VARCHAR(100),
  reset_token_expiry DATETIME,
  last_login  DATETIME,
  created_at  DATETIME        DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- CATÉGORIES D'ÉVÉNEMENTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  slug  VARCHAR(50)   UNIQUE NOT NULL,
  label VARCHAR(80)   NOT NULL,
  icon  VARCHAR(50),
  color VARCHAR(7),
  sort_order INT      DEFAULT 0
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- ÉVÉNEMENTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  organizer_id    VARCHAR(36)   NOT NULL,
  category_id     VARCHAR(36),
  title           VARCHAR(200)  NOT NULL,
  subtitle        VARCHAR(300),
  description     TEXT,
  cover_image     VARCHAR(500),
  date            DATE          NOT NULL,
  time            TIME          NOT NULL,
  end_time        TIME,
  location        VARCHAR(300)  NOT NULL,
  city            VARCHAR(80)   DEFAULT 'N\'Djaména',
  country         VARCHAR(80)   DEFAULT 'Tchad',
  latitude        DECIMAL(10,8),
  longitude       DECIMAL(11,8),
  capacity        INT           DEFAULT 0,
  registered      INT           DEFAULT 0,
  status          ENUM('draft','published','cancelled','completed') DEFAULT 'draft',
  is_featured     TINYINT(1)    DEFAULT 0,
  is_free         TINYINT(1)    DEFAULT 0,
  tags            JSON,
  images          JSON,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id)  REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_status     (status),
  INDEX idx_date       (date),
  INDEX idx_city       (city),
  INDEX idx_organizer  (organizer_id),
  INDEX idx_featured   (is_featured)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- TYPES DE BILLETS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_types (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  event_id    VARCHAR(36)   NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency    VARCHAR(5)    DEFAULT 'XAF',
  benefits    JSON,
  available   INT           DEFAULT 0,
  sold        INT           DEFAULT 0,
  color       VARCHAR(7)    DEFAULT '#0000FF',
  sale_start  DATETIME,
  sale_end    DATETIME,
  is_active   TINYINT(1)    DEFAULT 1,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_event (event_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- PAIEMENTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  event_id        VARCHAR(36)   NOT NULL,
  ticket_type_id  VARCHAR(36)   NOT NULL,
  quantity        INT           DEFAULT 1,
  unit_price      DECIMAL(10,2) NOT NULL,
  fees            DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(5)    DEFAULT 'XAF',
  provider        ENUM('airtel_money','moov_tchad','cash','free') NOT NULL,
  phone           VARCHAR(20),
  transaction_id  VARCHAR(100),
  provider_ref    VARCHAR(200),
  status          ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
  paid_at         DATETIME,
  notes           TEXT,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)        REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id)       REFERENCES events(id) ON DELETE RESTRICT,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
  INDEX idx_user      (user_id),
  INDEX idx_event     (event_id),
  INDEX idx_status    (status),
  INDEX idx_provider  (provider)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- BILLETS ÉMIS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  ticket_number   VARCHAR(30)   UNIQUE NOT NULL,
  payment_id      VARCHAR(36),
  event_id        VARCHAR(36)   NOT NULL,
  ticket_type_id  VARCHAR(36)   NOT NULL,
  user_id         VARCHAR(36)   NOT NULL,
  holder_name     VARCHAR(100)  NOT NULL,
  holder_email    VARCHAR(150),
  holder_phone    VARCHAR(20),
  seat_number     VARCHAR(20),
  qr_data         TEXT          NOT NULL,
  qr_image        VARCHAR(500),
  status          ENUM('active','used','expired','cancelled') DEFAULT 'active',
  used_at         DATETIME,
  used_by         VARCHAR(36),
  price_paid      DECIMAL(10,2) DEFAULT 0,
  currency        VARCHAR(5)    DEFAULT 'XAF',
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id)     REFERENCES payments(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id)       REFERENCES events(id)  ON DELETE RESTRICT,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id)        REFERENCES users(id)   ON DELETE RESTRICT,
  INDEX idx_number  (ticket_number),
  INDEX idx_user    (user_id),
  INDEX idx_event   (event_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- LOGS DE SCAN QR
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_logs (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  ticket_id   VARCHAR(36),
  scanned_by  VARCHAR(36)   NOT NULL,
  event_id    VARCHAR(36),
  result      ENUM('valid','invalid','already_used','expired') NOT NULL,
  raw_qr      TEXT,
  ip_address  VARCHAR(45),
  device_info VARCHAR(200),
  scanned_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_ticket  (ticket_id),
  INDEX idx_scanner (scanned_by),
  INDEX idx_event   (event_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- INTERACTIONS ÉVÉNEMENTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_likes (
  user_id   VARCHAR(36) NOT NULL,
  event_id  VARCHAR(36) NOT NULL,
  created_at DATETIME   DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS event_saves (
  user_id   VARCHAR(36) NOT NULL,
  event_id  VARCHAR(36) NOT NULL,
  created_at DATETIME   DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- COMMENTAIRES
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  event_id    VARCHAR(36)   NOT NULL,
  user_id     VARCHAR(36)   NOT NULL,
  parent_id   VARCHAR(36),
  content     TEXT          NOT NULL,
  likes_count INT           DEFAULT 0,
  is_hidden   TINYINT(1)    DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id)  REFERENCES events(id)   ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_event (event_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  type        ENUM('ticket','event','payment','system','reminder') NOT NULL,
  title       VARCHAR(200)  NOT NULL,
  message     TEXT,
  data        JSON,
  is_read     TINYINT(1)    DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_read (is_read)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- REFRESH TOKENS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  token       VARCHAR(500)  NOT NULL,
  expires_at  DATETIME      NOT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token(100))
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- VUES UTILES
-- ───────────────────────────────────────────────────────────────
CREATE VIEW v_events_public AS
SELECT
  e.*,
  u.name        AS organizer_name,
  u.avatar      AS organizer_avatar,
  u.is_verified AS organizer_verified,
  c.label       AS category_label,
  c.color       AS category_color,
  c.icon        AS category_icon,
  (SELECT COUNT(*) FROM event_likes  WHERE event_id = e.id) AS likes_count,
  (SELECT COUNT(*) FROM comments     WHERE event_id = e.id AND is_hidden = 0) AS comments_count
FROM events e
JOIN users      u ON e.organizer_id = u.id
LEFT JOIN categories c ON e.category_id = c.id
WHERE e.status = 'published';

CREATE VIEW v_tickets_detail AS
SELECT
  t.*,
  e.title      AS event_title,
  e.date       AS event_date,
  e.time       AS event_time,
  e.location   AS event_location,
  e.cover_image AS event_cover,
  tt.name      AS ticket_type_name,
  tt.color     AS ticket_type_color,
  tt.benefits  AS ticket_benefits
FROM tickets t
JOIN events      e  ON t.event_id       = e.id
JOIN ticket_types tt ON t.ticket_type_id = tt.id;
