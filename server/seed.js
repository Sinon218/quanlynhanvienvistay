// ===================================================================
// SEED DATABASE SCRIPT - server/seed.js
// Cấu trúc 3 tầng: Database Layer → App Layer
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

// ===== CẤU HÌNH LƯƠNG CỐ ĐỊNH =====
const SALARY_CONFIG = {
  DEFAULT_BASE_SALARY: 5000000,     // 5 triệu VND
  SPECIAL_BASE_SALARY: 7000000,     // 7 triệu VND (Lộc, Diệu)
  DEFAULT_PER_ROOM_RATE: 50000,     // 50k/phòng
  SPECIAL_STAFF: ['Lộc', 'Diệu'],  // Nhân viên lương đặc biệt
};

// Room type mapping
const roomTypeByCode = {
  // 1 ngủ (35 căn)
  'R6A-0505': '1 ngủ', 'R6A-2806': '1 ngủ', 'S1-0405': '1 ngủ', 'S1-0505': '1 ngủ', 'S1-0905': '1 ngủ',
  'S1-1105': '1 ngủ', 'S1-1605': '1 ngủ', 'S1-1705': '1 ngủ', 'S1-1905': '1 ngủ', 'S1-2105': '1 ngủ',
  'S1-2305': '1 ngủ', 'S1-2405': '1 ngủ', 'S1-2505': '1 ngủ', 'S1-2705': '1 ngủ', 'S1-3105': '1 ngủ',
  'S2-0610': '1 ngủ', 'S2-1110': '1 ngủ', 'S2-1111': '1 ngủ', 'S2-1512': '1 ngủ', 'S2-1712': '1 ngủ',
  'S2-2512': '1 ngủ', 'S2-2810': '1 ngủ', 'S2-3210': '1 ngủ', 'S2-3810': '1 ngủ', 'S2-3812': '1 ngủ',
  'S3-0511': '1 ngủ', 'S3-1012': '1 ngủ', 'S3-15A12': '1 ngủ', 'S3-1811': '1 ngủ', 'S3-2012': '1 ngủ',
  'S3-2412': '1 ngủ', 'S3-2712': '1 ngủ', 'S3-2911': '1 ngủ', 'S3-3411': '1 ngủ', 'S3-3512': '1 ngủ',

  // 2 ngủ (40 căn)
  'R4-2519': '2 ngủ', 'R5-2423': '2 ngủ', 'S1-2405A': '2 ngủ', 'S1-2505A': '2 ngủ', 'S1-2809': '2 ngủ',
  'S2-0401': '2 ngủ', 'S2-0501': '2 ngủ', 'S2-0715': '2 ngủ', 'S2-0908': '2 ngủ', 'S2-11A11': '2 ngủ',
  'S2-1511A': '2 ngủ', 'S2-1808': '2 ngủ', 'S2-1901': '2 ngủ', 'S2-2117': '2 ngủ', 'S2-2211A': '2 ngủ',
  'S2-2411': '2 ngủ', 'S2-2811A': '2 ngủ', 'S2-2916': '2 ngủ', 'S2-3301': '2 ngủ', 'S2-3316': '2 ngủ',
  'S2-3411A': '2 ngủ', 'S2-3501': '2 ngủ', 'S2-3517': '2 ngủ', 'S2-3608': '2 ngủ', 'S2-3708': '2 ngủ',
  'S2-3811A': '2 ngủ', 'S2-3816': '2 ngủ', 'S2-3908': '2 ngủ', 'S3-0715': '2 ngủ', 'S3-0810': '2 ngủ',
  'S3-0908': '2 ngủ', 'S3-1001': '2 ngủ', 'S3-15A08A': '2 ngủ', 'S3-1616': '2 ngủ', 'S3-1701': '2 ngủ',
  'S3-1901': '2 ngủ', 'S3-2301': '2 ngủ', 'S3-3001': '2 ngủ', 'S3-3015': '2 ngủ', 'S3-3316': '2 ngủ',

  // 3 ngủ (8 căn)
  'B-2102': '3 ngủ', 'S1-0508': '3 ngủ', 'S2-1220': '3 ngủ', 'S3-2406': '3 ngủ', 'S3-2909': '3 ngủ',
  'S2-3420': '3 ngủ', 'S3-3702': '3 ngủ', 'S3-3906': '3 ngủ',

  // 4 ngủ (2 căn)
  'S2-2106': '4 ngủ', 'S3-3918': '4 ngủ'
};

