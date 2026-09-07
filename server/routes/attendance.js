// ===================================================================
// Attendance Routes — Part-Time Check-in/Out
// API: /api/attendance
// ===================================================================
const express = require('express');
const { sql, runQuery } = require('../db');
const { authenticate, requireAdmin, requireParttime } = require('../middleware/auth');
const CONFIG = require('../config');

const router = express.Router();

const ROUND_MINUTES = CONFIG.PARTTIME.ROUND_INTERVAL_MINUTES;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// ===== HELPERS =====
function roundToNearest15(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const rounded = Math.round(minutes / ROUND_MINUTES) * ROUND_MINUTES;
  if (rounded >= 60) {
    return `${String(hours + 1).padStart(2, '0')}:00`;
  }
  return `${String(hours).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`;
}

function getVnDate(date) {
  return new Date(date.getTime() + VN_OFFSET_MS);
}

function getWorkDate(date) {
  return getVnDate(date).toISOString().split('T')[0];
}

function calculateTotalHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMinutes <= 0) return 0;
  return Math.round((totalMinutes / 60) * 100) / 100;
}

function getMonthRange(month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
}

function parseIntSafe(val, fallback) {
  const n = parseInt(val);
  return isNaN(n) ? fallback : n;
}

// ===== POST /api/attendance/check-in =====
router.post('/check-in', authenticate, requireParttime, async (req, res) => {
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(400).json({ error: 'Không tìm thấy thông tin nhân viên.' });
    }

    const now = new Date();
    const workDate = getWorkDate(now);
    const checkInRounded = roundToNearest15(now);

    const result = await runQuery(async (pool) => {
      const existing = await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('workDate', sql.Date, workDate)
        .query('SELECT id, check_out FROM Attendance WHERE staff_id = @staffId AND work_date = @workDate');

      if (existing.recordset.length > 0) {
        const record = existing.recordset[0];
        if (record.check_out) {
          throw Object.assign(new Error('Bạn đã check-in và check-out hôm nay rồi.'), { statusCode: 400 });
        }
        throw Object.assign(new Error('Bạn đã check-in hôm nay rồi. Hãy check-out khi tan ca.'), { statusCode: 400 });
      }

      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('checkIn', sql.DateTime, now)
        .input('checkInRounded', sql.VarChar, checkInRounded)
        .input('workDate', sql.Date, workDate)
        .query('INSERT INTO Attendance (staff_id, check_in, check_in_rounded, work_date) VALUES (@staffId, @checkIn, @checkInRounded, @workDate)');
    });

    res.json({
      message: 'Check-in thành công!',
      check_in: now.toISOString(),
      check_in_rounded: checkInRounded,
      work_date: workDate
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'Lỗi server.' : err.message });
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
    const workDate = getWorkDate(now);
    const checkOutRounded = roundToNearest15(now);

    const result = await runQuery(async (pool) => {
      const existing = await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('workDate', sql.Date, workDate)
        .query('SELECT id, check_in_rounded, check_out_rounded FROM Attendance WHERE staff_id = @staffId AND work_date = @workDate');

      if (existing.recordset.length === 0) {
        throw Object.assign(new Error('Bạn chưa check-in hôm nay. Hãy check-in trước.'), { statusCode: 400 });
      }

      const record = existing.recordset[0];
      if (record.check_out_rounded) {
        throw Object.assign(new Error('Bạn đã check-out hôm nay rồi.'), { statusCode: 400 });
      }

      const totalHours = calculateTotalHours(record.check_in_rounded, checkOutRounded);

      return await pool.request()
        .input('id', sql.Int, record.id)
        .input('checkOut', sql.DateTime, now)
        .input('checkOutRounded', sql.VarChar, checkOutRounded)
        .input('totalHours', sql.Decimal(5, 2), totalHours)
        .query('UPDATE Attendance SET check_out = @checkOut, check_out_rounded = @checkOutRounded, total_hours = @totalHours WHERE id = @id');
    });

    res.json({
      message: 'Check-out thành công!',
      check_out: now.toISOString(),
      check_out_rounded: checkOutRounded,
      total_hours: calculateTotalHours(result.recordset?.[0]?.check_in_rounded, checkOutRounded),
      work_date: workDate
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'Lỗi server.' : err.message });
  }
});

