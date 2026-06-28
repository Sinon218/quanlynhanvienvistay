// ===================================================================
// Work Routes — Assignment + Tracking
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/work/assign — Giao căn hộ cho NV (Admin only)
router.post('/assign', authenticate, requireAdmin, async (req, res) => {
  try {
    const { staff_id, apartment_id, assigned_date, task_type } = req.body;
    if (!staff_id || !apartment_id) {
      return res.status(400).json({ error: 'Thiếu thông tin nhân viên hoặc căn hộ.' });
    }

    const validTypes = ['ss_luu', 'out', 'tong_ve_sinh'];
    const type = validTypes.includes(task_type) ? task_type : 'out';

    const pool = await getPool();
    const date = assigned_date || new Date().toISOString().split('T')[0];

    // Kiểm tra trùng lặp
    const check = await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('apartmentId', sql.Int, apartment_id)
      .input('date', sql.Date, date)
      .query(`
        SELECT id FROM WorkAssignments 
        WHERE staff_id = @staffId AND apartment_id = @apartmentId AND assigned_date = @date
      `);

    if (check.recordset.length > 0) {
      return res.status(400).json({ error: 'Căn hộ này đã được giao cho nhân viên này trong ngày.' });
    }

    await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('apartmentId', sql.Int, apartment_id)
      .input('date', sql.Date, date)
      .input('taskType', sql.VarChar, type)
      .query(`
        INSERT INTO WorkAssignments (staff_id, apartment_id, assigned_date, task_type)
        VALUES (@staffId, @apartmentId, @date, @taskType)
      `);

    res.json({ message: 'Giao việc thành công.' });
  } catch (err) {
    console.error('Assign work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/work/:id — Hủy phân công (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM WorkAssignments WHERE id = @id');
    res.json({ message: 'Đã hủy phân công.' });
  } catch (err) {
    console.error('Delete assignment error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/work/:id/complete — Đánh dấu hoàn thành
router.put('/:id/complete', authenticate, async (req, res) => {
  try {
    const pool = await getPool();

    // Nếu là employee, chỉ được đánh dấu việc của bản thân
    if (req.user.role === 'employee') {
      const check = await pool.request()
        .input('id', sql.Int, req.params.id)
        .input('staffId', sql.Int, req.user.staffId)
        .query('SELECT id FROM WorkAssignments WHERE id = @id AND staff_id = @staffId');

      if (check.recordset.length === 0) {
        return res.status(403).json({ error: 'Bạn chỉ có thể hoàn thành công việc của bản thân.' });
      }
    }

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE WorkAssignments 
        SET status = 'completed', completed_at = GETDATE() 
        WHERE id = @id
      `);

    res.json({ message: 'Đã đánh dấu hoàn thành.' });
  } catch (err) {
    console.error('Complete work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/work/today — Công việc hôm nay
router.get('/today', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT wa.*, a.code, a.building, a.is_samsung, s.name as staff_name
      FROM WorkAssignments wa
      JOIN Apartments a ON wa.apartment_id = a.id
      JOIN Staff s ON wa.staff_id = s.id
      WHERE wa.assigned_date = CAST(GETDATE() AS DATE)
    `;

    // Employee chỉ thấy việc của bản thân
    if (req.user.role === 'employee') {
      query += ' AND wa.staff_id = @staffId';
      request.input('staffId', sql.Int, req.user.staffId);
    }

    query += ' ORDER BY s.name, a.code';
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get today work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/work/stats/:staffId — Thống kê ngày/tháng
router.get('/stats/:staffId', authenticate, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);

    // Employee chỉ xem được stats của bản thân
    if (req.user.role === 'employee' && req.user.staffId !== staffId) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xem thống kê của bản thân.' });
    }

    const pool = await getPool();

    // Số căn hoàn thành hôm nay
    const today = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE staff_id = @staffId 
          AND assigned_date = CAST(GETDATE() AS DATE) 
          AND status = 'completed'
      `);

    // Số căn hoàn thành tháng này
    const month = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE staff_id = @staffId 
          AND MONTH(assigned_date) = MONTH(GETDATE()) 
          AND YEAR(assigned_date) = YEAR(GETDATE()) 
          AND status = 'completed'
      `);

    // Số căn được giao hôm nay (tất cả trạng thái)
    const todayTotal = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE staff_id = @staffId 
          AND assigned_date = CAST(GETDATE() AS DATE)
      `);

    res.json({
      today_completed: today.recordset[0].count,
      today_total: todayTotal.recordset[0].count,
      month_completed: month.recordset[0].count,
    });
  } catch (err) {
    console.error('Get work stats error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/work/all-stats — Thống kê tất cả NV (Admin only)
router.get('/all-stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        s.id, s.name, s.type,
        ISNULL(today.completed, 0) as today_completed,
        ISNULL(today.total, 0) as today_total,
        ISNULL(monthly.completed, 0) as month_completed
      FROM Staff s
      LEFT JOIN (
        SELECT staff_id, 
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          COUNT(*) as total
        FROM WorkAssignments 
        WHERE assigned_date = CAST(GETDATE() AS DATE)
        GROUP BY staff_id
      ) today ON s.id = today.staff_id
      LEFT JOIN (
        SELECT staff_id, COUNT(*) as completed
        FROM WorkAssignments 
        WHERE MONTH(assigned_date) = MONTH(GETDATE()) 
          AND YEAR(assigned_date) = YEAR(GETDATE()) 
          AND status = 'completed'
        GROUP BY staff_id
      ) monthly ON s.id = monthly.staff_id
      ORDER BY s.id
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Get all stats error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
