// ===================================================================
// Work Assignments Routes
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
    const date = assigned_date || getLocalDate();

    // 1. Kiểm tra giới hạn 2 người/ngày cho căn hộ này
    const countCheck = await pool.request()
      .input('apartmentId', sql.Int, apartment_id)
      .input('date', sql.Date, date)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE apartment_id = @apartmentId AND assigned_date = @date AND status <> 'rejected'
      `);

    if (countCheck.recordset[0].count >= 2) {
      return res.status(400).json({ error: 'Căn hộ này đã được giao cho tối đa 2 nhân viên trong ngày.' });
    }

    // 2. Kiểm tra trùng lặp cho nhân viên này
    const check = await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('apartmentId', sql.Int, apartment_id)
      .input('date', sql.Date, date)
      .query(`
        SELECT id FROM WorkAssignments 
        WHERE staff_id = @staffId AND apartment_id = @apartmentId AND assigned_date = @date AND status <> 'rejected'
      `);

    if (check.recordset.length > 0) {
      return res.status(400).json({ error: 'Căn hộ này đã được giao cho nhân viên này trong ngày.' });
    }

    // 3. Lấy room_role hiện tại của nhân viên trong bảng Staff để lưu vào assigned_role
    const staffRes = await pool.request()
      .input('staffId', sql.Int, staff_id)
      .query('SELECT room_role FROM Staff WHERE id = @staffId');
    const assignedRole = staffRes.recordset.length > 0 ? staffRes.recordset[0].room_role : 1;

    // 4. Tạo phân công với trạng thái pending
    await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('apartmentId', sql.Int, apartment_id)
      .input('date', sql.Date, date)
      .input('taskType', sql.VarChar, type)
      .input('assignedRole', sql.Int, assignedRole)
      .query(`
        INSERT INTO WorkAssignments (staff_id, apartment_id, assigned_date, task_type, assigned_role, status)
        VALUES (@staffId, @apartmentId, @date, @taskType, @assignedRole, 'pending')
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

// Helper check assignment ownership
async function checkOwnership(assignmentId, staffId, res) {
  const pool = await getPool();
  const check = await pool.request()
    .input('id', sql.Int, assignmentId)
    .input('staffId', sql.Int, staffId)
    .query('SELECT id, status FROM WorkAssignments WHERE id = @id AND staff_id = @staffId');

  if (check.recordset.length === 0) {
    res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này.' });
    return null;
  }
  return check.recordset[0];
}

// PUT /api/work/:id/accept — Chấp nhận nhận việc
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
      .query("UPDATE WorkAssignments SET status = 'accepted' WHERE id = @id");

    res.json({ message: 'Đã chấp nhận công việc.' });
  } catch (err) {
    console.error('Accept work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/work/:id/reject — Từ chối nhận việc
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
      .query("UPDATE WorkAssignments SET status = 'rejected' WHERE id = @id");

    res.json({ message: 'Đã từ chối công việc. Báo cáo đã được gửi về Admin.' });
  } catch (err) {
    console.error('Reject work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/work/:id/start — Bắt đầu làm việc
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
      .query("UPDATE WorkAssignments SET status = 'in-progress' WHERE id = @id");

    res.json({ message: 'Bắt đầu làm việc.' });
  } catch (err) {
    console.error('Start work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/work/:id/complete — Đã làm xong + Upload ảnh minh chứng
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
        UPDATE WorkAssignments 
        SET status = 'completed', completed_at = GETDATE(), proof_image = @proofImage
        WHERE id = @id
      `);

    res.json({ message: 'Đã hoàn thành dọn phòng.', proof_image: imagePath });
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
    const date = getLocalDate();

    let query = `
      SELECT wa.*, a.code, a.building, a.is_samsung, s.name as staff_name
      FROM WorkAssignments wa
      JOIN Apartments a ON wa.apartment_id = a.id
      JOIN Staff s ON wa.staff_id = s.id
      WHERE wa.assigned_date = @date
    `;
    request.input('date', sql.Date, date);

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
    if (req.user.role === 'employee' && req.user.staffId !== staffId) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xem thống kê của bản thân.' });
    }

    const pool = await getPool();
    const date = getLocalDate();

    // Số căn hoàn thành hôm nay
    const today = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('date', sql.Date, date)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE staff_id = @staffId 
          AND assigned_date = @date
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

    // Số căn được giao hôm nay (không tính bị từ chối)
    const todayTotal = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('date', sql.Date, date)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE staff_id = @staffId 
          AND assigned_date = @date
          AND status <> 'rejected'
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
    const date = getLocalDate();

    const result = await pool.request()
      .input('date', sql.Date, date)
      .query(`
        SELECT 
          s.id, s.name, s.type,
          ISNULL(today.completed, 0) as today_completed,
          ISNULL(today.total, 0) as today_total,
          ISNULL(monthly.completed, 0) as month_completed
        FROM Staff s
        LEFT JOIN (
          SELECT staff_id, 
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status <> 'rejected' THEN 1 ELSE 0 END) as total
          FROM WorkAssignments 
          WHERE assigned_date = @date
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