// Real apartments provided by user
const providedRooms = [
  // S1
  { code: 'S1-0405', building: 'S1', password: '040505', is_samsung: 0 },
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
  { code: 'S1-2809', building: 'S1', password: '280900', is_samsung: 0 },
  { code: 'S1-3105', building: 'S1', password: '333555', is_samsung: 1 },

  // S2
  { code: 'S2-0401', building: 'S2', password: '040100', is_samsung: 0 },
  { code: 'S2-0501', building: 'S2', password: '050100', is_samsung: 0 },
  { code: 'S2-0610', building: 'S2', password: '760.200', is_samsung: 1 },
  { code: 'S2-0715', building: 'S2', password: '686868', is_samsung: 0 },
  { code: 'S2-0908', building: 'S2', password: '090800', is_samsung: 0 },
  { code: 'S2-1110', building: 'S2', password: '101010', is_samsung: 1 },
  { code: 'S2-1111', building: 'S2', password: '838688', is_samsung: 1 },
  { code: 'S2-11A11', building: 'S2', password: '111168', is_samsung: 0 },
  { code: 'S2-1220', building: 'S2', password: '111222', is_samsung: 0 },
  { code: 'S2-1511A', building: 'S2', password: '688688', is_samsung: 1 },
  { code: 'S2-1512', building: 'S2', password: '111222', is_samsung: 1 },
  { code: 'S2-1712', building: 'S2', password: '320.500', is_samsung: 1 },
  { code: 'S2-1808', building: 'S2', password: '180800', is_samsung: 0 },
  { code: 'S2-1901', building: 'S2', password: '009966', is_samsung: 0 },
  { code: 'S2-2106', building: 'S2', password: '222111', is_samsung: 0 },
  { code: 'S2-2117', building: 'S2', password: '211700', is_samsung: 0 },
  { code: 'S2-2211A', building: 'S2', password: '668868', is_samsung: 1 },
  { code: 'S2-2411', building: 'S2', password: '135246#', is_samsung: 1 },
  { code: 'S2-2512', building: 'S2', password: '225588', is_samsung: 1 },
  { code: 'S2-2810', building: 'S2', password: '281000', is_samsung: 0 },
  { code: 'S2-2811A', building: 'S2', password: '281100', is_samsung: 0 },
  { code: 'S2-2916', building: 'S2', password: '929268', is_samsung: 1 },
  { code: 'S2-3210', building: 'S2', password: '333222', is_samsung: 1 },
  { code: 'S2-3301', building: 'S2', password: '333111', is_samsung: 0 },
  { code: 'S2-3316', building: 'S2', password: '333366', is_samsung: 1 },
  { code: 'S2-3411A', building: 'S2', password: '201099', is_samsung: 0 },
  { code: 'S2-3420', building: 'S2', password: '202002', is_samsung: 0 },
  { code: 'S2-3501', building: 'S2', password: '350100', is_samsung: 0 },
  { code: 'S2-3517', building: 'S2', password: '353568', is_samsung: 1 },
  { code: 'S2-3608', building: 'S2', password: '363636', is_samsung: 0 },
  { code: 'S2-3708', building: 'S2', password: '370800', is_samsung: 0 },
  { code: 'S2-3810', building: 'S2', password: '383838', is_samsung: 1 },
  { code: 'S2-3811A', building: 'S2', password: '381100', is_samsung: 0 },
  { code: 'S2-3812', building: 'S2', password: '101615', is_samsung: 1 },
  { code: 'S2-3816', building: 'S2', password: '383883', is_samsung: 1 },
  { code: 'S2-3908', building: 'S2', password: '999888', is_samsung: 0 },

  // S3
  { code: 'S3-0511', building: 'S3', password: '051100', is_samsung: 0 },
  { code: 'S3-0715', building: 'S3', password: '071500', is_samsung: 0 },
  { code: 'S3-0810', building: 'S3', password: '081000', is_samsung: 0 },
  { code: 'S3-0908', building: 'S3', password: '999888', is_samsung: 0 },
  { code: 'S3-1001', building: 'S3', password: '100100', is_samsung: 0 },
  { code: 'S3-1012', building: 'S3', password: '101200', is_samsung: 0 },
  { code: 'S3-15A12', building: 'S3', password: '111555', is_samsung: 1 },
  { code: 'S3-15A08A', building: 'S3', password: '150808', is_samsung: 0 },
  { code: 'S3-1701', building: 'S3', password: '240302', is_samsung: 0 },
  { code: 'S3-1616', building: 'S3', password: '382838', is_samsung: 0 },
  { code: 'S3-1811', building: 'S3', password: '333666', is_samsung: 1 },
  { code: 'S3-1901', building: 'S3', password: '111119', is_samsung: 0 },
  { code: 'S3-2012', building: 'S3', password: '111222', is_samsung: 1 },
  { code: 'S3-2301', building: 'S3', password: '230100', is_samsung: 0 },
  { code: 'S3-2406', building: 'S3', password: '240600', is_samsung: 0 },
  { code: 'S3-2412', building: 'S3', password: '333666', is_samsung: 1 },
  { code: 'S3-2712', building: 'S3', password: '271200', is_samsung: 0 },
  { code: 'S3-2909', building: 'S3', password: '000999', is_samsung: 0 },
  { code: 'S3-2911', building: 'S3', password: '291100', is_samsung: 0 },
  { code: 'S3-3015', building: 'S3', password: '305305', is_samsung: 1 },
  { code: 'S3-3001', building: 'S3', password: '300100', is_samsung: 0 },
  { code: 'S3-3316', building: 'S3', password: '331600', is_samsung: 0 },
  { code: 'S3-3409', building: 'S3', password: '399999', is_samsung: 0 },
  { code: 'S3-3411', building: 'S3', password: '123468', is_samsung: 1 },
  { code: 'S3-3511', building: 'S3', password: '351168', is_samsung: 1 },
  { code: 'S3-3512', building: 'S3', password: '333.222', is_samsung: 1 },
  { code: 'S3-3612', building: 'S3', password: '363663', is_samsung: 1 },
  { code: 'S3-3702', building: 'S3', password: '370200', is_samsung: 0 },
  { code: 'S3-3906', building: 'S3', password: '336699', is_samsung: 0 },
  { code: 'S3-3918', building: 'S3', password: '838386', is_samsung: 0 },

  // B, R4, R5, R6A
  { code: 'B-2102', building: 'B', password: '456456*', is_samsung: 0 },
  { code: 'R4-2519', building: 'R4', password: '251900', is_samsung: 0 },
  { code: 'R5-2423', building: 'R5', password: '242300', is_samsung: 0 },
  { code: 'R6A-0505', building: 'R6A', password: '111.000.222.33', is_samsung: 0 },
  { code: 'R6A-2806', building: 'R6A', password: '2222.333.333', is_samsung: 0 }
];