// ===== GET /api/attendance/today =====
router.get('/today', authenticate, requireParttime, async (req, res) => {
  try {
    const staffId = req.user.staffId;
    const workDate = getWorkDate(new Date());

    const result = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('workDate', sql.Date, workDate)
        .query('SELECT check_in, check_in_rounded, check_out, check_out_rounded, total_hours FROM Attendance WHERE staff_id = @staffId AND work_date = @workDate');
    });

    if (result.recordset.length === 0) {
      return res.json({ checked_in: false, checked_out: false });
    }

    const r = result.recordset[0];
    res.json({
      checked_in: true,
      checked_out: !!r.check_out,
      check_in_rounded: r.check_in_rounded,
      check_out_rounded: r.check_out_rounded,
      total_hours: r.total_hours
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
    const month = parseIntSafe(req.query.month, new Date().getMonth() + 1);
    const year = parseIntSafe(req.query.year, new Date().getFullYear());
    const { start, end } = getMonthRange(month, year);

    const result = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('start', sql.Date, start)
        .input('end', sql.Date, end)
        .query(`
          SELECT check_in_rounded, check_out_rounded, total_hours, work_date, notes
          FROM Attendance 
          WHERE staff_id = @staffId AND work_date >= @start AND work_date <= @end
          ORDER BY work_date DESC
        `);
    });

    const totalHoursMonth = result.recordset.reduce((sum, r) => sum + (parseFloat(r.total_hours) || 0), 0);

    res.json({
      records: result.recordset,
      total_hours_month: Math.round(totalHoursMonth * 100) / 100,
      month, year
    });
  } catch (err) {
    console.error('Get attendance history error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ===== GET /api/attendance/all — Admin/Manager xem tất cả =====
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const month = parseIntSafe(req.query.month, new Date().getMonth() + 1);
    const year = parseIntSafe(req.query.year, new Date().getFullYear());
    const staffId = req.query.staff_id ? parseIntSafe(req.query.staff_id, null) : null;
    const { start, end } = getMonthRange(month, year);

    const result = await runQuery(async (pool) => {
      const request = pool.request()
        .input('start', sql.Date, start)
        .input('end', sql.Date, end);

      let where = 'AND u.role = \'parttime\'';
      if (staffId) {
        where += ' AND a.staff_id = @staffId';
        request.input('staffId', sql.Int, staffId);
      }

      return await request.query(`
        SELECT a.id, a.staff_id, s.name as staff_name, 
               a.check_in_rounded, a.check_out_rounded,
               a.total_hours, a.work_date, a.notes
        FROM Attendance a
        JOIN Staff s ON a.staff_id = s.id
        JOIN Users u ON s.id = u.staff_id
        WHERE a.work_date >= @start AND a.work_date <= @end ${where}
        ORDER BY a.work_date DESC, s.name ASC
      `);
    });

    const staffSummary = {};
    result.recordset.forEach(r => {
      if (!staffSummary[r.staff_id]) {
        staffSummary[r.staff_id] = { staff_id: r.staff_id, name: r.staff_name, total_hours: 0 };
      }
      staffSummary[r.staff_id].total_hours += parseFloat(r.total_hours) || 0;
    });

    Object.values(staffSummary).forEach(s => {
      s.total_hours = Math.round(s.total_hours * 100) / 100;
    });

    res.json({
      records: result.recordset,
      summary: Object.values(staffSummary),
      month, year
    });
  } catch (err) {
    console.error('Get all attendance error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ===== GET /api/attendance/staff/:staffId — Admin xem 1 nhân viên =====
router.get('/staff/:staffId', authenticate, requireAdmin, async (req, res) => {
  try {
    const staffId = parseIntSafe(req.params.staffId, 0);
    if (!staffId) return res.status(400).json({ error: 'ID không hợp lệ.' });

    const month = parseIntSafe(req.query.month, new Date().getMonth() + 1);
    const year = parseIntSafe(req.query.year, new Date().getFullYear());
    const { start, end } = getMonthRange(month, year);

    const result = await runQuery(async (pool) => {
      return await pool.request()
        .input('staffId', sql.Int, staffId)
        .input('start', sql.Date, start)
        .input('end', sql.Date, end)
        .query(`
          SELECT a.check_in_rounded, a.check_out_rounded,
                 a.total_hours, a.work_date, a.notes, s.name as staff_name
          FROM Attendance a
          JOIN Staff s ON a.staff_id = s.id
          WHERE a.staff_id = @staffId AND a.work_date >= @start AND a.work_date <= @end
          ORDER BY a.work_date DESC
        `);
    });

    const totalHoursMonth = result.recordset.reduce((sum, r) => sum + (parseFloat(r.total_hours) || 0), 0);

    res.json({
      staff_id: staffId,
      name: result.recordset.length > 0 ? result.recordset[0].staff_name : '',
      records: result.recordset,
      total_hours_month: Math.round(totalHoursMonth * 100) / 100,
      month, year
    });
  } catch (err) {
    console.error('Get staff attendance error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
