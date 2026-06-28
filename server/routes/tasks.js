// ===================================================================
// Tasks Routes — Custom Task Assignment
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Helper to get local date string YYYY-MM-DD
function getLocalDate() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - (offset * 60 * 1000));
  return local.toISOString().split('T')[0];
}

// POST /api/tasks — Admin tạo task mới
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { staff_id, title, description, assigned_date } = req.body;
    if (!staff_id || !title) {
      return res.status(400).json({ error: 'Thiếu thông tin nhân viên hoặc tiêu đề công việc.' });
    }

    const pool = await getPool();
    const date = assigned_date || getLocalDate();

    await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('title', sql.NVarChar, title.trim())
      .input('description', sql.NVarChar, (description || '').trim())
      .input('date', sql.Date, date)
      .query(`
        INSERT INTO Tasks (staff_id, title, description, assigned_date, status)
        VALUES (@staffId, @title, @description, @date, 'pending')
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
    const date = getLocalDate();

    let query = `
      SELECT t.*, s.name as staff_name
      FROM Tasks t
      JOIN Staff s ON t.staff_id = s.id
      WHERE t.assigned_date = @date
    `;
    request.input('date', sql.Date, date);

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

// Helper check task ownership
async function checkOwnership(taskId, staffId, res) {
  const pool = await getPool();
  const check = await pool.request()
    .input('id', sql.Int, taskId)
    .input('staffId', sql.Int, staffId)
    .query('SELECT id, status FROM Tasks WHERE id = @id AND staff_id = @staffId');

  if (check.recordset.length === 0) {
    res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này.' });
    return null;
  }
  return check.recordset[0];
}

// PUT /api/tasks/:id/accept — Chấp nhận nhận việc
router.put('/:id/accept', authenticate, async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    if (isEmployee) {
      const ok = await checkOwnership(req.params.id, req.user.staffId, res);
      if (!ok) return;
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("UPDATE Tasks SET status = 'accepted' WHERE id = @id");

    res.json({ message: 'Đã chấp nhận công việc.' });
  } catch (err) {
    console.error('Accept task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/tasks/:id/reject — Từ chối nhận việc
router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    if (isEmployee) {
      const ok = await checkOwnership(req.params.id, req.user.staffId, res);
      if (!ok) return;
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("UPDATE Tasks SET status = 'rejected' WHERE id = @id");

    res.json({ message: 'Đã từ chối công việc. Báo cáo đã gửi về Admin.' });
  } catch (err) {
    console.error('Reject task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/tasks/:id/start — Bắt đầu làm việc
router.put('/:id/start', authenticate, async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    if (isEmployee) {
      const ok = await checkOwnership(req.params.id, req.user.staffId, res);
      if (!ok) return;
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("UPDATE Tasks SET status = 'in-progress' WHERE id = @id");

    res.json({ message: 'Bắt đầu thực hiện công việc.' });
  } catch (err) {
    console.error('Start task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/tasks/:id/complete — Đã làm xong + Upload ảnh minh chứng
router.put('/:id/complete', authenticate, upload.single('proof'), async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    if (isEmployee) {
      const ok = await checkOwnership(req.params.id, req.user.staffId, res);
      if (!ok) return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chụp hoặc tải ảnh lên làm minh chứng hoàn thành công việc.' });
    }

    const pool = await getPool();
    const imagePath = `/uploads/${req.file.filename}`;

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('proofImage', sql.NVarChar, imagePath)
      .query(`
        UPDATE Tasks 
        SET status = 'completed', completed_at = GETDATE(), proof_image = @proofImage
        WHERE id = @id
      `);

    res.json({ message: 'Đã hoàn thành công việc.', proof_image: imagePath });
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
