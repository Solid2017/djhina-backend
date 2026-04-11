require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const cfg = {
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function run() {
  const conn = await mysql.createConnection(cfg);

  // Récupérer les IDs nécessaires
  const [[cat_festival]]    = await conn.query('SELECT id FROM categories WHERE slug="festival"');
  const [[cat_music]]       = await conn.query('SELECT id FROM categories WHERE slug="music"');
  const [[cat_sport]]       = await conn.query('SELECT id FROM categories WHERE slug="sport"');
  const [[cat_business]]    = await conn.query('SELECT id FROM categories WHERE slug="business"');
  const [[cat_conference]]  = await conn.query('SELECT id FROM categories WHERE slug="conference"');
  const [[organizer]]       = await conn.query('SELECT id FROM users WHERE role="organizer" LIMIT 1');

  const org = organizer.id;

  const events = [
    {
      id: uuidv4(), title: 'Festival des Cultures Tokn Massana du Tchad 2026',
      subtitle: 'Célébration des traditions ancestrales de la communauté Tokn Massana',
      date: '2026-08-15', end_time: '2026-08-17 22:00:00', time: '09:00:00',
      location: 'Esplanade du Palais de la Culture', city: "N'Djamena", country: 'Tchad',
      category_id: cat_festival.id, organizer_id: org, status: 'published',
      capacity: 3000, cover_image: null, is_featured: 1,
    },
    {
      id: uuidv4(), title: 'Concert Afrobeat Night',
      subtitle: 'La nuit des rythmes africains à N\'Djaména',
      date: '2026-09-05', end_time: '2026-09-06 01:00:00', time: '20:00:00',
      location: 'Stade Idriss Mahamat Ouya', city: "N'Djamena", country: 'Tchad',
      category_id: cat_music.id, organizer_id: org, status: 'published',
      capacity: 5000, cover_image: null, is_featured: 1,
    },
    {
      id: uuidv4(), title: 'Tournoi de Football Inter-Quartiers',
      subtitle: 'Compétition sportive réunissant les quartiers de N\'Djaména',
      date: '2026-09-20', end_time: '2026-09-21 18:00:00', time: '08:00:00',
      location: 'Stade Municipal de N\'Djaména', city: "N'Djamena", country: 'Tchad',
      category_id: cat_sport.id, organizer_id: org, status: 'published',
      capacity: 2000, cover_image: null, is_featured: 0,
    },
    {
      id: uuidv4(), title: 'Forum Business & Innovation Tchad',
      subtitle: 'Le rendez-vous des entrepreneurs et investisseurs d\'Afrique centrale',
      date: '2026-10-10', end_time: '2026-10-11 18:00:00', time: '09:00:00',
      location: 'Radisson Blu Hotel', city: "N'Djamena", country: 'Tchad',
      category_id: cat_business.id, organizer_id: org, status: 'published',
      capacity: 500, cover_image: null, is_featured: 1,
    },
    {
      id: uuidv4(), title: 'Job Booster — Forum Emploi & Carrières',
      subtitle: 'Rencontrez les recruteurs et boostez votre carrière',
      date: '2026-11-14', end_time: null, time: '08:00:00',
      location: 'Palais du 15 Janvier', city: "N'Djamena", country: 'Tchad',
      category_id: cat_conference.id, organizer_id: org, status: 'published',
      capacity: 1000, cover_image: null, is_featured: 0,
    },
  ];

  let inserted = 0;
  for (const ev of events) {
    const [existing] = await conn.query('SELECT id FROM events WHERE title = ?', [ev.title]);
    if (existing.length > 0) {
      console.log('Déjà présent:', ev.title.substring(0, 40));
      continue;
    }
    await conn.execute(
      `INSERT INTO events (id, title, subtitle, date, end_time, time, location, city, country,
        category_id, organizer_id, status, capacity, cover_image, is_featured, registered, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [ev.id, ev.title, ev.subtitle, ev.date, ev.end_time, ev.time,
       ev.location, ev.city, ev.country, ev.category_id, ev.organizer_id,
       ev.status, ev.capacity, ev.cover_image, ev.is_featured]
    );
    console.log('✅ Inséré:', ev.title.substring(0, 50));
    inserted++;
  }

  const [[total]] = await conn.query('SELECT COUNT(*) as n FROM events WHERE status="published"');
  console.log(`\n✅ ${inserted} événements ajoutés — Total: ${total.n} événements publiés`);
  await conn.end();
}

run().catch(e => console.error('❌', e.message));
