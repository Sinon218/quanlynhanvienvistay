// ===================================================================
// SEED DATABASE SCRIPT - server/seed.js
// ===================================================================
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('./db');

// Helper to remove accents for usernames
function removeAccents(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, '');
}

// 60 Real apartments provided by user
const providedRooms = [
  // S1 (14)
  { code: 'S1-0505', building: 'S1', password: '000555', is_samsung: 1 },
  { code: 'S1-0508', building: 'S1', password: '585868', is_samsung: 1 },
  { code: 'S1-0905', building: 'S1', password: '730399', is_samsung: 1 },
  { code: 'S1-1105', building: 'S1', password: '220704', is_samsung: 0 },
  { code: 'S1-1605', building: 'S1', password: '166.666', is_samsung: 0 },
  { code: 'S1-1705', building: 'S1', password: '356835', is_samsung: 0 },
  { code: 'S1-1905', building: 'S1', password: '199.999', is_samsung: 1 },
  { code: 'S1-2105', building: 'S1', password: '222111', is_samsung: 0 },
  { code: 'S1-2305', building: 'S1', password: '160.524', is_samsung: 0 },
  { code: 'S1-2405', building: 'S1', password: '122.537', is_samsung: 1 },
  { code: 'S1-2405A', building: 'S1', password: '456789', is_samsung: 1 },
  { code: 'S1-2505A', building: 'S1', password: '000555', is_samsung: 1 },
  { code: 'S1-2705', building: 'S1', password: '222777', is_samsung: 1 },
  { code: 'S1-3105', building: 'S1', password: '333555', is_samsung: 1 },

  // S2 (26)
  { code: 'S2-0610', building: 'S2', password: '760.200', is_samsung: 1 },
  { code: 'S2-0715', building: 'S2', password: '686868', is_samsung: 0 },
  { code: 'S2-1110', building: 'S2', password: '101010', is_samsung: 1 },
  { code: 'S2-1111', building: 'S2', password: '838688', is_samsung: 1 },
  { code: 'S2-11A11', building: 'S2', password: '111168', is_samsung: 0 },
  { code: 'S2-1220', building: 'S2', password: '111222', is_samsung: 0 },
  { code: 'S2-1511A', building: 'S2', password: '688688', is_samsung: 1 },
  { code: 'S2-1512', building: 'S2', password: '111222', is_samsung: 1 },
  { code: 'S2-1712', building: 'S2', password: '320.500', is_samsung: 1 },
  { code: 'S2-1901', building: 'S2', password: '009966', is_samsung: 0 },
  { code: 'S2-2106', building: 'S2', password: '222111', is_samsung: 0 },
  { code: 'S2-2211A', building: 'S2', password: '668868', is_samsung: 1 },
  { code: 'S2-2411', building: 'S2', password: '135246#', is_samsung: 1 },
  { code: 'S2-2512', building: 'S2', password: '225588', is_samsung: 1 },
  { code: 'S2-2916', building: 'S2', password: '929268', is_samsung: 1 },
  { code: 'S2-3210', building: 'S2', password: '333222', is_samsung: 1 },
  { code: 'S2-3301', building: 'S2', password: '333111', is_samsung: 0 },
  { code: 'S2-3316', building: 'S2', password: '333366', is_samsung: 1 },
  { code: 'S2-3411A', building: 'S2', password: '201099', is_samsung: 0 },
  { code: 'S2-3420', building: 'S2', password: '202002', is_samsung: 0 },
  { code: 'S2-3517', building: 'S2', password: '353568', is_samsung: 1 },
  { code: 'S2-3608', building: 'S2', password: '363636', is_samsung: 0 },
  { code: 'S2-3810', building: 'S2', password: '383838', is_samsung: 1 },
  { code: 'S2-3812', building: 'S2', password: '101615', is_samsung: 1 },
  { code: 'S2-3816', building: 'S2', password: '383883', is_samsung: 1 },
  { code: 'S2-3908', building: 'S2', password: '999888', is_samsung: 0 },

  // S3 (17)
  { code: 'S3-0908', building: 'S3', password: '999888', is_samsung: 0 },
  { code: 'S3-15A12', building: 'S3', password: '111555', is_samsung: 1 },
  { code: 'S3-1701', building: 'S3', password: '240302', is_samsung: 0 },
  { code: 'S3-1616', building: 'S3', password: '382838', is_samsung: 0 },
  { code: 'S3-1811', building: 'S3', password: '333666', is_samsung: 1 },
  { code: 'S3-1901', building: 'S3', password: '111119', is_samsung: 0 },
  { code: 'S3-2012', building: 'S3', password: '111222', is_samsung: 1 },
  { code: 'S3-2412', building: 'S3', password: '333666', is_samsung: 1 },
  { code: 'S3-2909', building: 'S3', password: '000999', is_samsung: 0 },
  { code: 'S3-3015', building: 'S3', password: '305305', is_samsung: 1 },
  { code: 'S3-3409', building: 'S3', password: '399999', is_samsung: 0 },
  { code: 'S3-3411', building: 'S3', password: '123468', is_samsung: 1 },
  { code: 'S3-3511', building: 'S3', password: '351168', is_samsung: 1 },
  { code: 'S3-3512', building: 'S3', password: '333.222', is_samsung: 1 },
  { code: 'S3-3612', building: 'S3', password: '363663', is_samsung: 1 },
  { code: 'S3-3906', building: 'S3', password: '336699', is_samsung: 0 },
  { code: 'S3-3918', building: 'S3', password: '838386', is_samsung: 0 },

  // B (1)
  { code: 'B2102', building: 'B', password: '456456*', is_samsung: 0 },

  // R6A (2)
  { code: 'R6A-0505', building: 'R6A', password: '111.000.222.33', is_samsung: 0 },
  { code: 'R6A-2806', building: 'R6A', password: '2222.333.333', is_samsung: 0 }
];

