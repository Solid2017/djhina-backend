const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  database:           process.env.DB_NAME || 'djhina_db',
  user:               process.env.DB_USER || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+01:00', // Tchad UTC+1
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connecté —', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL erreur:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
