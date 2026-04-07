/**
 * Seed : sessions + speakers pour tous les événements sans session
 */
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const pool = mysql.createPool({
  host: 'localhost', user: 'root', password: '', database: 'djhina_db',
});

// Speakers existants
const SP = {
  djessada: '03dcb956-7c9d-428c-982d-86205db6d02c',
  edgard:   '6ee3812c-c3b1-4d50-bb09-181d2dd82a62',
  marina:   '98c912b6-10a2-42fe-bfd1-eafab80f2f4a',
  yacinthe: 'a2933bbe-3a54-469b-b923-c2ff57466854',
  hal:      '5164affd-7261-448b-8c91-f7733d9e7aa1',
};

// Sera rempli depuis la DB
let ORGANIZER_ID = null;

// Évènements sans sessions
const EVENTS = {
  femmes:    '21b0f4ba-0dc3-426b-a04c-1107c7837916', // Conférence des Femmes Africaines
  dary:      '5a1948f9-70cf-4630-8f9d-8675a1d79cb7', // Festival Dary
  danses:    '83e77fcd-f10d-4af1-85d7-e2ef4319631c', // Festival des Danses et Traditions
  mongoh:    'b311251a-b3ec-4f41-94ab-2c58cab9e0ba', // Festival des Arts et Cultures Mongoh
  tokn:      '0787373d-f784-4ca8-a976-12bcf4e0b70d', // Festival Tokn Massana
  fashion2:  '39cda43f-1332-4e60-bf18-56ff34449259', // Défilé de Mode Djhina Fashion Week
  concert:   '843f2ef5-9570-4939-98c4-2a28077c035e', // Concert Afrobeat Night
  football:  '8ce643d1-540e-4022-85ba-92283adfba6d', // Tournoi de Football
  forum:     'b597a89c-5e19-4f6c-84c1-0d1a2928d5aa', // Forum Business & Innovation
};

async function createSpeaker(name, job_title, company, bio) {
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO speakers (id, organizer_id, name, job_title, company, bio, is_active, social_links, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, '{}', NOW())`,
    [id, ORGANIZER_ID, name, job_title, company, bio]
  );
  console.log(`  ✓ Speaker créé: ${name}`);
  return id;
}

async function createSession(eventId, title, type, startTime, endTime, room, description) {
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO agenda_sessions (id, event_id, title, type, start_time, end_time, room, description, is_visible, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())`,
    [id, eventId, title, type, startTime, endTime || null, room || null, description || null]
  );
  return id;
}

async function linkSpeaker(sessionId, speakerId, role = 'speaker') {
  await pool.execute(
    `INSERT IGNORE INTO session_speakers (id, session_id, speaker_id, role) VALUES (?, ?, ?, ?)`,
    [uuidv4(), sessionId, speakerId, role]
  );
}

