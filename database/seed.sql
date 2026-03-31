-- ═══════════════════════════════════════════════════════════════
--  DJHINA — DONNÉES INITIALES
-- ═══════════════════════════════════════════════════════════════
USE djhina_db;

-- Catégories
INSERT INTO categories (id, slug, label, icon, color, sort_order) VALUES
  (UUID(), 'festival',    'Festival',    'sparkles',     '#F59E0B', 1),
  (UUID(), 'music',       'Concert',     'musical-notes','#EC4899', 2),
  (UUID(), 'culture',     'Culture',     'library',      '#0000FF', 3),
  (UUID(), 'conference',  'Conférence',  'mic',          '#06B6D4', 4),
  (UUID(), 'fashion',     'Mode',        'shirt',        '#A855F7', 5),
  (UUID(), 'sport',       'Sport',       'football',     '#14B8A6', 6),
  (UUID(), 'business',    'Business',    'briefcase',    '#3B82F6', 7),
  (UUID(), 'food',        'Gastronomie', 'restaurant',   '#F97316', 8);

-- Administrateur par défaut (mot de passe: Admin@Djhina2026)
INSERT INTO users (id, name, email, phone, password, role, country, is_active, is_verified) VALUES
  (UUID(), 'Admin Djhina', 'admin@djhina.igotech.tech', '+235 66 00 00 01',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGnSJqGJhqJYfRpNqHhUxnJkV6G',
   'admin', 'Tchad', 1, 1);

-- Organisateur démo (mot de passe: Orga@Djhina2026)
INSERT INTO users (id, name, email, phone, password, role, country, is_active, is_verified) VALUES
  (UUID(), 'Djhina Events Tchad', 'organizer@djhina.igotech.tech', '+235 66 00 00 02',
   '$2a$12$XKp8oGkuK9IzGkQU1vQQF.xnHfTZGTYYtYKlXKV3v0j8QGfPbYnJa',
   'organizer', 'Tchad', 1, 1);
