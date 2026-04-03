/**
 * Djhina — Seed TEDxMoursal Conférence de PreX
 * Exécution : node database/seed-tedx-moursal.js
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../src/config/database');

async function seed() {
  const conn = await pool.getConnection();
  try {
    // Récupérer la catégorie "conference"
    const [cats] = await conn.query("SELECT id FROM categories WHERE slug = 'conference' LIMIT 1");
    const categoryId = cats.length ? cats[0].id : null;

    // Récupérer le premier admin/organizer disponible
    const [orgs] = await conn.query(
      "SELECT id, name FROM users WHERE role IN ('organizer','admin') ORDER BY created_at ASC LIMIT 1"
    );
    if (!orgs.length) throw new Error('Aucun organisateur trouvé.');
    const organizerId = orgs[0].id;

    console.log('📋 Catégorie conférence :', categoryId || '(non trouvée, null)');
    console.log('👤 Organisateur :', orgs[0].name);

    // Vérifier si l'événement existe déjà
    const [existing] = await conn.query(
      "SELECT id FROM events WHERE title = 'TEDxMoursal — Conférence de PreX' LIMIT 1"
    );
    if (existing.length) {
      console.log('⏭️  Déjà présent : TEDxMoursal — Conférence de PreX');
      return;
    }

    const eventId = uuidv4();

    await conn.query(
      `INSERT INTO events
        (id, organizer_id, category_id, title, subtitle, description,
         cover_image, date, time, end_time, location, city, country,
         capacity, is_featured, tags, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        eventId,
        organizerId,
        categoryId,
        'TEDxMoursal — Conférence de PreX',
        'Conférence de PreX par TEDxMoursal',
        `La Conférence de PreX est un événement TEDx organisé par TEDxMoursal à N'Djaména.\n\nCet événement rassemble des speakers inspirants pour partager des idées qui valent la peine d'être diffusées, dans l'esprit des conférences TED internationales.\n\nUne après-midi d'idées, de partage et d'inspiration au cœur du quartier Moursal de N'Djaména.\n\nSuivez @TEDxMoursal pour plus d'informations.`,
        null, // cover_image (à uploader via l'admin)
        '2024-11-30',
        '15:00',
        null,
        'Restaurant Selesao',
        "N'Djaména",
        'Tchad',
        200,
        0, // is_featured
        JSON.stringify(['TEDx', 'conférence', 'Moursal', 'PreX', "N'Djaména", 'idées']),
        'published',
      ]
    );

    // Types de billets
    const ticketTypes = [
      { name: 'Entrée PreX',   price: 0,     available: 150 },
      { name: 'Place VIP',     price: 10000, available: 50  },
    ];

    for (const tt of ticketTypes) {
      await conn.query(
        `INSERT INTO ticket_types (id, event_id, name, price, currency, available, color, is_active)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          uuidv4(), eventId, tt.name,
          tt.price, 'XAF', tt.available,
          tt.price === 0 ? '#16a34a' : '#0000FF',
          1,
        ]
      );
    }

    console.log('✅ Inséré : TEDxMoursal — Conférence de PreX (2024-11-30)');

  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
