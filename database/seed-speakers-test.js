/**
 * Djhina — Seed speakers de test
 * Ajoute 2 événements manquants + 4 speakers avec leurs événements associés
 * Exécution : node database/seed-speakers-test.js
 */
require('dotenv').config();
const { pool } = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  // Récupère le premier organisateur disponible
  const [[org]] = await pool.execute("SELECT id FROM users WHERE role = 'organizer' LIMIT 1");
  if (!org) { console.error('❌ Aucun organisateur trouvé'); process.exit(1); }
  const orgId = org.id;

  // ── Récupère ou crée les événements nécessaires ─────────────────
  async function getOrCreateEvent(titleLike, title, startDate, city) {
    const [[existing]] = await pool.execute(
      'SELECT id FROM events WHERE title LIKE ? LIMIT 1',
      [`%${titleLike}%`]
    );
    if (existing) { console.log(`  ↩ Événement existant : ${existing.id} (${title})`); return existing.id; }
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO events (id, organizer_id, title, status, date, city, country)
       VALUES (?, ?, ?, 'published', ?, ?, 'Tchad')`,
      [id, orgId, title, startDate, city]
    );
    console.log(`  ✅ Événement créé : ${id} (${title})`);
    return id;
  }

  const evTedx      = await getOrCreateEvent('TEDx',              'TEDxMoursal — Conférence de PreX',          '2024-11-30', "N'Djamena");
  const evSalon     = await getOrCreateEvent('Salon des Entr',    'Salon des Entrepreneurs du Tchad',          '2025-06-15', "N'Djamena");
  const evFashion   = await getOrCreateEvent('Fashion Week',      'Grand Défilé de Mode — Djhina Fashion Week','2025-03-08', "N'Djamena");
  const evJobBoost  = await getOrCreateEvent('Job Booster',       'Job Booster — Forum Emploi & Carrières',    '2025-09-20', "N'Djamena");

  // ── Speakers ────────────────────────────────────────────────────
  const speakers = [
    {
      name:      'Djessada Ndolembaye',
      job_title: 'Entrepreneur & Conférencier TED',
      company:   'TEDxMoursal',
      bio:       "Passionné par l'innovation et le développement durable au Tchad, Djessada est l'un des visages du mouvement TEDx à N'Djamena. Il partage sa vision d'un Tchad entrepreneur et connecté.",
      event_id:  evTedx,
    },
    {
      name:      'Edgard Djerassem',
      job_title: 'Fondateur & CEO',
      company:   'Djerassem Consulting Group',
      bio:       "Expert en développement des PME en Afrique centrale, Edgard accompagne les jeunes entrepreneurs tchadiens dans la structuration et la croissance de leurs entreprises.",
      event_id:  evSalon,
    },
    {
      name:      'Marina Gora Gadji',
      job_title: 'Styliste & Directrice Artistique',
      company:   'Djhina Fashion',
      bio:       "Créatrice de mode tchadienne reconnue sur la scène africaine, Marina mêle l'authenticité des textiles traditionnels aux tendances contemporaines. Elle est la tête de proue de la Djhina Fashion Week.",
      event_id:  evFashion,
    },
    {
      name:      'Yacinthe Ndolenodji',
      job_title: 'DRH & Coach Carrière',
      company:   'Talent Hub Tchad',
      bio:       "Spécialiste des ressources humaines et du développement professionnel, Yacinthe aide les jeunes diplômés tchadiens à trouver leur voie et à décrocher des opportunités d'emploi de qualité.",
      event_id:  evJobBoost,
    },
  ];

  for (const sp of speakers) {
    const [[exists]] = await pool.execute(
      'SELECT id FROM speakers WHERE name = ? LIMIT 1',
      [sp.name]
    );
    if (exists) {
      console.log(`  ↩ Speaker existant : ${sp.name}`);
      continue;
    }
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO speakers (id, organizer_id, name, bio, job_title, company, social_links)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, sp.name, sp.bio, sp.job_title, sp.company, JSON.stringify({})]
    );
    console.log(`  ✅ Speaker créé : ${sp.name} (event: ${sp.event_id})`);
  }

  console.log('\n🎉 Seed speakers terminé.');
  process.exit(0);
}

seed().catch(e => { console.error('❌', e.message); process.exit(1); });
