// ===================================================================
// Tasks Routes — Custom Task Assignment
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin, requireManagerOrAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendEventToAll } = require('../sse');
const { getLocalDate } = require('../utils');

const router = express.Router();

const { TECH_PRICES } = require('../config');
const TECH_LEVEL_PRICES = TECH_PRICES;

// POST /api/tasks — Admin/Manager tạo task mới
router.post('/', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const { staff_id, title, description, assigned_date, tech_level } = req.body;
    if (!staff_id || !title) {
      return res.status(400).json({ error: 'Thiếu thông tin nhân viên hoặc tiêu đề công việc.' });
    }

    const pool = await getPool();
    const date = assigned_date || getLocalDate();
    const level = tech_level ? parseInt(tech_level) : null;
    const price = level ? (TECH_LEVEL_PRICES[level] || null) : null;

    await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('title', sql.NVarChar, title.trim())
      .input('description', sql.NVarChar, (description || '').trim())
      .input('date', sql.Date, date)
      .input('techLevel', sql.Int, level)
      .input('techPrice', sql.Decimal(10, 0), price)
      .query(`
        INSERT INTO Tasks (staff_id, title, description, assigned_date, status, is_self_assigned, tech_level, tech_price)
        VALUES (@staffId, @title, @description, @date, 'pending', 0, @techLevel, @techPrice)
      `);

    sendEventToAll({ type: 'TASK_UPDATE', action: 'create', staff_id });
    res.json({ message: 'Giao công việc thành công.' });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/tasks/self-assign — NV Kỹ thuật tự giao việc cho mình
router.post('/self-assign', authenticate, async (req, res) => {
  try {
    const { title, description, tech_level } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Vui lòng nhập tiêu đề công việc.' });
    }

    if (!req.user.staffId) {
      return res.status(400).json({ error: 'Tài khoản không liên kết với nhân viên.' });
    }

    // Kiểm tra NV có tech_role >= 1 không
    const pool = await getPool();
    const staffCheck = await pool.request()
      .input('staffId', sql.Int, req.user.staffId)
      .query('SELECT tech_role FROM Staff WHERE id = @staffId');

    if (staffCheck.recordset.length === 0 || staffCheck.recordset[0].tech_role < 1) {
      return res.status(403).json({ error: 'Chỉ nhân viên kỹ thuật mới có thể tự giao việc.' });
    }

    const date = getLocalDate();
    const level = tech_level ? parseInt(tech_level) : null;
    const price = level ? (TECH_LEVEL_PRICES[level] || null) : null;

    // Tạo task tự giao — status bắt đầu là 'accepted' (bỏ qua pending)
    await pool.request()
      .input('staffId', sql.Int, req.user.staffId)
      .input('title', sql.NVarChar, title.trim())
      .input('description', sql.NVarChar, (description || '').trim())
      .input('date', sql.Date, date)
      .input('techLevel', sql.Int, level)
      .input('techPrice', sql.Decimal(10, 0), price)
      .query(`
        INSERT INTO Tasks (staff_id, title, description, assigned_date, status, is_self_assigned, tech_level, tech_price)
        VALUES (@staffId, @title, @description, @date, 'accepted', 1, @techLevel, @techPrice)
      `);

    sendEventToAll({ type: 'TASK_UPDATE', action: 'self_assign', staff_id: req.user.staffId });
    res.json({ message: 'Tạo công việc kỹ thuật thành công.' });
  } catch (err) {
    console.error('Self-assign task error:', err);
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
    .query('SELECT id, status, is_self_assigned FROM Tasks WHERE id = @id AND staff_id = @staffId');

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

    sendEventToAll({ type: 'TASK_UPDATE', action: 'accept', id: req.params.id });
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

    sendEventToAll({ type: 'TASK_UPDATE', action: 'reject', id: req.params.id });
    res.json({ message: 'Đã từ chối công việc. Báo cáo đã gửi về Admin.' });
  } catch (err) {
    console.error('Reject task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/tasks/:id/start — Bắt đầu làm việc
// Nếu task tự giao (is_self_assigned=1) → BẮT BUỘC chụp ảnh lỗi (before_image)
router.put('/:id/start', authenticate, upload.single('before_photo'), async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    let task = null;
    if (isEmployee) {
      task = await checkOwnership(req.params.id, req.user.staffId, res);
      if (!task) return;
    }

    // Nếu chưa lấy task info (admin), lấy để kiểm tra is_self_assigned
    if (!task) {
      const pool = await getPool();
      const taskRes = await pool.request()
        .input('id', sql.Int, req.params.id)
        .query('SELECT id, status, is_self_assigned FROM Tasks WHERE id = @id');
      if (taskRes.recordset.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy công việc.' });
      }
      task = taskRes.recordset[0];
    }

    const pool = await getPool();

    // Nếu là task tự giao → bắt buộc có ảnh lỗi
    if (task.is_self_assigned) {
      if (!req.file) {
        return res.status(400).json({ error: 'Công việc tự giao: Vui lòng chụp ảnh lỗi trước khi bắt đầu.' });
      }

      const beforeImagePath = `/uploads/${req.file.filename}`;
      await pool.request()
        .input('id', sql.Int, req.params.id)
        .input('beforeImage', sql.NVarChar, beforeImagePath)
        .query("UPDATE Tasks SET status = 'in-progress', before_image = @beforeImage WHERE id = @id");

      sendEventToAll({ type: 'TASK_UPDATE', action: 'start', id: req.params.id });
      return res.json({ message: 'Đã chụp ảnh lỗi và bắt đầu thực hiện công việc.', before_image: beforeImagePath });
    }

    // Task thường → không cần ảnh
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("UPDATE Tasks SET status = 'in-progress' WHERE id = @id");

    sendEventToAll({ type: 'TASK_UPDATE', action: 'start', id: req.params.id });
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

    sendEventToAll({ type: 'TASK_UPDATE', action: 'complete', id: req.params.id });
    res.json({ message: 'Đã hoàn thành công việc.', proof_image: imagePath });
  } catch (err) {
    console.error('Complete task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/tasks/stats/:staffId — Thống kê công việc của nhân viên kĩ thuật
router.get('/stats/:staffId', authenticate, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    if (req.user.role === 'employee' && req.user.staffId !== staffId) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xem thống kê của bản thân.' });
    }

    const pool = await getPool();
    const date = getLocalDate();

    // Số việc đã hoàn thành hôm nay (completed hoặc approved)
    const today = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('date', sql.Date, date)
      .query(`
        SELECT COUNT(*) as count FROM Tasks 
        WHERE staff_id = @staffId 
          AND assigned_date = @date
          AND status IN ('completed', 'approved')
      `);

    // Số việc đã duyệt tháng này (approved)
    const month = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT COUNT(*) as count FROM Tasks 
        WHERE staff_id = @staffId 
          AND MONTH(assigned_date) = MONTH(GETDATE()) 
          AND YEAR(assigned_date) = YEAR(GETDATE()) 
          AND status = 'approved'
      `);

    // Số việc được giao hôm nay (không tính bị từ chối)
    const todayTotal = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('date', sql.Date, date)
      .query(`
        SELECT COUNT(*) as count FROM Tasks 
        WHERE staff_id = @staffId 
          AND assigned_date = @date
          AND status <> 'rejected'
      `);

    // KPI cho NV kỹ thuật: tasks approved tháng này + (rooms approved tháng này / 2)
    const staffInfo = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query('SELECT tech_role FROM Staff WHERE id = @staffId');

    let kpi = null;
    if (staffInfo.recordset.length > 0 && staffInfo.recordset[0].tech_role === 1) {
      const techTasksMonth = month.recordset[0].count; // tasks approved this month
      const roomsMonth = await pool.request()
        .input('staffId', sql.Int, staffId)
        .query(`
          SELECT COUNT(*) as count FROM WorkAssignments 
          WHERE staff_id = @staffId 
            AND MONTH(assigned_date) = MONTH(GETDATE()) 
            AND YEAR(assigned_date) = YEAR(GETDATE()) 
            AND status = 'approved'
        `);
      const roomsCompleted = roomsMonth.recordset[0].count;
      kpi = techTasksMonth + (roomsCompleted / 2);
    }

    res.json({
      today_completed: today.recordset[0].count,
      today_total: todayTotal.recordset[0].count,
      month_completed: month.recordset[0].count,
      kpi: kpi,
    });
  } catch (err) {
    console.error('Get task stats error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/tasks/:id/approve — Phê duyệt công việc hoàn thành (Admin/Manager only)
router.put('/:id/approve', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const check = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT status FROM Tasks WHERE id = @id');
      
    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc.' });
    }
    
    if (check.recordset[0].status !== 'completed') {
      return res.status(400).json({ error: 'Chỉ có thể duyệt những công việc đã báo hoàn thành.' });
    }
    
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("UPDATE Tasks SET status = 'approved', reject_reason = NULL WHERE id = @id");
      
    sendEventToAll({ type: 'TASK_UPDATE', action: 'approve', id: req.params.id });
    res.json({ message: 'Đã phê duyệt hoàn thành công việc.' });
  } catch (err) {
    console.error('Approve task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/tasks/:id/reject-completed — Từ chối phê duyệt công việc hoàn thành (Admin/Manager only)
router.put('/:id/reject-completed', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp lý do không phê duyệt.' });
    }

    const pool = await getPool();
    const check = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT status FROM Tasks WHERE id = @id');
      
    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc.' });
    }
    
    if (check.recordset[0].status !== 'completed') {
      return res.status(400).json({ error: 'Chỉ có thể từ chối những công việc đã báo hoàn thành.' });
    }
    
    // Đặt lại trạng thái về 'accepted' để nhân viên sửa và làm lại
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('reason', sql.NVarChar, reason.trim())
      .query("UPDATE Tasks SET status = 'accepted', reject_reason = @reason, before_image = NULL, proof_image = NULL WHERE id = @id");
      
    sendEventToAll({ type: 'TASK_UPDATE', action: 'reject_completed', id: req.params.id });
    res.json({ message: 'Đã từ chối phê duyệt công việc và gửi lý do phản hồi.' });
  } catch (err) {
    console.error('Reject completed task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/tasks/:id — Admin/Manager xóa task
router.delete('/:id', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Tasks WHERE id = @id');
    sendEventToAll({ type: 'TASK_UPDATE', action: 'delete', id: req.params.id });
    res.json({ message: 'Đã xóa công việc.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