(async () => {
  try {
    // Récupérer un organizer_id valide
    const [[orgUser]] = await pool.query('SELECT id FROM users WHERE role = "organizer" LIMIT 1');
    ORGANIZER_ID = orgUser.id;
    console.log('Organizer ID:', ORGANIZER_ID.slice(0,8));
    console.log('=== Création des sessions et speakers ===\n');

    // ── 1. Conférence des Femmes Africaines ─────────────────────────
    console.log('1. Conférence des Femmes Africaines…');
    const aissatou = await createSpeaker(
      'Aissatou Mahamat', 'Ministre & Militante des droits',
      'Gouvernement du Tchad',
      'Pionnière de l\'égalité femme-homme en Afrique centrale, Aissatou Mahamat œuvre depuis 20 ans pour la représentation politique des femmes.'
    );
    const fatima = await createSpeaker(
      'Fatima Ali Dicko', 'Présidente', 'Réseau des Femmes Africaines',
      'Fondatrice du Réseau des Femmes Africaines Ministres et Parlementaires, Fatima accompagne les femmes leaders du continent.'
    );
    const sess1a = await createSession(EVENTS.femmes, 'Leadership féminin au cœur de l\'Afrique', 'keynote', '09:00:00', '10:00:00', 'Grande Salle', 'La place des femmes dans les institutions politiques africaines : état des lieux et perspectives.');
    const sess1b = await createSession(EVENTS.femmes, 'Table ronde : briser les plafonds de verre', 'panel', '10:30:00', '12:00:00', 'Salle des Conférences', 'Témoignages et stratégies de femmes ministres, parlementaires et chefs d\'entreprise du continent.');
    await linkSpeaker(sess1a, aissatou, 'keynote');
    await linkSpeaker(sess1b, fatima, 'moderateur');
    await linkSpeaker(sess1b, aissatou, 'speaker');
    console.log('  ✓ 2 sessions créées\n');

    // ── 2. Festival Dary ─────────────────────────────────────────────
    console.log('2. Festival Dary…');
    const moussa = await createSpeaker(
      'Moussa Koné', 'Directeur Artistique', 'Festival Dary',
      'Directeur artistique du Festival Dary depuis sa création, Moussa Koné est l\'âme de la célébration culturelle tchadienne.'
    );
    const sess2a = await createSession(EVENTS.dary, 'Cérémonie d\'ouverture — Spectacle Traditionnel', 'keynote', '16:00:00', '17:30:00', 'Scène Principale', 'Spectacle de bienvenue mêlant danses traditionnelles des différentes ethnies du Tchad.');
    const sess2b = await createSession(EVENTS.dary, 'Showcase : Artistes Émergents Tchadiens', 'conference', '19:00:00', '21:00:00', 'Scène Principale', 'Concert live des talents musicaux montants du Tchad.');
    await linkSpeaker(sess2a, moussa, 'speaker');
    await linkSpeaker(sess2b, moussa, 'moderateur');
    console.log('  ✓ 2 sessions créées\n');

    // ── 3. Festival des Danses et Traditions ─────────────────────────
    console.log('3. Festival des Danses et Traditions…');
    const abel = await createSpeaker(
      'Abel Ngaradoumbé', 'Ethnographe & Chorégraphe', 'Centre Culturel Al-Mouna',
      'Expert en danses traditionnelles tchadiennes, Abel Ngaradoumbé a documenté plus de 50 formes de danses rituelles et festives du Tchad.'
    );
    const sess3a = await createSession(EVENTS.danses, 'Introduction aux danses rituelles du Tchad', 'conference', '10:00:00', '11:00:00', 'Scène Culturelle', 'Présentation et démonstration des principales danses rituelles des ethnies Sara, Kanem et Bornou.');
    const sess3b = await createSession(EVENTS.danses, 'Atelier de danse traditionnelle ouverte au public', 'workshop', '14:00:00', '16:00:00', 'Espace Ouvert', 'Initiation aux pas de base de 3 danses traditionnelles tchadiennes. Accessible à tous.');
    await linkSpeaker(sess3a, abel, 'speaker');
    await linkSpeaker(sess3b, abel, 'speaker');
    console.log('  ✓ 2 sessions créées\n');

    // ── 4. Festival des Arts Mongoh ───────────────────────────────────
    console.log('4. Festival des Arts Mongoh…');
    const naomi = await createSpeaker(
      'Naomi Djangrang', 'Artiste Plasticienne', 'Studio Mongoh',
      'Artiste plasticienne reconnue, Naomi Djangrang fusionne art contemporain et motifs traditionnels Mongoh dans ses œuvres exposées en Afrique et en Europe.'
    );
    const sess4a = await createSession(EVENTS.mongoh, 'Exposition inaugurale : Art Mongoh contemporain', 'conference', '10:00:00', '11:30:00', 'Galerie Principale', 'Vernissage et présentation des œuvres des artistes de la communauté Mongoh.');
    const sess4b = await createSession(EVENTS.mongoh, 'Conférence : Préserver l\'art traditionnel à l\'ère numérique', 'conference', '14:00:00', '15:30:00', 'Salle de Conférences', 'Comment utiliser le numérique pour archiver et promouvoir le patrimoine artistique africain.');
    await linkSpeaker(sess4a, naomi, 'speaker');
    await linkSpeaker(sess4b, naomi, 'speaker');
    console.log('  ✓ 2 sessions créées\n');

    // ── 5. Festival Tokn Massana ──────────────────────────────────────
    console.log('5. Festival Tokn Massana…');
    const ibrahim = await createSpeaker(
      'Ibrahim Ahmat Khalil', 'Chef de Communauté', 'Communauté Tokn Massana',
      'Chef traditionnel et gardien des savoirs ancestraux de la communauté Tokn Massana, Ibrahim transmet les rites et traditions depuis 30 ans.'
    );
    const sess5a = await createSession(EVENTS.tokn, 'Ouverture : Rites traditionnels Tokn Massana', 'keynote', '09:00:00', '10:30:00', 'Espace Sacré', 'Cérémonie d\'ouverture avec les rites traditionnels de bienvenue de la communauté Tokn Massana.');
    const sess5b = await createSession(EVENTS.tokn, 'Transmission orale : Contes et légendes Massana', 'conference', '11:00:00', '12:30:00', 'Arbre à Palabres', 'Séance de contes et récits traditionnels transmis de génération en génération.');
    await linkSpeaker(sess5a, ibrahim, 'speaker');
    await linkSpeaker(sess5b, ibrahim, 'speaker');
    console.log('  ✓ 2 sessions créées\n');

    // ── 6. Défilé de Mode Djhina Fashion Week (2ème édition) ─────────
    console.log('6. Défilé de Mode Djhina Fashion Week…');
    // Marina existe déjà
    const sess6a = await createSession(EVENTS.fashion2, 'Backstage Talk : La mode africaine en 2026', 'conference', '14:00:00', '15:00:00', 'Studio Backstage', 'Marina Gora Gadji partage sa vision de la mode africaine sur la scène internationale et les tendances 2026.');
    const sess6b = await createSession(EVENTS.fashion2, 'Grand Défilé — Collections Printemps-Été', 'keynote', '18:00:00', '20:00:00', 'Podium Principal', 'Présentation des collections de 12 créateurs africains sur le thème "Racines & Modernité".');
    await linkSpeaker(sess6a, SP.marina, 'speaker');
    await linkSpeaker(sess6b, SP.marina, 'speaker');
    console.log('  ✓ 2 sessions créées\n');

    // ── 7. Concert Afrobeat Night ─────────────────────────────────────
    console.log('7. Concert Afrobeat Night…');
    const dj = await createSpeaker(
      'DJ Karibu', 'DJ & Producteur Musical', 'Karibu Music',
      'DJ Karibu est le producteur afrobeat le plus en vue du Tchad. Ses sets explosifs mêlent afrobeat, coupé-décalé et électro africaine.'
    );
    const sess7a = await createSession(EVENTS.concert, 'Warm-Up : DJ Set afrobeat', 'conference', '20:00:00', '21:00:00', 'Scène Principale', 'DJ Karibu ouvre la soirée avec un set afrobeat pour chauffer la salle.');
    const sess7b = await createSession(EVENTS.concert, 'Concert Live — Têtes d\'affiche', 'keynote', '21:30:00', '00:00:00', 'Scène Principale', 'Concert live des artistes headliners de la soirée afrobeat.');
    await linkSpeaker(sess7a, dj, 'speaker');
    await linkSpeaker(sess7b, dj, 'moderateur');
    console.log('  ✓ 2 sessions créées\n');

    // ── 8. Tournoi de Football ────────────────────────────────────────
    console.log('8. Tournoi de Football…');
    const coach = await createSpeaker(
      'Jean-Baptiste Nguinaldo', 'Coach Sportif', 'Fédération de Football du Tchad',
      'Ancien international tchadien et coach reconnu, Jean-Baptiste Nguinaldo forme la nouvelle génération de footballeurs à N\'Djaména.'
    );
    const sess8a = await createSession(EVENTS.football, 'Cérémonie d\'ouverture & présentation des équipes', 'conference', '08:00:00', '09:00:00', 'Stade Municipal', 'Accueil des 16 équipes participantes et présentation du règlement du tournoi.');
    const sess8b = await createSession(EVENTS.football, 'Masterclass : Tactiques et mental du footballeur', 'workshop', '12:00:00', '13:30:00', 'Salle de réunion du Stade', 'Conférence technique sur les tactiques modernes et la préparation mentale du sportif de haut niveau.');
    await linkSpeaker(sess8a, coach, 'speaker');
    await linkSpeaker(sess8b, coach, 'speaker');
    console.log('  ✓ 2 sessions créées\n');

    // ── 9. Forum Business & Innovation ───────────────────────────────
    console.log('9. Forum Business & Innovation…');
    // Edgard et Hal existent déjà
    const diane = await createSpeaker(
      'Diane Bégoto Miarom', 'Directrice Générale', 'Invest Tchad',
      'Économiste et spécialiste de l\'investissement en Afrique centrale, Diane Bégoto Miarom accompagne les startups tchadiennes vers les marchés internationaux.'
    );
    const sess9a = await createSession(EVENTS.forum, 'Keynote : L\'écosystème startup en Afrique centrale', 'keynote', '09:00:00', '10:00:00', 'Amphithéâtre', 'État des lieux de l\'innovation et de l\'entrepreneuriat en Afrique centrale : chiffres, défis et opportunités 2026.');
    const sess9b = await createSession(EVENTS.forum, 'Panel : Financement et croissance des PME tchadiennes', 'panel', '10:30:00', '12:00:00', 'Salle de Conférences A', 'Comment accéder aux financements locaux et internationaux pour développer son entreprise au Tchad.');
    const sess9c = await createSession(EVENTS.forum, 'Atelier : Pitch & Présentation investisseurs', 'workshop', '14:00:00', '16:00:00', 'Salle B', 'Techniques pour convaincre des investisseurs : pitch deck, storytelling et Q&A en conditions réelles.');
    await linkSpeaker(sess9a, diane, 'keynote');
    await linkSpeaker(sess9b, SP.edgard, 'speaker');
    await linkSpeaker(sess9b, diane, 'moderateur');
    await linkSpeaker(sess9c, SP.hal, 'speaker');
    console.log('  ✓ 3 sessions créées\n');

    // ── Vérification finale ───────────────────────────────────────────
    const [check] = await pool.query(
      `SELECT e.title, COUNT(ag.id) as sessions, COUNT(ss.id) as links
       FROM events e
       LEFT JOIN agenda_sessions ag ON ag.event_id = e.id AND ag.is_visible = 1
       LEFT JOIN session_speakers ss ON ss.session_id = ag.id
       WHERE e.status = 'published'
       GROUP BY e.id, e.title
       ORDER BY sessions DESC`
    );
    console.log('=== RÉSULTAT FINAL ===');
    check.forEach(r => console.log(`  [${r.sessions} session(s), ${r.links} speaker(s)] ${r.title.slice(0,45)}`));

    await pool.end();
    console.log('\n✅ Seed terminé avec succès !');
  } catch (e) {
    console.error('ERREUR:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
