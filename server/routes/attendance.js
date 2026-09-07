// ===================================================================
// Attendance Routes — Part-Time Check-in/Out
// API: /api/attendance
// ===================================================================
const express = require('express');
const { sql, runQuery } = require('../db');
const { authenticate, requireAdmin, requireParttime } = require('../middleware/auth');
const CONFIG = require('../config');

const router = express.Router();

// ===== HELPER: Làm tròn thời gian theo mốc 15 phút =====
function roundToNearest15(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const interval = CONFIG.PARTTIME.ROUND_INTERVAL_MINUTES;
  const rounded = Math.round(minutes / interval) * interval;
  if (rounded >= 60) {
    return `${String(hours + 1).padStart(2, '0')}:00`;
  }
  return `${String(hours).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`;
}

// ===== HELPER: Tính tổng giờ làm =====
function calculateTotalHours(checkInRounded, checkOutRounded) {
  if (!checkInRounded || !checkOutRounded) return null;
  const [inH, inM] = checkInRounded.split(':').map(Number);
  const [outH, outM] = checkOutRounded.split(':').map(Number);
  const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMinutes <= 0) return 0;
  return Math.round((totalMinutes / 60) * 100) / 100;
}

// ===== POST /api/attendance/check-in =====
router.post('/check-in', authenticate, requireParttime, async (req, res) => {
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(400).json({ error: 'Không tìm thấy thông tin nhân viên.' });
    }

    const now = new Date();
    const workDate = now.toISOString().split('T')[0];
    const checkInRounded = roundToNearest15(now);

    // Kiểm tra đã check-in hôm nay chưa
    const existing = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('workDate', sql.Date, workDate)
        .query('SELECT id, check_out FROM Attendance WHERE staff_id = @staffId AND work_date = @workDate');
    });

    if (existing.recordset.length > 0) {
      const record = existing.recordset[0];
      if (record.check_out) {
        return res.status(400).json({ error: 'Bạn đã check-in và check-out hôm nay rồi.' });
      }
      return res.status(400).json({ error: 'Bạn đã check-in hôm nay rồi. Hãy check-out khi tan ca.' });
    }

    // Tạo bản ghi mới
    await runQuery(async (pool) => {
      await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('checkIn', sql.DateTime, now)
        .input('checkInRounded', sql.VarChar, checkInRounded)
        .input('workDate', sql.Date, workDate)
        .query(`
          INSERT INTO Attendance (staff_id, check_in, check_in_rounded, work_date)
          VALUES (@staffId, @checkIn, @checkInRounded, @workDate)
        `);
    });

    res.json({
      message: 'Check-in thành công!',
      check_in: now.toISOString(),
      check_in_rounded: checkInRounded,
      work_date: workDate
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ===== POST /api/attendance/check-out =====
router.post('/check-out', authenticate, requireParttime, async (req, res) => {
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(400).json({ error: 'Không tìm thấy thông tin nhân viên.' });
    }

    const now = new Date();
    const workDate = now.toISOString().split('T')[0];
    const checkOutRounded = roundToNearest15(now);

    // Tìm bản ghi check-in hôm nay
    const existing = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('workDate', sql.Date, workDate)
        .query('SELECT id, check_in_rounded FROM Attendance WHERE staff_id = @staffId AND work_date = @workDate');
    });

    if (existing.recordset.length === 0) {
      return res.status(400).json({ error: 'Bạn chưa check-in hôm nay. Hãy check-in trước.' });
    }

    const record = existing.recordset[0];
    if (record.check_out_rounded) {
      return res.status(400).json({ error: 'Bạn đã check-out hôm nay rồi.' });
    }

    const totalHours = calculateTotalHours(record.check_in_rounded, checkOutRounded);

    // Cập nhật check-out
    await runQuery(async (pool) => {
      await pool.request()
        .input('id', sql.Int, record.id)
        .input('checkOut', sql.DateTime, now)
        .input('checkOutRounded', sql.VarChar, checkOutRounded)
        .input('totalHours', sql.Decimal(5, 2), totalHours)
        .query(`
          UPDATE Attendance 
          SET check_out = @checkOut, check_out_rounded = @checkOutRounded, total_hours = @totalHours
          WHERE id = @id
        `);
    });

    res.json({
      message: 'Check-out thành công!',
      check_out: now.toISOString(),
      check_out_rounded: checkOutRounded,
      total_hours: totalHours,
      work_date: workDate
    });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ===== GET /api/attendance/today =====
router.get('/today', authenticate, requireParttime, async (req, res) => {
  try {
    const staffId = req.user.staffId;
    const workDate = new Date().toISOString().split('T')[0];

    const result = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('workDate', sql.Date, workDate)
        .query(`
          SELECT id, check_in, check_in_rounded, check_out, check_out_rounded, 
                 total_hours, work_date, notes
          FROM Attendance 
          WHERE staff_id = @staffId AND work_date = @workDate
        `);
    });

    if (result.recordset.length === 0) {
      return res.json({ checked_in: false, checked_out: false });
    }

    const record = result.recordset[0];
    res.json({
      checked_in: true,
      checked_out: !!record.check_out,
      check_in: record.check_in,
      check_in_rounded: record.check_in_rounded,
      check_out: record.check_out,
      check_out_rounded: record.check_out_rounded,
      total_hours: record.total_hours,
      work_date: record.work_date
    });
  } catch (err) {
    console.error('Get today attendance error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ===== GET /api/attendance/history =====
router.get('/history', authenticate, requireParttime, async (req, res) => {
  try {
    const staffId = req.user.staffId;
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const result = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('month', sql.Int, currentMonth)
        .input('year', sql.Int, currentYear)
        .query(`
          SELECT id, check_in, check_in_rounded, check_out, check_out_rounded, 
                 total_hours, work_date, notes
          FROM Attendance 
          WHERE staff_id = @staffId 
            AND MONTH(work_date) = @month 
            AND YEAR(work_date) = @year
          ORDER BY work_date DESC
        `);
    });

    // Tính tổng giờ tháng
    const totalHoursMonth = result.recordset.reduce((sum, r) => sum + (parseFloat(r.total_hours) || 0), 0);

    res.json({
      records: result.recordset,
      total_hours_month: Math.round(totalHoursMonth * 100) / 100,
      month: currentMonth,
      year: currentYear
    });
  } catch (err) {
    console.error('Get attendance history error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ===== GET /api/attendance/all — Admin/Manager xem tất cả =====
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const { month, year, staff_id } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    let query = `
      SELECT a.id, a.staff_id, s.name as staff_name, 
             a.check_in, a.check_in_rounded, a.check_out, a.check_out_rounded,
             a.total_hours, a.work_date, a.notes
      FROM Attendance a
      JOIN Staff s ON a.staff_id = s.id
      JOIN Users u ON s.id = u.staff_id
      WHERE MONTH(a.work_date) = @month 
        AND YEAR(a.work_date) = @year
        AND u.role = 'parttime'
    `;

    const result = await runQuery(async (pool) => {
      const request = pool.request()
        .input('month', sql.Int, currentMonth)
        .input('year', sql.Int, currentYear);

      if (staff_id) {
        query += ' AND a.staff_id = @staffId';
        request.input('staffId', sql.Int, parseInt(staff_id));
      }

      query += ' ORDER BY a.work_date DESC, s.name ASC';
      return await request.query(query);
    });

    // Nhóm theo nhân viên
    const staffSummary = {};
    result.recordset.forEach(r => {
      if (!staffSummary[r.staff_id]) {
        staffSummary[r.staff_id] = {
          staff_id: r.staff_id,
          name: r.staff_name,
          records: [],
          total_hours: 0
        };
      }
      staffSummary[r.staff_id].records.push(r);
      staffSummary[r.staff_id].total_hours += parseFloat(r.total_hours) || 0;
    });

    // Làm tròn tổng giờ
    Object.values(staffSummary).forEach(s => {
      s.total_hours = Math.round(s.total_hours * 100) / 100;
    });

    res.json({
      records: result.recordset,
      summary: Object.values(staffSummary),
      month: currentMonth,
      year: currentYear
    });
  } catch (err) {
    console.error('Get all attendance error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ===== GET /api/attendance/staff/:staffId — Admin xem 1 nhân viên =====
router.get('/staff/:staffId', authenticate, requireAdmin, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const result = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('month', sql.Int, currentMonth)
        .input('year', sql.Int, currentYear)
        .query(`
          SELECT a.id, a.check_in, a.check_in_rounded, a.check_out, a.check_out_rounded,
                 a.total_hours, a.work_date, a.notes, s.name as staff_name
          FROM Attendance a
          JOIN Staff s ON a.staff_id = s.id
          WHERE a.staff_id = @staffId 
            AND MONTH(a.work_date) = @month 
            AND YEAR(a.work_date) = @year
          ORDER BY a.work_date DESC
        `);
    });

    const totalHoursMonth = result.recordset.reduce((sum, r) => sum + (parseFloat(r.total_hours) || 0), 0);

    res.json({
      staff_id: staffId,
      name: result.recordset.length > 0 ? result.recordset[0].staff_name : '',
      records: result.recordset,
      total_hours_month: Math.round(totalHoursMonth * 100) / 100,
      month: currentMonth,
      year: currentYear
    });
  } catch (err) {
    console.error('Get staff attendance error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
