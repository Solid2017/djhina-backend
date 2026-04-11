/**
 * Seed : sessions + speakers pour tous les événements
 * Utilise les variables d'environnement pour la connexion DB
 * Trouve les événements dynamiquement par titre
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME     || 'djhina_db',
});

let ORGANIZER_ID = null;

async function findEvent(keyword) {
  const [[row]] = await pool.query(
    'SELECT id, date FROM events WHERE title LIKE ? LIMIT 1',
    [`%${keyword}%`]
  );
  return row || null;
}

async function createSpeaker(name, job_title, company, bio) {
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO speakers (id, organizer_id, name, job_title, company, bio, is_active, social_links, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, '{}', NOW())`,
    [id, ORGANIZER_ID, name, job_title, company, bio || '']
  );
  console.log(`  ✓ Speaker créé: ${name}`);
  return id;
}

async function createSession(eventId, eventDate, title, type, startHour, endHour, room, description) {
  const id = uuidv4();
  const dateStr = eventDate ? eventDate.toISOString().split('T')[0] : '2026-01-01';
  const startTime = `${dateStr} ${startHour}:00`;
  const endTime   = endHour ? `${dateStr} ${endHour}:00` : null;
  await pool.execute(
    `INSERT INTO agenda_sessions (id, event_id, title, type, start_time, end_time, room, description, is_visible, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())`,
    [id, eventId, title, type, startTime, endTime, room || null, description || null]
  );
  return id;
}

async function linkSpeaker(sessionId, speakerId, role) {
  await pool.execute(
    `INSERT IGNORE INTO session_speakers (id, session_id, speaker_id, role) VALUES (?, ?, ?, ?)`,
    [uuidv4(), sessionId, speakerId, role || 'speaker']
  );
}

(async () => {
  try {
    const [[orgUser]] = await pool.query('SELECT id FROM users WHERE role = "organizer" LIMIT 1');
    ORGANIZER_ID = orgUser.id;
    console.log('Organizer ID:', ORGANIZER_ID.slice(0, 8));
    console.log('=== Création des sessions et speakers ===\n');

    // 1. Conférence des Femmes Africaines
    const ev1 = await findEvent('Femmes Africaines');
    if (ev1) {
      console.log('1. Conférence des Femmes Africaines…');
      const aissatou = await createSpeaker('Aissatou Mahamat', 'Ministre & Militante des droits', 'Gouvernement du Tchad', 'Pionnière de l\'égalité femme-homme en Afrique centrale.');
      const fatima   = await createSpeaker('Fatima Ali Dicko', 'Présidente', 'Réseau des Femmes Africaines', 'Fondatrice du Réseau des Femmes Africaines Ministres et Parlementaires.');
      const s1a = await createSession(ev1.id, ev1.date, 'Leadership féminin au cœur de l\'Afrique', 'keynote', '09:00', '10:00', 'Grande Salle', 'La place des femmes dans les institutions politiques africaines.');
      const s1b = await createSession(ev1.id, ev1.date, 'Table ronde : briser les plafonds de verre', 'panel', '10:30', '12:00', 'Salle des Conférences', 'Témoignages de femmes ministres et parlementaires.');
      await linkSpeaker(s1a, aissatou, 'speaker');
      await linkSpeaker(s1b, fatima, 'moderator');
      await linkSpeaker(s1b, aissatou, 'speaker');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 2. Festival Dary
    const ev2 = await findEvent('Festival Dary');
    if (ev2) {
      console.log('2. Festival Dary…');
      const moussa = await createSpeaker('Moussa Koné', 'Directeur Artistique', 'Festival Dary', 'Directeur artistique du Festival Dary depuis sa création.');
      const s2a = await createSession(ev2.id, ev2.date, 'Cérémonie d\'ouverture — Spectacle Traditionnel', 'keynote', '16:00', '17:30', 'Scène Principale', 'Danses traditionnelles des ethnies du Tchad.');
      const s2b = await createSession(ev2.id, ev2.date, 'Showcase : Artistes Émergents Tchadiens', 'conference', '19:00', '21:00', 'Scène Principale', 'Concert live des talents musicaux du Tchad.');
      await linkSpeaker(s2a, moussa, 'speaker');
      await linkSpeaker(s2b, moussa, 'moderator');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 3. Festival des Danses et Traditions
    const ev3 = await findEvent('Danses et Traditions');
    if (ev3) {
      console.log('3. Festival des Danses et Traditions…');
      const abel = await createSpeaker('Abel Ngaradoumbé', 'Ethnographe & Chorégraphe', 'Centre Culturel Al-Mouna', 'Expert en danses traditionnelles tchadiennes.');
      const s3a = await createSession(ev3.id, ev3.date, 'Introduction aux danses rituelles du Tchad', 'conference', '10:00', '11:00', 'Scène Culturelle', 'Démonstration des danses rituelles Sara, Kanem et Bornou.');
      const s3b = await createSession(ev3.id, ev3.date, 'Atelier de danse traditionnelle', 'workshop', '14:00', '16:00', 'Espace Ouvert', 'Initiation aux danses traditionnelles tchadiennes.');
      await linkSpeaker(s3a, abel, 'speaker');
      await linkSpeaker(s3b, abel, 'speaker');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 4. Festival des Arts Mongoh
    const ev4 = await findEvent('Mongoh');
    if (ev4) {
      console.log('4. Festival des Arts Mongoh…');
      const naomi = await createSpeaker('Naomi Djangrang', 'Artiste Plasticienne', 'Studio Mongoh', 'Artiste plasticienne fusionnant art contemporain et motifs Mongoh.');
      const s4a = await createSession(ev4.id, ev4.date, 'Exposition inaugurale : Art Mongoh contemporain', 'conference', '10:00', '11:30', 'Galerie Principale', 'Vernissage des œuvres des artistes Mongoh.');
      const s4b = await createSession(ev4.id, ev4.date, 'Conférence : Préserver l\'art traditionnel', 'conference', '14:00', '15:30', 'Salle de Conférences', 'Utiliser le numérique pour préserver le patrimoine artistique africain.');
      await linkSpeaker(s4a, naomi, 'speaker');
      await linkSpeaker(s4b, naomi, 'speaker');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 5. Festival Tokn Massana
    const ev5 = await findEvent('Tokn');
    if (ev5) {
      console.log('5. Festival Tokn Massana…');
      const ibrahim = await createSpeaker('Ibrahim Ahmat Khalil', 'Chef de Communauté', 'Communauté Tokn Massana', 'Gardien des savoirs ancestraux de la communauté Tokn Massana.');
      const s5a = await createSession(ev5.id, ev5.date, 'Ouverture : Rites traditionnels Tokn Massana', 'keynote', '09:00', '10:30', 'Espace Sacré', 'Cérémonie d\'ouverture avec rites traditionnels.');
      const s5b = await createSession(ev5.id, ev5.date, 'Contes et légendes Massana', 'conference', '11:00', '12:30', 'Arbre à Palabres', 'Récits traditionnels transmis de génération en génération.');
      await linkSpeaker(s5a, ibrahim, 'speaker');
      await linkSpeaker(s5b, ibrahim, 'speaker');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 6. Défilé de Mode / Fashion Week
    const ev6 = await findEvent('Fashion Week');
    if (ev6) {
      console.log('6. Défilé de Mode Djhina Fashion Week…');
      const marina = await createSpeaker('Marina Gora Gadji', 'Styliste', 'Djhina Fashion', 'Créatrice de mode tchadienne reconnue sur la scène africaine.');
      const s6a = await createSession(ev6.id, ev6.date, 'Backstage Talk : La mode africaine en 2026', 'conference', '14:00', '15:00', 'Studio Backstage', 'Vision de la mode africaine sur la scène internationale.');
      const s6b = await createSession(ev6.id, ev6.date, 'Grand Défilé — Collections Printemps-Été', 'keynote', '18:00', '20:00', 'Podium Principal', 'Collections de 12 créateurs africains.');
      await linkSpeaker(s6a, marina, 'speaker');
      await linkSpeaker(s6b, marina, 'speaker');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 7. Concert Afrobeat
    const ev7 = await findEvent('Afrobeat');
    if (ev7) {
      console.log('7. Concert Afrobeat Night…');
      const dj = await createSpeaker('DJ Karibu', 'DJ & Producteur Musical', 'Karibu Music', 'DJ Karibu est le producteur afrobeat le plus en vue du Tchad.');
      const s7a = await createSession(ev7.id, ev7.date, 'Warm-Up : DJ Set afrobeat', 'conference', '20:00', '21:00', 'Scène Principale', 'Set afrobeat d\'ouverture.');
      const s7b = await createSession(ev7.id, ev7.date, 'Concert Live — Têtes d\'affiche', 'keynote', '21:30', '23:59', 'Scène Principale', 'Concert live des artistes headliners.');
      await linkSpeaker(s7a, dj, 'speaker');
      await linkSpeaker(s7b, dj, 'moderator');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 8. Tournoi de Football
    const ev8 = await findEvent('Football');
    if (ev8) {
      console.log('8. Tournoi de Football…');
      const coach = await createSpeaker('Jean-Baptiste Nguinaldo', 'Coach Sportif', 'Fédération de Football du Tchad', 'Ancien international tchadien et coach reconnu.');
      const s8a = await createSession(ev8.id, ev8.date, 'Cérémonie d\'ouverture & présentation des équipes', 'conference', '08:00', '09:00', 'Stade Municipal', 'Accueil des 16 équipes participantes.');
      const s8b = await createSession(ev8.id, ev8.date, 'Masterclass : Tactiques du footballeur', 'workshop', '12:00', '13:30', 'Salle de réunion', 'Tactiques modernes et préparation mentale.');
      await linkSpeaker(s8a, coach, 'speaker');
      await linkSpeaker(s8b, coach, 'speaker');
      console.log('  ✓ 2 sessions créées\n');
    }

    // 9. Forum Business & Innovation
    const ev9 = await findEvent('Forum Business');
    if (ev9) {
      console.log('9. Forum Business & Innovation…');
      const diane  = await createSpeaker('Diane Bégoto Miarom', 'Directrice Générale', 'Invest Tchad', 'Économiste spécialiste de l\'investissement en Afrique centrale.');
      const edgard = await createSpeaker('Edgard Djekouma', 'CEO', 'StartupHub Tchad', 'Pionnier de l\'écosystème startup au Tchad.');
      const s9a = await createSession(ev9.id, ev9.date, 'Keynote : L\'écosystème startup en Afrique centrale', 'keynote', '09:00', '10:00', 'Amphithéâtre', 'Innovation et entrepreneuriat en Afrique centrale 2026.');
      const s9b = await createSession(ev9.id, ev9.date, 'Panel : Financement des PME tchadiennes', 'panel', '10:30', '12:00', 'Salle de Conférences A', 'Accéder aux financements pour développer son entreprise au Tchad.');
      const s9c = await createSession(ev9.id, ev9.date, 'Atelier : Pitch & Présentation investisseurs', 'workshop', '14:00', '16:00', 'Salle B', 'Techniques pour convaincre des investisseurs.');
      await linkSpeaker(s9a, diane, 'speaker');
      await linkSpeaker(s9b, edgard, 'speaker');
      await linkSpeaker(s9b, diane, 'moderator');
      await linkSpeaker(s9c, edgard, 'speaker');
      console.log('  ✓ 3 sessions créées\n');
    }

    // 10. Job Booster
    const ev10b = await findEvent('Job Booster');
    if (ev10b) {
      console.log('10. Job Booster — Forum Emploi…');
      const rh = await createSpeaker('Amina Ousmane Brahim', 'DRH', 'Groupe Pétrolier STP', 'Responsable RH avec 15 ans d\'expérience au recrutement au Tchad.');
      const s10b_a = await createSession(ev10b.id, ev10b.date, 'Ouverture : Marchés de l\'emploi en Afrique centrale', 'keynote', '08:00', '09:00', 'Grande Salle', 'Panorama des opportunités d\'emploi et carrières au Tchad en 2026.');
      const s10b_b = await createSession(ev10b.id, ev10b.date, 'Atelier CV & Entretien', 'workshop', '10:00', '12:00', 'Salle Atelier', 'Comment rédiger un CV percutant et réussir ses entretiens.');
      await linkSpeaker(s10b_a, rh, 'speaker');
      await linkSpeaker(s10b_b, rh, 'speaker');
      console.log('  ✓ 2 sessions créées\n');
    }

    // TEDx
    const ev10 = await findEvent('TEDx');
    if (ev10) {
      console.log('10. TEDxMoursal…');
      const prex = await createSpeaker('PreX Djimrangaye', 'Entrepreneur & Speaker TEDx', 'PreX Innovations', 'Entrepreneur tchadien primé, fondateur de plusieurs startups à impact.');
      const s10 = await createSession(ev10.id, ev10.date, 'TEDx Talk : Innover depuis le Tchad', 'keynote', '10:00', '11:30', 'Scène TEDx', 'Des idées qui valent la peine d\'être partagées — vision africaine de l\'innovation.');
      await linkSpeaker(s10, prex, 'speaker');
      console.log('  ✓ 1 session créée\n');
    }

    // Vérification finale
    const [check] = await pool.query(
      `SELECT e.title, COUNT(DISTINCT ag.id) as sessions, COUNT(DISTINCT ss.id) as speakers
       FROM events e
       LEFT JOIN agenda_sessions ag ON ag.event_id = e.id
       LEFT JOIN session_speakers ss ON ss.session_id = ag.id
       WHERE e.status = 'published'
       GROUP BY e.id, e.title
       ORDER BY sessions DESC`
    );
    console.log('=== RÉSULTAT FINAL ===');
    check.forEach(r => console.log(`  [${r.sessions} session(s), ${r.speakers} speaker(s)] ${r.title.slice(0, 45)}`));

    await pool.end();
    console.log('\n✅ Seed terminé avec succès !');
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
})();
