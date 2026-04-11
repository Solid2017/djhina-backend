require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [joined] = await conn.query(
    'SELECT COUNT(*) as total FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.status = "published"'
  );
  console.log('Events with valid organizer:', joined[0].total);

  const [orphans] = await conn.query(
    'SELECT e.title, e.organizer_id FROM events e LEFT JOIN users u ON e.organizer_id = u.id WHERE u.id IS NULL LIMIT 3'
  );
  if (orphans.length) {
    orphans.forEach(o => console.log('Orphan:', o.title.substring(0,40), '| org_id:', o.organizer_id));
  } else {
    console.log('Pas d orphelins — tous les organisateurs sont valides');
  }

  const [sc] = await conn.query('SELECT COUNT(*) as total FROM agenda_sessions');
  console.log('Total sessions:', sc[0].total);

  const [sl] = await conn.query(
    'SELECT a.title, e.title as event_title FROM agenda_sessions a LEFT JOIN events e ON a.event_id = e.id LIMIT 3'
  );
  sl.forEach(x => console.log('Session:', x.title.substring(0,30), '| Event:', x.event_title ? x.event_title.substring(0,25) : 'NULL (orphelin)'));

  await conn.end();
}
run().catch(e => console.error('ERR:', e.message));
