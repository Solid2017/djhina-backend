/**
 * Script de migration — exécute schema.sql puis seed.sql
 * Usage : node database/migrate.js [--seed]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const withSeed = process.argv.includes('--seed');

  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'djhina_db',
    multipleStatements: true,
  });

  console.log('✓ Connecté à MySQL');

  // Schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema     = fs.readFileSync(schemaPath, 'utf8');
  await conn.query(schema);
  console.log('✓ Schema appliqué (schema.sql)');

  // Seeds (optionnel)
  if (withSeed) {
    const seedPath = path.join(__dirname, 'seed.sql');
    const seed     = fs.readFileSync(seedPath, 'utf8');
    await conn.query(seed);
    console.log('✓ Données initiales insérées (seed.sql)');
  }

  await conn.end();
  console.log('\n✅ Migration terminée avec succès.');
}

run().catch(err => {
  console.error('❌ Erreur de migration :', err.message);
  process.exit(1);
});
