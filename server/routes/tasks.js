// ===================================================================
// Tasks Routes — Custom Task Assignment
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/tasks — Admin tạo task mới
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { staff_id, title, description, assigned_date } = req.body;
    if (!staff_id || !title) {
      return res.status(400).json({ error: 'Thiếu thông tin nhân viên hoặc tiêu đề công việc.' });
    }

    const pool = await getPool();
    const date = assigned_date || new Date().toISOString().split('T')[0];

    await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('title', sql.NVarChar, title.trim())
      .input('description', sql.NVarChar, (description || '').trim())
      .input('date', sql.Date, date)
      .query(`
        INSERT INTO Tasks (staff_id, title, description, assigned_date)
        VALUES (@staffId, @title, @description, @date)
      `);

    res.json({ message: 'Giao công việc thành công.' });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/tasks/today — Công việc hôm nay
router.get('/today', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT t.*, s.name as staff_name
      FROM Tasks t
      JOIN Staff s ON t.staff_id = s.id
      WHERE t.assigned_date = CAST(GETDATE() AS DATE)
    `;

    // Employee chỉ thấy việc của bản thân
    if (req.user.role === 'employee') {
      query += ' AND t.staff_id = @staffId';
      request.input('staffId', sql.Int, req.user.staffId);
    }

    query += ' ORDER BY s.name, t.created_at';
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get today tasks error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/tasks/:id/complete — Đánh dấu hoàn thành
router.put('/:id/complete', authenticate, async (req, res) => {
  try {
    const pool = await getPool();

    // Nếu là employee, chỉ được hoàn thành việc của bản thân
    if (req.user.role === 'employee') {
      const check = await pool.request()
        .input('id', sql.Int, req.params.id)
        .input('staffId', sql.Int, req.user.staffId)
        .query('SELECT id FROM Tasks WHERE id = @id AND staff_id = @staffId');

      if (check.recordset.length === 0) {
        return res.status(403).json({ error: 'Bạn chỉ có thể hoàn thành công việc của bản thân.' });
      }
    }

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE Tasks 
        SET status = 'completed', completed_at = GETDATE() 
        WHERE id = @id
      `);

    res.json({ message: 'Đã hoàn thành công việc.' });
  } catch (err) {
    console.error('Complete task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/tasks/:id — Admin xóa task
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Tasks WHERE id = @id');
    res.json({ message: 'Đã xóa công việc.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
