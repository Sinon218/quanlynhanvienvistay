// ===================================================================
// DATABASE MIGRATION SCRIPT - server/migrate.js
// ===================================================================
const { getPool, sql } = require('./db');

async function migrate() {
  console.log('🔄 Connecting to SQL Server...');
  let pool;
  try {
    pool = await getPool();
    console.log('🔄 Checking and adding checkin/checkout columns to Apartments...');
    
    // Add checkin_date, checkin_time, checkout_date, checkout_time to Apartments table if they don't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Apartments' AND COLUMN_NAME = 'checkin_date')
      BEGIN
        ALTER TABLE Apartments ADD 
          checkin_date DATE NULL,
          checkin_time VARCHAR(10) NULL,
          checkout_date DATE NULL,
          checkout_time VARCHAR(10) NULL;
        PRINT '✅ checkin/checkout columns added to Apartments';
      END
      ELSE
      BEGIN
        PRINT 'ℹ️ checkin/checkout columns already exist';
      END
    `);

    console.log('🔄 Checking and adding expected_start_at/expected_end_at columns to WorkAssignments...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WorkAssignments' AND COLUMN_NAME = 'expected_start_at')
      BEGIN
        ALTER TABLE WorkAssignments ADD 
          expected_start_at DATETIME NULL,
          expected_end_at DATETIME NULL;
        PRINT '✅ expected_start_at/expected_end_at columns added to WorkAssignments';
      END
      ELSE
      BEGIN
        PRINT 'ℹ️ expected_start_at/expected_end_at columns already exist';
      END
    `);
    
    console.log('✅ DATABASE MIGRATION COMPLETE!');
  } catch (err) {
    console.error('❌ MIGRATION ERROR:', err.message);
  } finally {
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  }
}

migrate();
