// ===================================================================
// Salary Routes — Calculation and Config
// Cấu trúc 3 tầng: App Layer (Business Logic)
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');

const router = express.Router();

const CONFIG = require('../config');
const { SALARY, ROOM_RATES } = CONFIG;

const SALARY_CONFIG = {
  DEFAULT_BASE_SALARY: SALARY.DEFAULT_BASE_SALARY,
  SPECIAL_BASE_SALARY: SALARY.SPECIAL_BASE_SALARY,
  DEFAULT_PER_ROOM_RATE: ROOM_RATES.DEFAULT,
  SPECIAL_STAFF_NAMES: SALARY.SPECIAL_STAFF,
};

// Helper: Lấy lương cơ bản theo tên nhân viên
function getBaseSalaryForStaff(staffName, dbBaseSalary) {
  if (dbBaseSalary && dbBaseSalary > 0) return dbBaseSalary;
  if (SALARY_CONFIG.SPECIAL_STAFF_NAMES.includes(staffName)) {
    return SALARY_CONFIG.SPECIAL_BASE_SALARY;
  }
  return SALARY_CONFIG.DEFAULT_BASE_SALARY;
}

// Helper to calculate room shares dynamically
async function calculateDynamicRooms(month, year) {
  const pool = await getPool();
  const res = await pool.request()
    .input('month', sql.Int, month)
    .input('year', sql.Int, year)
    .query(`
      SELECT wa.id, wa.staff_id, wa.apartment_id, wa.assigned_date, wa.assigned_role, wa.task_type,
             a.room_type
      FROM WorkAssignments wa
      JOIN Apartments a ON wa.apartment_id = a.id
      WHERE wa.status = 'approved'
        AND MONTH(wa.assigned_date) = @month
        AND YEAR(wa.assigned_date) = @year
    `);

  const assignments = res.recordset;
  // Group by date and apartment
  const groups = {};
  assignments.forEach(a => {
    const dateStr = new Date(a.assigned_date).toISOString().split('T')[0];
    const key = `${a.apartment_id}_${dateStr}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

  const shares = {}; // wa.id -> share factor
  Object.values(groups).forEach(group => {
    if (group.length === 1) {
      shares[group[0].id] = 1.0;
    } else if (group.length === 2) {
      const a1 = group[0];
      const a2 = group[1];
      const r1 = a1.assigned_role;
      const r2 = a2.assigned_role;

      if (r1 === r2) {
        shares[a1.id] = 0.5;
        shares[a2.id] = 0.5;
      } else if (r1 === 1 && (r2 === 2 || r2 === 0)) {
        shares[a1.id] = 2/3;
        shares[a2.id] = 1/3;
      } else if (r2 === 1 && (r1 === 2 || r1 === 0)) {
        shares[a1.id] = 1/3;
        shares[a2.id] = 2/3;
      } else {
        shares[a1.id] = 0.5;
        shares[a2.id] = 0.5;
      }
    } else {
      // More than 2, split equally
      const shareVal = 1 / group.length;
      group.forEach(a => {
        shares[a.id] = shareVal;
      });
    }
  });

  // Sum by staff_id
  const staffCalculated = {};
  assignments.forEach(a => {
    const share = shares[a.id] || 0;
    const taskRates = ROOM_RATES[a.task_type] || ROOM_RATES['out'];
    const rate = taskRates[a.room_type] || ROOM_RATES.DEFAULT;
    const bonus = share * rate;
    
    if (!staffCalculated[a.staff_id]) {
      staffCalculated[a.staff_id] = { rooms: 0, bonus: 0 };
    }
    staffCalculated[a.staff_id].rooms += share;
    staffCalculated[a.staff_id].bonus += bonus;
  });

  return staffCalculated;
}

// GET /api/salary — Bảng lương toàn bộ nhân viên (Admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const staffRooms = await calculateDynamicRooms(currentMonth, currentYear);

    const pool = await getPool();
    
    // Fetch tech task salary for all staff members
    const techSalaryRes = await pool.request()
      .input('month', sql.Int, currentMonth)
      .input('year', sql.Int, currentYear)
      .query(`
        SELECT staff_id, SUM(ISNULL(tech_price, 0)) as tech_salary
        FROM Tasks
        WHERE status = 'approved'
          AND MONTH(assigned_date) = @month
          AND YEAR(assigned_date) = @year
        GROUP BY staff_id
      `);
    const techSalaries = {};
    techSalaryRes.recordset.forEach(r => {
      techSalaries[r.staff_id] = parseFloat(r.tech_salary) || 0;
    });

    const result = await pool.request()
      .input('month', sql.Int, currentMonth)
      .input('year', sql.Int, currentYear)
      .query(`
        SELECT 
          s.id as staff_id,
          s.name,
          s.type,
          s.base_salary as staff_base_salary,
          s.per_room_rate as staff_per_room_rate,
          sr.base_salary as sr_base_salary,
          sr.per_room_rate as sr_per_room_rate,
          sr.total_rooms as saved_total_rooms,
          ISNULL(sr.bonus, 0) as bonus,
          ISNULL(sr.deductions, 0) as deductions,
          sr.id as record_id,
          sr.notes
        FROM Staff s
        LEFT JOIN SalaryRecords sr ON s.id = sr.staff_id AND sr.month = @month AND sr.year = @year
        ORDER BY s.id
      `);

    // Tính toán lương động nếu chưa được lưu chính thức
    const salaryTable = result.recordset.map(row => {
      // Ưu tiên: SalaryRecords > Staff table > Cấu hình cố định
      const baseSalary = row.sr_base_salary != null 
        ? row.sr_base_salary 
        : getBaseSalaryForStaff(row.name, row.staff_base_salary);
      
      const rate = row.sr_per_room_rate != null
        ? row.sr_per_room_rate
        : (row.staff_per_room_rate || SALARY_CONFIG.DEFAULT_PER_ROOM_RATE);
      
      // Nếu có total_rooms lưu trong DB thì dùng, không thì lấy từ tính toán động
      const calculatedData = staffRooms[row.staff_id] || { rooms: 0, bonus: 0 };
      const totalRooms = row.saved_total_rooms !== null ? parseFloat(row.saved_total_rooms) : calculatedData.rooms;
      const roundedRooms = Math.round(totalRooms * 100) / 100;

      let roomBonus = 0;
      if (row.record_id) {
        roomBonus = roundedRooms * rate;
      } else {
        roomBonus = calculatedData.bonus;
      }
      
      const techTaskSalary = techSalaries[row.staff_id] || 0;
      const totalSalary = baseSalary + roomBonus + techTaskSalary + row.bonus - row.deductions;

      return {
        staff_id: row.staff_id,
        name: row.name,
        type: row.type,
        base_salary: baseSalary,
        per_room_rate: rate,
        total_rooms: roundedRooms,
        bonus: row.bonus,
        deductions: row.deductions,
        room_bonus: roomBonus,
        tech_task_salary: techTaskSalary,
        total_salary: totalSalary,
        record_id: row.record_id,
        notes: row.notes || ''
      };
    });

    res.json(salaryTable);
  } catch (err) {
    console.error('Get salary list error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/salary/:staffId — Xem lương dự kiến của bản thân (Self or Admin)
router.get('/:staffId', authenticate, requireSelfOrAdmin, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const staffRooms = await calculateDynamicRooms(currentMonth, currentYear);

    const pool = await getPool();
    
    // Fetch tech task salary for this staff member
    const techSalaryRes = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('month', sql.Int, currentMonth)
      .input('year', sql.Int, currentYear)
      .query(`
        SELECT SUM(ISNULL(tech_price, 0)) as tech_salary
        FROM Tasks
        WHERE staff_id = @staffId
          AND status = 'approved'
          AND MONTH(assigned_date) = @month
          AND YEAR(assigned_date) = @year
      `);
    const techTaskSalary = parseFloat(techSalaryRes.recordset[0].tech_salary) || 0;

    const result = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('month', sql.Int, currentMonth)
      .input('year', sql.Int, currentYear)
      .query(`
        SELECT 
          s.id as staff_id,
          s.name,
          s.type,
          s.base_salary as staff_base_salary,
          s.per_room_rate as staff_per_room_rate,
          sr.base_salary as sr_base_salary,
          sr.per_room_rate as sr_per_room_rate,
          sr.total_rooms as saved_total_rooms,
          ISNULL(sr.bonus, 0) as bonus,
          ISNULL(sr.deductions, 0) as deductions,
          sr.id as record_id,
          sr.notes
        FROM Staff s
        LEFT JOIN SalaryRecords sr ON s.id = sr.staff_id AND sr.month = @month AND sr.year = @year
        WHERE s.id = @staffId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

    const row = result.recordset[0];
    const baseSalary = row.sr_base_salary != null 
      ? row.sr_base_salary 
      : getBaseSalaryForStaff(row.name, row.staff_base_salary);
    
    const rate = row.sr_per_room_rate != null
      ? row.sr_per_room_rate
      : (row.staff_per_room_rate || SALARY_CONFIG.DEFAULT_PER_ROOM_RATE);
    
    const calculatedData = staffRooms[row.staff_id] || { rooms: 0, bonus: 0 };
    const totalRooms = row.saved_total_rooms !== null ? parseFloat(row.saved_total_rooms) : calculatedData.rooms;
    const roundedRooms = Math.round(totalRooms * 100) / 100;

    let roomBonus = 0;
    if (row.record_id) {
      roomBonus = roundedRooms * rate;
    } else {
      roomBonus = calculatedData.bonus;
    }
    const totalSalary = baseSalary + roomBonus + techTaskSalary + row.bonus - row.deductions;

    res.json({
      staff_id: row.staff_id,
      name: row.name,
      type: row.type,
      base_salary: baseSalary,
      per_room_rate: rate,
      total_rooms: roundedRooms,
      room_bonus: roomBonus,
      tech_task_salary: techTaskSalary,
      bonus: row.bonus,
      deductions: row.deductions,
      total_salary: totalSalary,
      record_id: row.record_id,
      notes: row.notes || ''
    });
  } catch (err) {
    console.error('Get employee salary error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/salary/save — Lưu/Chốt lương tháng (Admin only)
router.post('/save', authenticate, requireAdmin, async (req, res) => {
  try {
    const { staff_id, month, year, base_salary, per_room_rate, total_rooms, bonus, deductions, notes } = req.body;
    if (!staff_id || !month || !year) {
      return res.status(400).json({ error: 'Thiếu thông tin chốt lương.' });
    }

    const rate = per_room_rate || 0;
    const rooms = total_rooms || 0;
    const base = base_salary || 0;
    const bon = bonus || 0;
    const ded = deductions || 0;

    const pool = await getPool();

    // Fetch tech task salary for this staff member
    const techSalaryRes = await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('month', sql.Int, month)
      .input('year', sql.Int, year)
      .query(`
        SELECT SUM(ISNULL(tech_price, 0)) as tech_salary
        FROM Tasks
        WHERE staff_id = @staffId
          AND status = 'approved'
          AND MONTH(assigned_date) = @month
          AND YEAR(assigned_date) = @year
      `);
    const techTaskSalary = parseFloat(techSalaryRes.recordset[0].tech_salary) || 0;
    const total = base + (rooms * rate) + techTaskSalary + bon - ded;
    
    // Kiểm tra bản ghi đã tồn tại chưa
    const check = await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('month', sql.Int, month)
      .input('year', sql.Int, year)
      .query('SELECT id FROM SalaryRecords WHERE staff_id = @staffId AND month = @month AND year = @year');

    if (check.recordset.length > 0) {
      // Update
      await pool.request()
        .input('staffId', sql.Int, staff_id)
        .input('month', sql.Int, month)
        .input('year', sql.Int, year)
        .input('base', sql.Decimal(12,0), base)
        .input('rate', sql.Decimal(10,0), rate)
        .input('rooms', sql.Decimal(6,2), rooms)
        .input('bonus', sql.Decimal(12,0), bon)
        .input('deductions', sql.Decimal(12,0), ded)
        .input('total', sql.Decimal(12,0), total)
        .input('notes', sql.NVarChar, notes || '')
        .query(`
          UPDATE SalaryRecords 
          SET base_salary = @base, per_room_rate = @rate, total_rooms = @rooms, 
              bonus = @bonus, deductions = @deductions, total_salary = @total, notes = @notes
          WHERE staff_id = @staffId AND month = @month AND year = @year
        `);
    } else {
      // Insert
      await pool.request()
        .input('staffId', sql.Int, staff_id)
        .input('month', sql.Int, month)
        .input('year', sql.Int, year)
        .input('base', sql.Decimal(12,0), base)
        .input('rate', sql.Decimal(10,0), rate)
        .input('rooms', sql.Decimal(6,2), rooms)
        .input('bonus', sql.Decimal(12,0), bon)
        .input('deductions', sql.Decimal(12,0), ded)
        .input('total', sql.Decimal(12,0), total)
        .input('notes', sql.NVarChar, notes || '')
        .query(`
          INSERT INTO SalaryRecords (staff_id, month, year, base_salary, per_room_rate, total_rooms, bonus, deductions, total_salary, notes)
          VALUES (@staffId, @month, @year, @base, @rate, @rooms, @bonus, @deductions, @total, @notes)
        `);
    }

    res.json({ message: 'Lưu bảng lương thành công.' });
  } catch (err) {
    console.error('Save salary error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
