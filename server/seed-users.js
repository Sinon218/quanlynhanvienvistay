const { getPool, sql } = require('./db');
const bcrypt = require('bcryptjs');

async function seedUsers() {
  const pool = await getPool();
  
  const check = await pool.request().query('SELECT COUNT(*) as cnt FROM Users');
  if (check.recordset[0].cnt > 0) {
    console.log('Users already exist (' + check.recordset[0].cnt + ' users). Skipping.');
    await pool.close();
    return;
  }

  const hash = await bcrypt.hash('12345678', 10);

  // Admin user
  await pool.request()
    .input('username', sql.VarChar, 'vistay')
    .input('hash', sql.VarChar, hash)
    .query(`INSERT INTO Users (username, password_hash, role, is_active) VALUES (@username, @hash, 'admin', 1)`);
  console.log('Created admin: vistay / 12345678');

  // Create user accounts for staff
  const staffResult = await pool.request().query('SELECT id, name FROM Staff');
  for (const staff of staffResult.recordset) {
    const cleanName = staff.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase().replace(/\s+/g, '');

    const existing = await pool.request()
      .input('username', sql.VarChar, cleanName)
      .query('SELECT id FROM Users WHERE username = @username');

    if (existing.recordset.length === 0) {
      await pool.request()
        .input('username', sql.VarChar, cleanName)
        .input('hash', sql.VarChar, hash)
        .input('staffId', sql.Int, staff.id)
        .query(`INSERT INTO Users (username, password_hash, role, staff_id, is_active) VALUES (@username, @hash, 'employee', @staffId, 1)`);
      console.log('Created user: ' + cleanName + ' (staff #' + staff.id + ')');
    }
  }

  // Set managers
  await pool.request().query(`UPDATE Users SET role = 'manager' WHERE username IN ('dieu', 'loc')`);
  console.log('Set dieu, loc as managers');

  const final = await pool.request().query('SELECT id, username, role, staff_id FROM Users');
  console.log('\nAll users:');
  final.recordset.forEach(u => console.log('  ' + u.username + ' (' + u.role + ') staff_id=' + u.staff_id));

  await pool.close();
}

seedUsers().catch(err => { console.error('Error:', err.message); process.exit(1); });
