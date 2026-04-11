/**
 * Djhina — Seed des événements 2026
 * Insère les 5 événements depuis les affiches fournies.
 * Exécution : node database/seed-events-2026.js
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../src/config/database');

async function seed() {
  const conn = await pool.getConnection();
  try {
    // ── 1. Récupérer les catégories disponibles ──────────────────
    const [cats] = await conn.query('SELECT id, slug FROM categories');
    const cat = {};
    cats.forEach(c => { cat[c.slug] = c.id; });

    // ── 2. Récupérer les organisateurs disponibles ───────────────
    const [orgs] = await conn.query(
      "SELECT id, name FROM users WHERE role IN ('organizer','admin') ORDER BY created_at ASC"
    );
    if (!orgs.length) throw new Error('Aucun organisateur trouvé. Exécutez d\'abord seed.sql.');

    // Mapper les organisateurs par nom partiel
    const findOrg = (keyword) => {
      const found = orgs.find(o => o.name.toLowerCase().includes(keyword.toLowerCase()));
      return found ? found.id : orgs[0].id; // fallback: premier organisateur
    };

    console.log('📋 Catégories trouvées :', cats.map(c => c.slug).join(', '));
    console.log('👤 Organisateurs trouvés :', orgs.map(o => o.name).join(', '));

    // ── 3. Définition des événements ─────────────────────────────
    const events = [
      {
        title:       'Conférence des Femmes Africaines Ministres et Parlementaires',
        subtitle:    'Sous le Très Haut Patronage du Maréchal Mahamat Idriss Déby Itno',
        description: `Grande conférence internationale réunissant les femmes africaines ministres et parlementaires au Tchad.\n\nThème : « Consolidation du Leadership Féminin Africain pour la Refondation du Tchad »\n\nUn événement majeur sous le patronage du Président de la République, Chef de l'État, qui rassemble des décideurs politiques africains au féminin pour débattre des grandes questions de gouvernance et de développement.`,
        category:    'conference',
        organizer:   'djhina',
        date:        '2026-03-25',
        time:        '09:00',
        end_time:    '2026-03-27 18:00:00',
        location:    'Radisson Blu Hotel',
        city:        "N'Djaména",
        country:     'Tchad',
        capacity:    500,
        tags:        ['conférence', 'leadership féminin', 'Afrique', 'parlementaires', 'ministres'],
        tickets: [
          { name: 'Délégué officiel', price: 0,      available: 200 },
          { name: 'Observateur',      price: 25000,  available: 200 },
          { name: 'Presse',           price: 0,      available: 100 },
        ],
      },
      {
        title:       'Festival des Arts et Cultures Mongoh — 1ère Édition',
        subtitle:    'Appel à Mobilisation',
        description: `Premier festival dédié aux arts et cultures de Mongoh, célébrant la richesse culturelle du Tchad.\n\nThème : « Unité Culturelle au Service du Développement »\n\nQuatre jours de festivités mêlant danses traditionnelles, expositions artistiques, concerts, artisanat local et gastronomie tchadienne. Un moment fort de rassemblement et de valorisation du patrimoine culturel.\n\nContact : 60138522`,
        category:    'culture',
        organizer:   'clens',
        date:        '2026-04-29',
        time:        '10:00',
        end_time:    '2026-05-02 22:00:00',
        location:    'Espace Talino Manu',
        city:        'Mongoh',
        country:     'Tchad',
        capacity:    1000,
        tags:        ['festival', 'arts', 'culture', 'Mongoh', 'traditionnel'],
        tickets: [
          { name: 'Entrée journalière', price: 1000,  available: 500 },
          { name: 'Pass 4 jours',       price: 3000,  available: 300 },
          { name: 'Espace VIP',         price: 10000, available: 100 },
        ],
      },
      {
        title:       'Grand Défilé de Mode — Djhina Fashion Week',
        subtitle:    'La mode africaine à l\'honneur',
        description: `Soirée exceptionnelle de défilé de mode mettant en valeur les créateurs de mode africains et tchadiens.\n\nUne passerelle spectaculaire dans un cadre luxueux, avec des performances artistiques, des collections exclusives alliant modernité et tradition africaine. L'événement glamour incontournable de la saison à N'Djaména.`,
        category:    'fashion',
        organizer:   'Sy',
        date:        '2026-05-15',
        time:        '19:00',
        end_time:    null,
        location:    'Palais du 15 Janvier',
        city:        "N'Djaména",
        country:     'Tchad',
        capacity:    400,
        tags:        ['mode', 'défilé', 'fashion', 'créateurs', 'Afrique'],
        tickets: [
          { name: 'Tribune Standard',  price: 15000, available: 200 },
          { name: 'Tribune VIP',       price: 35000, available: 100 },
          { name: 'Loge Prestige',     price: 75000, available: 50  },
        ],
      },
      {
        title:       'Festival des Danses et Traditions du Tchad',
        subtitle:    'Célébration du patrimoine culturel immatériel',
        description: `Un grand festival populaire réunissant les troupes culturelles et associations de danses traditionnelles de toutes les régions du Tchad.\n\nSpectacles de danses traditionnelles, percussions, chants folkloriques, expositions d'artisanat, démonstrations culinaires des différentes ethnies du pays. Une célébration vivante et colorée de l'identité tchadienne.`,
        category:    'festival',
        organizer:   'taronga',
        date:        '2026-06-20',
        time:        '09:00',
        end_time:    null,
        location:    'Place de la Nation',
        city:        "N'Djaména",
        country:     'Tchad',
        capacity:    2000,
        tags:        ['danses', 'traditions', 'culture', 'patrimoine', 'Tchad'],
        tickets: [
          { name: 'Entrée libre', price: 0,    available: 1500 },
          { name: 'Zone VIP',     price: 5000, available: 200  },
        ],
      },
      {
        title:       'Festival Dary — Notre Pays, nos Merveilles',
        subtitle:    'Découverte et valorisation du tourisme tchadien',
        description: `Le Festival Dary est une célébration des merveilles naturelles, culturelles et humaines du Tchad.\n\nAu programme : expositions photographiques sur les paysages tchadiens, conférences sur le tourisme local, stands artisanaux régionaux, gastronomie tchadienne, concerts de musique traditionnelle et moderne, et animations pour toute la famille.\n\nVenez découvrir les trésors cachés de notre pays !`,
        category:    'festival',
        organizer:   'emeraude',
        date:        '2026-07-10',
        time:        '08:00',
        end_time:    '2026-07-13 20:00:00',
        location:    'Parc de Loisirs de N\'Djaména',
        city:        "N'Djaména",
        country:     'Tchad',
        capacity:    3000,
        tags:        ['Festival Dary', 'tourisme', 'Tchad', 'culture', 'merveilles'],
        tickets: [
          { name: 'Entrée adulte', price: 500,  available: 2000 },
          { name: 'Enfant -12 ans', price: 0,   available: 500  },
          { name: 'Pass famille',   price: 1500, available: 300  },
        ],
      },
    ];

    // ── 4. Insertion des événements ──────────────────────────────
    let insertedCount = 0;

    for (const ev of events) {
      // Vérifier si l'événement existe déjà
      const [existing] = await conn.query(
        'SELECT id FROM events WHERE title = ?', [ev.title]
      );
      if (existing.length) {
        console.log(`⏭️  Déjà présent : ${ev.title}`);
        continue;
      }

      const eventId = uuidv4();
      const categoryId = cat[ev.category] || cat['festival'] || null;
      const organizerId = findOrg(ev.organizer);

      await conn.query(
        `INSERT INTO events
          (id, organizer_id, category_id, title, subtitle, description,
           cover_image, date, time, end_time, location, city, country,
           capacity, is_featured, tags, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          eventId, organizerId, categoryId,
          ev.title, ev.subtitle || null, ev.description || null,
          null, // cover_image (à uploader via l'admin)
          ev.date, ev.time || null, ev.end_time || null,
          ev.location, ev.city, ev.country,
          ev.capacity || 100,
          1, // is_featured
          JSON.stringify(ev.tags || []),
          'published',
        ]
      );

      // Types de billets
      for (const tt of (ev.tickets || [])) {
        await conn.query(
          `INSERT INTO ticket_types (id, event_id, name, price, currency, available, color, is_active)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            uuidv4(), eventId, tt.name,
            tt.price, 'XAF', tt.available,
            tt.price === 0 ? '#16a34a' : tt.price > 20000 ? '#a855f7' : '#0000FF',
            1,
          ]
        );
      }

      console.log(`✅ Inséré : ${ev.title} (${ev.date})`);
      insertedCount++;
    }

    console.log(`\n🎉 Terminé ! ${insertedCount} événement(s) ajouté(s) sur ${events.length}.`);

  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();

