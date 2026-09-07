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
    tcpKeepAlive: true,
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 60000,
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
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

  // Create fresh pool with retry (faster retries: 1s, 1.5s, 2s, 2.5s)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const newPool = new sql.ConnectionPool(config);
      newPool.on('error', err => {
        console.warn('SQL Pool error:', err.message);
        pool = null;
      });
      await newPool.connect();
      console.log('Connected to SQL Server:', process.env.DB_NAME);
      pool = newPool;
      return pool;
    } catch (err) {
      console.warn(`SQL connect attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt < 5) await new Promise(r => setTimeout(r, 1000 + 500 * attempt));
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
        console.warn('Connection lost, reconnecting...');
        pool = null;
        continue;
      }
      throw err;
    }
  }
}

// ===================================================================
// runQuery() — Safe wrapper that prevents double-response crashes
// ===================================================================
// Usage in route handlers:
//
//   const { runQuery } = require('../db');
//
//   router.get('/:id', authenticate, async (req, res) => {
//     try {
//       const data = await runQuery(async (pool) => {
//         const result = await pool.request()
//           .input('id', sql.Int, req.params.id)
//           .query('SELECT * FROM Table WHERE id = @id');
//         if (result.recordset.length === 0) {
//           throw Object.assign(new Error('Not found'), { statusCode: 404 });
//         }
//         return result.recordset[0];
//       });
//       res.json(data);
//     } catch (err) {
//       res.status(err.statusCode || 500).json({ error: err.message });
//     }
//   });
//
// RULES:
//   1. NEVER call res.status().json() inside the runQuery callback
//   2. THROW errors with statusCode: throw Object.assign(new Error('msg'), { statusCode: 400 })
//   3. Return data from callback — it becomes the resolved value of runQuery()
//   4. Catch errors in the route handler and send response there
// ===================================================================
async function runQuery(fn) {
  try {
    return await queryDb(fn);
  } catch (err) {
    // If already has statusCode, re-throw as-is
    if (err.statusCode) throw err;
    // Wrap unexpected errors as 500
    const wrapped = new Error(err.message || 'Lỗi server.');
    wrapped.statusCode = 500;
    throw wrapped;
  }
}

async function closePool() {
  if (pool) {
    try { await pool.close(); } catch (e) {}
    pool = null;
  }
}

// Pre-warm: tạo connection pool sẵn khi server khởi động
async function warmUp() {
  try {
    const p = await getPool();
    await p.request().query('SELECT 1');
    console.log('✅ Database pool warmed up successfully.');
  } catch (err) {
    console.warn('⚠️ Database warm-up failed:', err.message);
  }
}

module.exports = { sql, getPool, queryDb, runQuery, closePool, warmUp };
