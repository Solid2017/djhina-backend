// Migration: ajoute les colonnes privacy et biometric aux users
require('dotenv').config();
const { pool } = require('../src/config/database');

async function migrate() {
  console.log('🔧 Migration privacy/biometric...');

  const columns = [
    { name: 'privacy_profile_public', def: 'TINYINT(1) DEFAULT 1' },
    { name: 'privacy_show_activity',  def: 'TINYINT(1) DEFAULT 1' },
    { name: 'privacy_show_tickets',   def: 'TINYINT(1) DEFAULT 0' },
    { name: 'data_share_analytics',   def: 'TINYINT(1) DEFAULT 1' },
    { name: 'biometric_enabled',      def: 'TINYINT(1) DEFAULT 0' },
  ];

  for (const col of columns) {
    try {
      await pool.execute(`ALTER TABLE users ADD COLUMN ${col.name} ${col.def}`);
      console.log(`✅ Colonne ajoutée : ${col.name}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`⏭  Colonne déjà existante : ${col.name}`);
      } else {
        console.error(`❌ Erreur sur ${col.name}:`, e.message);
      }
    }
  }

  console.log('✅ Migration terminée.');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
