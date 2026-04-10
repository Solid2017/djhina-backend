/**
 * Reset complet de la base Railway :
 * 1. Supprime les tables agenda (qui bloquaient)
 * 2. Re-crée tout depuis schema.sql
 * 3. Lance migrate-agenda.js
 * 4. Lance les seeds
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const cfg = {
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  multipleStatements: true,
};

async function run() {
  const conn = await mysql.createConnection(cfg);
  console.log('✓ Connecté à', process.env.DB_HOST);

  // 1. Désactiver FK + drop tout
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(r => Object.values(r)[0]);
  if (tableNames.length) {
    console.log('Drop:', tableNames.join(', '));
    await conn.query(`DROP TABLE IF EXISTS ${tableNames.map(t => '`' + t + '`').join(',')}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('✓ Base vidée');

  // 2. Schema principal
  const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query(schema);
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('✓ Schema principal appliqué');

  // 3. Schema agenda
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  const agendaQueries = [
    `CREATE TABLE IF NOT EXISTS speakers (
      id           VARCHAR(36)  NOT NULL PRIMARY KEY,
      organizer_id VARCHAR(36)  NOT NULL,
      name         VARCHAR(150) NOT NULL,
      bio          TEXT,
      photo        VARCHAR(500),
      job_title    VARCHAR(200),
      company      VARCHAR(200),
      email        VARCHAR(150),
      phone        VARCHAR(30),
      social_links JSON,
      is_active    TINYINT(1)  NOT NULL DEFAULT 1,
      created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_speakers_organizer FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS agenda_sessions (
      id                VARCHAR(36)   NOT NULL PRIMARY KEY,
      event_id          VARCHAR(36)   NOT NULL,
      title             VARCHAR(300)  NOT NULL,
      description       TEXT,
      room              VARCHAR(150),
      type              ENUM('keynote','conference','workshop','panel','networking','break','other') NOT NULL DEFAULT 'conference',
      start_time        DATETIME      NOT NULL,
      end_time          DATETIME,
      capacity          INT           DEFAULT NULL,
      registered        INT           NOT NULL DEFAULT 0,
      access_conditions TEXT,
      order_index       INT           NOT NULL DEFAULT 0,
      is_visible        TINYINT(1)   NOT NULL DEFAULT 1,
      created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_sessions_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS session_speakers (
      id         VARCHAR(36) NOT NULL PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      speaker_id VARCHAR(36) NOT NULL,
      role       ENUM('speaker','moderator','panelist','facilitator') NOT NULL DEFAULT 'speaker',
      UNIQUE KEY uniq_ss (session_id, speaker_id),
      CONSTRAINT fk_ss_session FOREIGN KEY (session_id) REFERENCES agenda_sessions(id) ON DELETE CASCADE,
      CONSTRAINT fk_ss_speaker FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS session_bookings (
      id         VARCHAR(36) NOT NULL PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      user_id    VARCHAR(36) NOT NULL,
      status     ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_sb (session_id, user_id),
      CONSTRAINT fk_sb_session FOREIGN KEY (session_id) REFERENCES agenda_sessions(id) ON DELETE CASCADE,
      CONSTRAINT fk_sb_user   FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS speaker_messages (
      id         VARCHAR(36) NOT NULL PRIMARY KEY,
      speaker_id VARCHAR(36) NOT NULL,
      user_id    VARCHAR(36) NOT NULL,
      event_id   VARCHAR(36) DEFAULT NULL,
      content    TEXT        NOT NULL,
      reply      TEXT,
      replied_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sm_speaker FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE CASCADE,
      CONSTRAINT fk_sm_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_sm_event   FOREIGN KEY (event_id)   REFERENCES events(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
  for (const q of agendaQueries) await conn.query(q);
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('✓ Tables agenda créées');

  // 4. Seed SQL
  const seed = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');
  await conn.query(seed);
  console.log('✓ Seed SQL appliqué');

  // Vérif finale
  const [rows] = await conn.query('SHOW TABLES');
  console.log('\n📋 Tables créées:', rows.map(r => Object.values(r)[0]).join(', '));

  await conn.end();
  console.log('\n✅ Reset terminé !');
}

run().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
