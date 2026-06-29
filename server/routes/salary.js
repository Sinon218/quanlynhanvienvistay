// ===================================================================
// Salary Routes — Calculation and Config
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper to calculate room shares dynamically
async function calculateDynamicRooms(month, year) {
  const pool = await getPool();
  const res = await pool.request()
    .input('month', sql.Int, month)
    .input('year', sql.Int, year)
    .query(`
      SELECT id, staff_id, apartment_id, assigned_date, assigned_role
      FROM WorkAssignments
      WHERE status = 'approved'
        AND MONTH(assigned_date) = @month
        AND YEAR(assigned_date) = @year
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
  const staffRooms = {};
  assignments.forEach(a => {
    const share = shares[a.id] || 0;
    staffRooms[a.staff_id] = (staffRooms[a.staff_id] || 0) + share;
  });

  return staffRooms;
}

// GET /api/salary — Bảng lương toàn bộ nhân viên (Admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const staffRooms = await calculateDynamicRooms(currentMonth, currentYear);

    const pool = await getPool();
    const result = await pool.request()
      .input('month', sql.Int, currentMonth)
      .input('year', sql.Int, currentYear)
      .query(`
        SELECT 
          s.id as staff_id,
          s.name,
          s.type,
          ISNULL(sr.base_salary, s.base_salary) as base_salary,
          ISNULL(sr.per_room_rate, s.per_room_rate) as per_room_rate,
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
      const baseSalary = row.base_salary || 0;
      const rate = row.per_room_rate || 50000; // Mặc định 50k/căn nếu chưa cấu hình
      
      // Nếu có total_rooms lưu trong DB thì dùng, không thì lấy từ tính toán động
      const calculatedRooms = staffRooms[row.staff_id] || 0;
      const totalRooms = row.saved_total_rooms !== null ? parseFloat(row.saved_total_rooms) : calculatedRooms;
      const roundedRooms = Math.round(totalRooms * 100) / 100;

      const roomBonus = roundedRooms * rate;
      const totalSalary = baseSalary + roomBonus + row.bonus - row.deductions;

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
    const result = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('month', sql.Int, currentMonth)
      .input('year', sql.Int, currentYear)
      .query(`
        SELECT 
          s.id as staff_id,
          s.name,
          s.type,
          ISNULL(sr.base_salary, s.base_salary) as base_salary,
          ISNULL(sr.per_room_rate, s.per_room_rate) as per_room_rate,
          sr.total_rooms as saved_total_rooms,
          ISNULL(sr.bonus, 0) as bonus,
          ISNULL(sr.deductions, 0) as deductions,
          sr.notes
        FROM Staff s
        LEFT JOIN SalaryRecords sr ON s.id = sr.staff_id AND sr.month = @month AND sr.year = @year
        WHERE s.id = @staffId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

    const row = result.recordset[0];
    const baseSalary = row.base_salary || 0;
    const rate = row.per_room_rate || 50000;
    
    const calculatedRooms = staffRooms[row.staff_id] || 0;
    const totalRooms = row.saved_total_rooms !== null ? parseFloat(row.saved_total_rooms) : calculatedRooms;
    const roundedRooms = Math.round(totalRooms * 100) / 100;

    const roomBonus = roundedRooms * rate;
    const totalSalary = baseSalary + roomBonus + row.bonus - row.deductions;

    res.json({
      staff_id: row.staff_id,
      name: row.name,
      type: row.type,
      base_salary: baseSalary,
      per_room_rate: rate,
      total_rooms: roundedRooms,
      room_bonus: roomBonus,
      bonus: row.bonus,
      deductions: row.deductions,
      total_salary: totalSalary,
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
    const total = base + (rooms * rate) + bon - ded;

    const pool = await getPool();
    
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
        .input('notes', sql.NVarChar, notes)
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
        .input('notes', sql.NVarChar, notes)
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