const allRooms = providedRooms.map((room) => ({
  ...room,
  room_type: roomTypeByCode[room.code] || '2 ngủ'
}));

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
    // Xóa theo thứ tự để tránh lỗi FK constraint
    try { await pool.request().query('DELETE FROM ApartmentStays'); } catch(e) {}
    try { await pool.request().query('DELETE FROM ApartmentStatusHistory'); } catch(e) {}
    await pool.request().query('DELETE FROM AuditLog');
    await pool.request().query('DELETE FROM Notifications');
    try { await pool.request().query('DELETE FROM Tasks'); } catch(e) {}
    await pool.request().query('DELETE FROM WorkAssignments');
    await pool.request().query('DELETE FROM SalaryRecords');
    await pool.request().query('DELETE FROM Users');
    await pool.request().query('DELETE FROM Staff');
    await pool.request().query('DELETE FROM Apartments');

    // Reset identity seeds
    try { await pool.request().query('DBCC CHECKIDENT (Staff, RESEED, 0)'); } catch(e) {}
    try { await pool.request().query('DBCC CHECKIDENT (Users, RESEED, 0)'); } catch(e) {}
    try { await pool.request().query('DBCC CHECKIDENT (Apartments, RESEED, 0)'); } catch(e) {}

    console.log('👥 Seeding Staff with fixed salaries...');
    const staffIds = [];
    for (const staff of staffData) {
      const isSpecial = SALARY_CONFIG.SPECIAL_STAFF.includes(staff.name);
      const baseSalary = isSpecial ? SALARY_CONFIG.SPECIAL_BASE_SALARY : SALARY_CONFIG.DEFAULT_BASE_SALARY;
      const perRoomRate = SALARY_CONFIG.DEFAULT_PER_ROOM_RATE;

      const result = await pool.request()
        .input('name', sql.NVarChar, staff.name)
        .input('default_name', sql.NVarChar, staff.default_name)
        .input('type', sql.VarChar, staff.type)
        .input('room_role', sql.Int, staff.room_role)
        .input('tech_role', sql.Int, staff.tech_role)
        .input('base_salary', sql.Decimal(12, 0), baseSalary)
        .input('per_room_rate', sql.Decimal(10, 0), perRoomRate)
        .query(`
          INSERT INTO Staff (name, default_name, type, room_role, tech_role, base_salary, per_room_rate)
          OUTPUT INSERTED.id
          VALUES (@name, @default_name, @type, @room_role, @tech_role, @base_salary, @per_room_rate)
        `);
      staffIds.push({ id: result.recordset[0].id, name: staff.name, type: staff.type });
      console.log(`   ✓ ${staff.name}: ${baseSalary.toLocaleString('vi-VN')} VND`);
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

    // Employee/Manager Accounts
    const employeeHash = await bcrypt.hash('12345678', 10);
    for (const s of staffIds) {
      let username = '';
      let role = 'employee';
      
      if (s.name.includes('Part-time 1')) {
        username = 'parttime1';
      } else if (s.name.includes('Part-time 2')) {
        username = 'parttime2';
      } else {
        username = removeAccents(s.name);
      }

      // Lộc và Diệu là manager
      if (s.name === 'Lộc' || s.name === 'Diệu') {
        role = 'manager';
      }

      await pool.request()
        .input('username', sql.VarChar, username)
        .input('password_hash', sql.VarChar, employeeHash)
        .input('role', sql.VarChar, role)
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

    console.log('');
    console.log('✅ DATABASE SEED COMPLETE!');
    console.log('====================================================');
    console.log('📊 CẤU HÌNH LƯƠNG CỐ ĐỊNH:');
    console.log(`   - Lương cơ bản: ${SALARY_CONFIG.DEFAULT_BASE_SALARY.toLocaleString('vi-VN')} VND (Tất cả NV)`);
    console.log(`   - Lương cơ bản: ${SALARY_CONFIG.SPECIAL_BASE_SALARY.toLocaleString('vi-VN')} VND (Lộc, Diệu)`);
    console.log(`   - Đơn giá/phòng: ${SALARY_CONFIG.DEFAULT_PER_ROOM_RATE.toLocaleString('vi-VN')} VND`);
    console.log('----------------------------------------------------');
    console.log('🔐 Tài khoản đăng nhập hệ thống:');
    console.log('1. Admin: vistay / 12345678');
    console.log('2. Manager: loc / 12345678, dieu / 12345678');
    console.log('3. NV: lien, thien, thuong, van, hoan, parttime1, parttime2 / 12345678');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ SEED ERROR:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

seed();
