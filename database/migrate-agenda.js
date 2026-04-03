/**
 * Djhina — Migration Agenda & Speakers
 * Crée les tables : speakers, agenda_sessions, session_speakers,
 *                   session_bookings, speaker_messages
 * Exécution : node database/migrate-agenda.js
 */
require('dotenv').config();
const { pool } = require('../src/config/database');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET foreign_key_checks = 0');

    // ── speakers ─────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS speakers (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table speakers');

    // ── agenda_sessions ──────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS agenda_sessions (
        id                VARCHAR(36)   NOT NULL PRIMARY KEY,
        event_id          VARCHAR(36)   NOT NULL,
        title             VARCHAR(300)  NOT NULL,
        description       TEXT,
        room              VARCHAR(150),
        type              ENUM('keynote','conference','workshop','panel','networking','break','other')
                          NOT NULL DEFAULT 'conference',
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table agenda_sessions');

    // ── session_speakers ─────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS session_speakers (
        id         VARCHAR(36) NOT NULL PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        speaker_id VARCHAR(36) NOT NULL,
        role       ENUM('speaker','moderator','panelist','facilitator') NOT NULL DEFAULT 'speaker',
        UNIQUE KEY uniq_ss (session_id, speaker_id),
        CONSTRAINT fk_ss_session FOREIGN KEY (session_id) REFERENCES agenda_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_ss_speaker FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table session_speakers');

    // ── session_bookings ─────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS session_bookings (
        id         VARCHAR(36) NOT NULL PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        user_id    VARCHAR(36) NOT NULL,
        status     ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_sb (session_id, user_id),
        CONSTRAINT fk_sb_session FOREIGN KEY (session_id) REFERENCES agenda_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_sb_user   FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table session_bookings');

    // ── speaker_messages ─────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS speaker_messages (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table speaker_messages');

    await conn.query('SET foreign_key_checks = 1');
    console.log('\n🎉 Migration agenda terminée avec succès.');
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