// Generate 90 placeholder rooms for Hồ Chí Minh to reach exactly 150
const placeholderRooms = [];
const targetTotal = 150;
const missingCount = targetTotal - providedRooms.length;

for (let i = 1; i <= missingCount; i++) {
  const roomNum = String(i).padStart(3, '0');
  placeholderRooms.push({
    code: `HCM-${roomNum}`,
    building: 'HCM',
    password: '???',
    is_samsung: 0
  });
}

const allRooms = [...providedRooms, ...placeholderRooms].map((room, idx) => {
  const roomTypes = ['1 ngủ', '2 ngủ', '3 ngủ', '4 ngủ'];
  return {
    ...room,
    room_type: roomTypes[idx % roomTypes.length]
  };
});

const staffData = [
  { name: 'Liên',   default_name: 'Liên',   type: 'full-time', room_role: 1, tech_role: 0 },
  { name: 'Thiên',  default_name: 'Thiên',  type: 'full-time', room_role: 2, tech_role: 1 },
  { name: 'Thương', default_name: 'Thương', type: 'full-time', room_role: 2, tech_role: 1 },
  { name: 'Vân',    default_name: 'Vân',    type: 'full-time', room_role: 1, tech_role: 0 },
  { name: 'Diệu',  default_name: 'Diệu',  type: 'full-time', room_role: 1, tech_role: 0 },
  { name: 'Hoàn',   default_name: 'Hoàn',   type: 'full-time', room_role: 1, tech_role: 0 },
  { name: 'Lộc',    default_name: 'Lộc',    type: 'full-time', room_role: 1, tech_role: 0 },
  { name: 'Nhân viên Part-time 1', default_name: 'Nhân viên Part-time 1', type: 'part-time', room_role: 2, tech_role: 0 },
  { name: 'Nhân viên Part-time 2', default_name: 'Nhân viên Part-time 2', type: 'part-time', room_role: 2, tech_role: 0 }
];

