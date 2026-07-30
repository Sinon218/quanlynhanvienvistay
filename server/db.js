// ===================================================================
// SQL Server Connection Pool - Database Layer (bulletproof v2)
// ===================================================================
const sql = require('mssql');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const serverParts = (process.env.DB_SERVER || '').split('\\');
let serverHost = serverParts[0] || '127.0.0.1';
if (serverHost === 'localhost') serverHost = '127.0.0.1';
const instanceName = serverParts[1] || null;

const config = {
  server: serverHost,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 15000,
  },
  connectionTimeout: 15000,
  requestTimeout: 20000,
};

if (!config.port && instanceName) {
  config.options.instanceName = instanceName;
}

let pool = null;

async function getPool() {
  if (pool && pool.connected) {
    return pool;
  }

  // Force close broken pool
  if (pool) {
    try { await pool.close(); } catch (e) {}
    pool = null;
  }

  // Create fresh pool with retry
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const newPool = new sql.ConnectionPool(config);
      newPool.on('error', err => {
        console.warn('📡 SQL Pool error:', err.message);
        pool = null;
      });
      await newPool.connect();
      console.log('✅ Connected to SQL Server:', process.env.DB_NAME);
      pool = newPool;
      return pool;
    } catch (err) {
      console.warn(`⚠️ SQL connect attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt < 5) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('Cannot connect to SQL Server after 5 attempts');
}

// Auto-reconnect wrapper: if connection drops, create fresh pool and retry once
async function queryDb(queryFn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const p = await getPool();
      return await queryFn(p);
    } catch (err) {
      const isConnErr = err.message && (
        err.message.includes('ECONNRESET') ||
        err.message.includes('Connection lost') ||
        err.message.includes('socket') ||
        err.code === 'ESOCKET' ||
        err.code === 'ECONNRESET'
      );
      if (isConnErr && attempt === 1) {
        console.warn('📡 Connection lost, reconnecting...');
        pool = null;
        continue;
      }
      throw err;
    }
  }
}

async function closePool() {
  if (pool) {
    try { await pool.close(); } catch (e) {}
    pool = null;
  }
}

module.exports = { sql, getPool, queryDb, closePool };
