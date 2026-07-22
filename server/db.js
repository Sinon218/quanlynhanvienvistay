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
    enableArithAbort: true,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 300000,
  },
};

if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT, 10);
} else if (instanceName) {
  config.options.instanceName = instanceName;
}

let pool = null;
let connectionPromise = null;

async function getPool() {
  if (pool && pool.connected) {
    return pool;
  }

  if (connectionPromise) {
    try {
      const p = await connectionPromise;
      if (p && p.connected) return p;
    } catch (e) {
      connectionPromise = null;
    }
  }

  connectionPromise = (async () => {
    let lastError = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        if (pool) {
          try { await pool.close(); } catch (e) { }
          pool = null;
        }
        if (attempt > 1) {
          await new Promise(r => setTimeout(r, 200 * attempt));
        }

        const newPool = new sql.ConnectionPool(config);
        newPool.on('error', err => {
          console.warn('📡 SQL Pool connection warning:', err.message);
          pool = null;
          connectionPromise = null;
        });

        await newPool.connect();
        console.log('✅ Connected to SQL Server:', process.env.DB_NAME);
        pool = newPool;
        return newPool;
      } catch (err) {
        lastError = err;
        pool = null;
        console.warn(`⚠️ SQL connect attempt ${attempt}/5 failed (${err.message}). Retrying...`);
      }
    }
    connectionPromise = null;
    throw lastError;
  })();

  return connectionPromise;
}

// Bulletproof DB query wrapper with auto-reconnect retry
async function queryDb(queryFn) {
  try {
    const poolInstance = await getPool();
    return await queryFn(poolInstance);
  } catch (err) {
    if (err.message && (err.message.includes('ECONNRESET') || err.message.includes('Connection lost') || err.code === 'ESOCKET')) {
      console.warn('📡 DB query encountered socket reset, reconnecting and retrying query...', err.message);
      pool = null;
      connectionPromise = null;
      const freshPool = await getPool();
      return await queryFn(freshPool);
    }
    throw err;
  }
}

async function closePool() {
  if (pool) {
    try {
      await pool.close();
      console.log('📴 SQL connection pool closed.');
    } catch (e) { }
    pool = null;
    connectionPromise = null;
  }
}

module.exports = { sql, getPool, queryDb, closePool };
