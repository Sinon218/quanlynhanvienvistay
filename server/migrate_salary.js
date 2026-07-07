// ===================================================================
// SALARY MIGRATION SCRIPT - server/migrate_salary.js
// Cập nhật mức lương cố định cho nhân viên hiện tại trong DB
// ===================================================================
const { getPool, sql } = require('./db');

// ===== CẤU HÌNH LƯƠNG CỐ ĐỊNH =====
const SALARY_CONFIG = {
  DEFAULT_BASE_SALARY: 5000000,     // 5 triệu VND
  SPECIAL_BASE_SALARY: 7000000,     // 7 triệu VND
  DEFAULT_PER_ROOM_RATE: 50000,     // 50k/phòng
  SPECIAL_STAFF: ['Lộc', 'Diệu'],
};

async function migrateSalary() {
  let pool;
  try {
    pool = await getPool();
    console.log('🔄 Đang cập nhật mức lương cố định...');

    // Cập nhật tất cả nhân viên = 5,000,000
    const updateAll = await pool.request()
      .input('baseSalary', sql.Decimal(12, 0), SALARY_CONFIG.DEFAULT_BASE_SALARY)
      .input('perRoomRate', sql.Decimal(10, 0), SALARY_CONFIG.DEFAULT_PER_ROOM_RATE)
      .query(`
        UPDATE Staff 
        SET base_salary = @baseSalary, per_room_rate = @perRoomRate
        WHERE name NOT IN (N'Lộc', N'Diệu')
      `);
    console.log(`   ✅ Đã cập nhật ${updateAll.rowsAffected[0]} nhân viên với lương ${SALARY_CONFIG.DEFAULT_BASE_SALARY.toLocaleString('vi-VN')} VND`);

    // Cập nhật Lộc và Diệu = 7,000,000
    const updateSpecial = await pool.request()
      .input('baseSalary', sql.Decimal(12, 0), SALARY_CONFIG.SPECIAL_BASE_SALARY)
      .input('perRoomRate', sql.Decimal(10, 0), SALARY_CONFIG.DEFAULT_PER_ROOM_RATE)
      .query(`
        UPDATE Staff 
        SET base_salary = @baseSalary, per_room_rate = @perRoomRate
        WHERE name IN (N'Lộc', N'Diệu')
      `);
    console.log(`   ✅ Đã cập nhật ${updateSpecial.rowsAffected[0]} nhân viên (Lộc, Diệu) với lương ${SALARY_CONFIG.SPECIAL_BASE_SALARY.toLocaleString('vi-VN')} VND`);

    // Hiển thị kết quả
    const result = await pool.request().query('SELECT id, name, type, base_salary, per_room_rate FROM Staff ORDER BY id');
    console.log('\n📊 Bảng lương hiện tại:');
    console.log('────────────────────────────────────────────────');
    result.recordset.forEach(row => {
      console.log(`   ${row.name.padEnd(25)} | ${Number(row.base_salary).toLocaleString('vi-VN').padStart(12)} VND | ${Number(row.per_room_rate).toLocaleString('vi-VN').padStart(8)} VND/phòng`);
    });
    console.log('────────────────────────────────────────────────');
    console.log('✅ Migration complete!');

  } catch (err) {
    console.error('❌ Migration Error:', err.message);
  } finally {
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  }
}

migrateSalary();
