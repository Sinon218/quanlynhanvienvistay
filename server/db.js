// ===================================================================
// SQL Server Connection Pool
// ===================================================================
const sql = require('mssql');
require('dotenv').config();

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

if (instanceName) {
  config.options.instanceName = instanceName;
}

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
    console.log('✅ Connected to SQL Server:', process.env.DB_NAME);
  }
  return pool;
}

module.exports = { sql, getPool };
