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

async function getPool() {
  if (poolPromise) {
    try {
      const p = await poolPromise;
      if (p && p.connected) {
        return p;
      }
      // If pool is no longer connected, clear it to reconnect
      poolPromise = null;
    } catch (err) {
      poolPromise = null;
    }
  }

  poolPromise = (async () => {
    try {
      const newPool = new sql.ConnectionPool(config);
      await newPool.connect();
      console.log('✅ Connected to SQL Server:', process.env.DB_NAME);

      newPool.on('error', err => {
        console.error('📡 SQL Pool Error (Auto-closing):', err.message);
        try {
          newPool.close();
        } catch (closeErr) {
          // ignore
        }
        poolPromise = null;
      });

      return newPool;
    } catch (err) {
      console.error('❌ SQL Connection Error:', err.message);
      poolPromise = null;
      throw err;
    }
  })();

  return poolPromise;
}

module.exports = { sql, getPool };
