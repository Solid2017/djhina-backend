require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Collations des tables
  const [cols] = await conn.query(
    "SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('events','agenda_sessions','speakers','users')",
    [process.env.DB_NAME]
  );
  cols.forEach(c => console.log(c.TABLE_NAME, '->', c.TABLE_COLLATION));

  // Sessions count
  const [sc] = await conn.query('SELECT COUNT(*) as total FROM agenda_sessions');
  console.log('\nTotal sessions:', sc[0].total);

  // Events IDs
  const [ev] = await conn.query('SELECT id, title FROM events LIMIT 3');
  ev.forEach(e => console.log('Event:', e.id, '-', e.title.substring(0,30)));

  await conn.end();
}
run().catch(e => console.error('ERR:', e.message));
