// ===================================================================
// SQL Server Connection Pool - Database Layer
// Cấu trúc 3 tầng: Database Connection
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
    keepAlive: false,
    enableArithAbort: true,
  },
  pool: {
    max: 15,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT, 10);
} else if (instanceName) {
  config.options.instanceName = instanceName;
}

let poolPromise = null;
let activePool = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function getPool() {
  // Fast path: return healthy pool
  if (activePool && activePool.connected) {
    return activePool;
  }

  // If we have a pending connection, wait for it
  if (poolPromise) {
    try {
      const p = await poolPromise;
      if (p && p.connected) {
        activePool = p;
        reconnectAttempts = 0;
        return p;
      }
    } catch (err) {
      poolPromise = null;
    }
  }

  // Create new connection
  if (!poolPromise) {
    poolPromise = (async () => {
      try {
        // Close stale pool
        if (activePool) {
          try { await activePool.close(); } catch (e) {}
          activePool = null;
        }

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Resetting counter.`);
          reconnectAttempts = 0;
        }

        reconnectAttempts++;
        const newPool = new sql.ConnectionPool(config);
        await newPool.connect();
        console.log('✅ Connected to SQL Server:', process.env.DB_NAME);
        reconnectAttempts = 0;

        newPool.on('error', err => {
          console.error('📡 SQL Pool Error:', err.message);
          activePool = null;
          poolPromise = null;
        });

        activePool = newPool;
        return newPool;
      } catch (err) {
        console.error(`❌ SQL Connection Error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, err.message);
        poolPromise = null;
        activePool = null;
        throw err;
      }
    })();
  }

  return poolPromise;
}

// Graceful close
async function closePool() {
  if (activePool) {
    try {
      await activePool.close();
      console.log('📴 SQL connection pool closed.');
    } catch (e) {
      console.error('Error closing pool:', e.message);
    }
    activePool = null;
    poolPromise = null;
  }
}

module.exports = { sql, getPool, closePool };
