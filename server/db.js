// ===================================================================
// SQL Server Connection Pool
// ===================================================================
const sql = require('mssql');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const serverParts = (process.env.DB_SERVER || '').split('\\');
const serverHost = serverParts[0] || 'localhost';
const instanceName = serverParts[1] || null;

const config = {
  server: serverHost,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT, 10);
} else if (instanceName) {
  config.options.instanceName = instanceName;
}

let pool = null;

async function getPool() {
  if (!pool || !pool.connected) {
    try {
      pool = new sql.ConnectionPool(config);
      await pool.connect();
      console.log('✅ Connected to SQL Server:', process.env.DB_NAME);

      pool.on('error', err => {
        console.error('📡 SQL Pool Error (Auto-closing):', err.message);
        try {
          pool.close();
        } catch (closeErr) {
          // ignore
        }
      });
    } catch (err) {
      console.error('❌ SQL Connection Error:', err.message);
      pool = null;
      throw err;
    }
  }
  return pool;
}

module.exports = { sql, getPool };
