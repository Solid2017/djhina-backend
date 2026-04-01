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
   '$2a$12$XVtN8o3vJcKx/GeyIPOIbO82/OLBjCEvzsjgC19AIFoGndKGX9FzG',
   'admin', 'Tchad', 1, 1);

-- Organisateurs démo (mot de passe: Orga@Djhina2026)
-- Hash bcrypt: $2a$12$69lbcpwdirUHrS9ye9xNQ.eDda2rJEzef6tFRfPL4uy.BT6Qve/Vu
INSERT INTO users (id, name, email, phone, password, role, country, city, bio, is_active, is_verified) VALUES
  (UUID(), 'Djhina Events Tchad', 'organizer@djhina.igotech.tech', '+235 66 00 00 02',
   '$2a$12$NPisRY4GPyyUz7ENJBLF8OngFtehsxFCbX.IqgNvcetKzwdv3kqNS',
   'organizer', 'Tchad', "N'Djaména", 'Organisateur officiel de la plateforme Djhina.', 1, 1),
  (UUID(), 'Emeraude Events', 'contact@emeraude-events.td', '+235 66 11 22 33',
   '$2a$12$69lbcpwdirUHrS9ye9xNQ.eDda2rJEzef6tFRfPL4uy.BT6Qve/Vu',
   'organizer', 'Tchad', "N'Djaména", 'Agence événementielle premium spécialisée dans les galas, mariages et lancements de produits au Tchad.', 1, 1),
  (UUID(), 'Clens Events', 'info@clens-events.td', '+235 66 44 55 66',
   '$2a$12$69lbcpwdirUHrS9ye9xNQ.eDda2rJEzef6tFRfPL4uy.BT6Qve/Vu',
   'organizer', 'Tchad', "N'Djaména", 'Organisation de concerts, festivals et événements culturels depuis 2018.', 1, 1),
  (UUID(), 'Job Booster', 'contact@jobbooster.td', '+235 66 77 88 99',
   '$2a$12$69lbcpwdirUHrS9ye9xNQ.eDda2rJEzef6tFRfPL4uy.BT6Qve/Vu',
   'organizer', 'Tchad', "N'Djaména", 'Spécialiste des forums emploi, salons professionnels et conférences business au Tchad.', 1, 1),
  (UUID(), 'Sy Elegance', 'info@syelegance.td', '+235 66 10 20 30',
   '$2a$12$69lbcpwdirUHrS9ye9xNQ.eDda2rJEzef6tFRfPL4uy.BT6Qve/Vu',
   'organizer', 'Tchad', "N'Djaména", 'Défilés de mode, expositions artistiques et événements de luxe pour la femme tchadienne.', 1, 1),
  (UUID(), 'Taronga Events', 'hello@taronga-events.td', '+235 66 40 50 60',
   '$2a$12$69lbcpwdirUHrS9ye9xNQ.eDda2rJEzef6tFRfPL4uy.BT6Qve/Vu',
   'organizer', 'Tchad', 'Moundou', 'Événements sportifs, concerts et animations culturelles dans le sud du Tchad.', 1, 1);