async function seed() {
  let pool;
  try {
    pool = await getPool();

    console.log('🧹 Clearing existing database tables...');
    await pool.request().query('DELETE FROM AuditLog');
    await pool.request().query('DELETE FROM WorkAssignments');
    await pool.request().query('DELETE FROM SalaryRecords');
    await pool.request().query('DELETE FROM Users');
    await pool.request().query('DELETE FROM Staff');
    await pool.request().query('DELETE FROM Apartments');

    console.log('👥 Seeding Staff...');
    const staffIds = [];
    for (const staff of staffData) {
      const result = await pool.request()
        .input('name', sql.NVarChar, staff.name)
        .input('default_name', sql.NVarChar, staff.default_name)
        .input('type', sql.VarChar, staff.type)
        .input('room_role', sql.Int, staff.room_role)
        .input('tech_role', sql.Int, staff.tech_role)
        .query(`
          INSERT INTO Staff (name, default_name, type, room_role, tech_role)
          OUTPUT INSERTED.id
          VALUES (@name, @default_name, @type, @room_role, @tech_role)
        `);
      staffIds.push({ id: result.recordset[0].id, name: staff.name, type: staff.type });
    }

    console.log('🔑 Seeding Users (Admin & Staff Accounts)...');
    // Admin Account: username = vistay, password = 12345678
    const adminHash = await bcrypt.hash('12345678', 10);
    await pool.request()
      .input('username', sql.VarChar, 'vistay')
      .input('password_hash', sql.VarChar, adminHash)
      .input('role', sql.VarChar, 'admin')
      .query(`
        INSERT INTO Users (username, password_hash, role, staff_id)
        VALUES (@username, @password_hash, @role, NULL)
      `);

    // Employee Accounts: username = lower case non-accented name, password = 12345678
    const employeeHash = await bcrypt.hash('12345678', 10);
    for (const s of staffIds) {
      // Map names like "Liên" to "lien", "Nhân viên Part-time 1" to "parttime1"
      let username = '';
      if (s.name.includes('Part-time 1')) {
        username = 'parttime1';
      } else if (s.name.includes('Part-time 2')) {
        username = 'parttime2';
      } else {
        username = removeAccents(s.name);
      }

      await pool.request()
        .input('username', sql.VarChar, username)
        .input('password_hash', sql.VarChar, employeeHash)
        .input('role', sql.VarChar, 'employee')
        .input('staff_id', sql.Int, s.id)
        .query(`
          INSERT INTO Users (username, password_hash, role, staff_id)
          VALUES (@username, @password_hash, @role, @staff_id)
        `);
    }

    console.log(`🏠 Seeding Apartments (${allRooms.length} rooms total)...`);
    for (const room of allRooms) {
      await pool.request()
        .input('code', sql.VarChar, room.code)
        .input('building', sql.NVarChar, room.building)
        .input('password', sql.NVarChar, room.password)
        .input('is_samsung', sql.Bit, room.is_samsung)
        .input('room_type', sql.NVarChar, room.room_type)
        .query(`
          INSERT INTO Apartments (code, building, password, is_samsung, room_type, status)
          VALUES (@code, @building, @password, @is_samsung, @room_type, 'available')
        `);
    }

    console.log('✅ DATABASE SEED COMPLETE!');
    console.log('----------------------------------------------------');
    console.log('Tài khoản đăng nhập hệ thống:');
    console.log('1. Quản trị viên (Admin):');
    console.log('   - Username: vistay');
    console.log('   - Password: (Mật khẩu bạn thiết lập, ví dụ: 12345678)');
    console.log('2. Nhân viên (Employee):');
    console.log('   - Username: lien, thien, thuong, van, dieu, hoan, parttime1, parttime2');
    console.log('   - Password: (Mặc định: 12345678)');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('❌ SEED ERROR:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

seed();
