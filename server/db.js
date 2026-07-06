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
    keepAlive: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 15000,
};

if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT, 10);
} else if (instanceName) {
  config.options.instanceName = instanceName;
}

let poolPromise = null;
let activePool = null;

async function getPool() {
  if (activePool && activePool.connected) {
    return activePool;
  }

  if (poolPromise) {
    try {
      const p = await poolPromise;
      if (p && p.connected) {
        activePool = p;
        return p;
      }
    } catch (err) {
      poolPromise = null;
    }
  }

  if (!poolPromise) {
    poolPromise = (async () => {
      try {
        if (activePool) {
          try { await activePool.close(); } catch (e) {}
          activePool = null;
        }
        const newPool = new sql.ConnectionPool(config);
        await newPool.connect();
        console.log('✅ Connected to SQL Server:', process.env.DB_NAME);

        newPool.on('error', err => {
          console.error('📡 SQL Pool Error:', err.message);
          if (err.message.includes('Connection lost') || err.message.includes('socket') || err.message.includes('read')) {
            activePool = null;
            poolPromise = null;
          }
        });

        activePool = newPool;
        return newPool;
      } catch (err) {
        console.error('❌ SQL Connection Error:', err.message);
        poolPromise = null;
        activePool = null;
        throw err;
      }
    })();
  }

  return poolPromise;
}

module.exports = { sql, getPool };
