// ===================================================================
// SQL Server Connection Pool - Database Layer
// Cấu trúc 3 tầng: Database Connection
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
  options: {
    encrypt: false,
    trustServerCertificate: true,
    keepAlive: false,
    enableArithAbort: true,
  },
  pool: {
    max: 15,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT, 10);
} else if (instanceName) {
  config.options.instanceName = instanceName;
}

let pool = null;
let connectionPromise = null;

async function getPool() {
  // 1. If we have a healthy pool, return it
  if (pool && pool.connected) {
    try {
      await pool.request().query('SELECT 1');
      return pool;
    } catch (err) {
      console.warn('📡 Cached SQL connection lost, cleaning up...', err.message);
      try { await pool.close(); } catch (e) {}
      pool = null;
      connectionPromise = null;
    }
  }

  // 2. If there is an ongoing connection attempt, wait for it
  if (connectionPromise) {
    try {
      const p = await connectionPromise;
      if (p && p.connected) {
        return p;
      }
    } catch (err) {
      // If the ongoing connection failed, we will try to establish a new one below
    }
    connectionPromise = null;
  }

  // 3. Start a new connection attempt
  connectionPromise = (async () => {
    try {
      const newPool = new sql.ConnectionPool(config);
      await newPool.connect();
      console.log('✅ Connected to SQL Server:', process.env.DB_NAME);

      newPool.on('error', err => {
        console.error('📡 SQL Pool Error:', err.message);
        if (pool === newPool) {
          pool = null;
        }
      });

      pool = newPool;
      return newPool;
    } catch (err) {
      console.error('❌ SQL Connection Error:', err.message);
      connectionPromise = null;
      throw err;
    }
  })();

  return connectionPromise;
}

// Graceful close
async function closePool() {
  if (pool) {
    try {
      await pool.close();
      console.log('📴 SQL connection pool closed.');
    } catch (e) {
      console.error('Error closing pool:', e.message);
    }
    pool = null;
    connectionPromise = null;
  }
}

module.exports = { sql, getPool, closePool };
