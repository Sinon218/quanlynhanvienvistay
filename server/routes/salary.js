// ===================================================================
// Salary Routes — Calculation and Config
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/salary — Bảng lương toàn bộ nhân viên (Admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

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
          ISNULL(sr.total_rooms, (
            SELECT COUNT(*) FROM WorkAssignments wa 
            WHERE wa.staff_id = s.id 
              AND MONTH(wa.assigned_date) = @month 
              AND YEAR(wa.assigned_date) = @year 
              AND wa.status = 'completed'
          )) as total_rooms,
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
      const roomBonus = row.total_rooms * rate;
      const totalSalary = baseSalary + roomBonus + row.bonus - row.deductions;

      return {
        staff_id: row.staff_id,
        name: row.name,
        type: row.type,
        base_salary: baseSalary,
        per_room_rate: rate,
        total_rooms: row.total_rooms,
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
          ISNULL(sr.total_rooms, (
            SELECT COUNT(*) FROM WorkAssignments wa 
            WHERE wa.staff_id = s.id 
              AND MONTH(wa.assigned_date) = @month 
              AND YEAR(wa.assigned_date) = @year 
              AND wa.status = 'completed'
          )) as total_rooms,
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
    const roomBonus = row.total_rooms * rate;
    const totalSalary = baseSalary + roomBonus + row.bonus - row.deductions;

    res.json({
      staff_id: row.staff_id,
      name: row.name,
      type: row.type,
      base_salary: baseSalary,
      per_room_rate: rate,
      total_rooms: row.total_rooms,
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
        .input('rooms', sql.Int, rooms)
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
        .input('rooms', sql.Int, rooms)
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
