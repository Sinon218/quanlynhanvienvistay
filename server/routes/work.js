// ===================================================================
// Work Assignments Routes
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin, requireManagerOrAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { recordStatusSnapshot } = require('../statusHistory');
const { sendEventToAll } = require('../sse');
const { ensureNotificationsTable, getLocalDate } = require('../utils');

const router = express.Router();



// POST /api/work/assign — Giao căn hộ cho NV (Admin/Manager)
router.post('/assign', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const { staff_id, apartment_id, assigned_date, task_type, expected_start_at, expected_end_at } = req.body;
    if (!staff_id || !apartment_id) {
      return res.status(400).json({ error: 'Thiếu thông tin nhân viên hoặc căn hộ.' });
    }

    const validTypes = ['ss_luu', 'out', 'tong_ve_sinh'];
    const type = validTypes.includes(task_type) ? task_type : 'out';

    const pool = await getPool();
    const date = assigned_date || getLocalDate();

    // 0. Lấy thông tin loại phòng để xác định giới hạn dọn dẹp
    const aptRes = await pool.request()
      .input('apartmentId', sql.Int, apartment_id)
      .query('SELECT room_type FROM Apartments WHERE id = @apartmentId');

    if (aptRes.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy căn hộ.' });
    }

    // 1. Kiểm tra trùng lặp cho nhân viên này
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
    const assignedRole = type === 'tong_ve_sinh'
      ? 2
      : (staffRes.recordset.length > 0 ? staffRes.recordset[0].room_role : 1);

    // 4. Tạo phân công với trạng thái pending
    await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('apartmentId', sql.Int, apartment_id)
      .input('date', sql.Date, date)
      .input('taskType', sql.VarChar, type)
      .input('assignedRole', sql.Int, assignedRole)
      .input('expectedStart', sql.DateTime, expected_start_at ? new Date(expected_start_at) : null)
      .input('expectedEnd', sql.DateTime, expected_end_at ? new Date(expected_end_at) : null)
      .query(`
        INSERT INTO WorkAssignments (staff_id, apartment_id, assigned_date, task_type, assigned_role, status, expected_start_at, expected_end_at)
        VALUES (@staffId, @apartmentId, @date, @taskType, @assignedRole, 'pending', @expectedStart, @expectedEnd)
      `);

    // Lấy thông tin phòng và nhân viên để tạo message thông báo
    const info = await pool.request()
      .input('staffId', sql.Int, staff_id)
      .input('aptId', sql.Int, apartment_id)
      .query(`
        SELECT a.code as room_code, s.name as staff_name 
        FROM Apartments a, Staff s
        WHERE a.id = @aptId AND s.id = @staffId
      `);
    let msg = 'Đã giao việc thành công.';
    if (info.recordset.length > 0) {
      const item = info.recordset[0];
      msg = `Đã giao dọn căn ${item.room_code} cho nhân viên ${item.staff_name}.`;
    }

    // Ghi notification vào DB
    await ensureNotificationsTable(pool);
    await pool.request()
      .input('msg', sql.NVarChar, msg)
      .query('INSERT INTO Notifications (message) VALUES (@msg)');

    sendEventToAll({ type: 'WORK_UPDATE', action: 'assign', staff_id, message: msg });
    res.json({ message: msg });
  } catch (err) {
    console.error('Assign work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/work/:id — Hủy phân công (Admin/Manager)
router.delete('/:id', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM WorkAssignments WHERE id = @id');
    sendEventToAll({ type: 'WORK_UPDATE', action: 'delete', id: req.params.id });
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

    sendEventToAll({ type: 'WORK_UPDATE', action: 'accept', id: req.params.id });
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

    // Lấy thông tin phòng và nhân viên để tạo message thông báo
    const info = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT a.code as room_code, s.name as staff_name 
        FROM WorkAssignments wa
        JOIN Apartments a ON wa.apartment_id = a.id
        JOIN Staff s ON wa.staff_id = s.id
        WHERE wa.id = @id
      `);
    let msg = 'Một công việc dọn phòng đã bị từ chối.';
    if (info.recordset.length > 0) {
      const item = info.recordset[0];
      msg = `Nhân viên ${item.staff_name} đã từ chối dọn căn ${item.room_code}.`;
    }

    // Ghi notification vào DB
    await ensureNotificationsTable(pool);
    await pool.request()
      .input('msg', sql.NVarChar, msg)
      .query('INSERT INTO Notifications (message) VALUES (@msg)');

    sendEventToAll({ type: 'WORK_UPDATE', action: 'reject', id: req.params.id, message: msg });
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

    sendEventToAll({ type: 'WORK_UPDATE', action: 'start', id: req.params.id });
    res.json({ message: 'Bắt đầu làm việc.' });
  } catch (err) {
    console.error('Start work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/work/:id/complete — Đã làm xong + Upload ảnh minh chứng (chỉ bắt buộc cho hệ số 1)
router.put('/:id/complete', authenticate, upload.single('proof'), async (req, res) => {
  try {
    const isEmployee = req.user.role === 'employee';
    if (isEmployee) {
      const ok = await checkOwnership(req.params.id, req.user.staffId, res);
      if (!ok) return;
    }

    const pool = await getPool();
    
    // Kiểm tra assigned_role
    const checkRole = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT assigned_role FROM WorkAssignments WHERE id = @id');
      
    if (checkRole.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy phân công dọn phòng.' });
    }
    
    const assignedRole = checkRole.recordset[0].assigned_role;
    const needsPhoto = assignedRole === 1;

    let imagePath = null;
    if (needsPhoto) {
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chụp hoặc tải ảnh lên làm minh chứng hoàn thành công việc.' });
      }
      imagePath = `/uploads/${req.file.filename}`;
    } else {
      if (req.file) {
        imagePath = `/uploads/${req.file.filename}`;
      }
    }

    let partnerWorked = null;
    if (req.body.partner_worked !== undefined && req.body.partner_worked !== '') {
      partnerWorked = (req.body.partner_worked === 'true' || req.body.partner_worked === '1' || req.body.partner_worked === true) ? 1 : 0;
    }

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('proofImage', sql.NVarChar, imagePath)
      .input('partnerWorked', sql.Bit, partnerWorked)
      .query(`
        UPDATE WorkAssignments 
        SET status = 'completed', completed_at = GETDATE(), proof_image = @proofImage, partner_worked = @partnerWorked
        WHERE id = @id
      `);

    sendEventToAll({ type: 'WORK_UPDATE', action: 'complete', id: req.params.id });
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
      SELECT wa.*, a.code, a.building, a.is_samsung, s.name as staff_name,
             (SELECT COUNT(*) FROM WorkAssignments wa2 
              WHERE wa2.apartment_id = wa.apartment_id 
                AND wa2.assigned_date = wa.assigned_date 
                AND wa2.staff_id <> wa.staff_id 
                AND wa2.assigned_role = 2
                AND wa2.status <> 'rejected') as has_role2_partner
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

// GET /api/work/stats/:staffId — Thống kê ngày/tháng (chỉ tính những phòng đã duyệt - approved)
router.get('/stats/:staffId', authenticate, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    if (req.user.role === 'employee' && req.user.staffId !== staffId) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xem thống kê của bản thân.' });
    }

    const pool = await getPool();
    const date = getLocalDate();

    // Số căn đã duyệt hôm nay
    const today = await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('date', sql.Date, date)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE staff_id = @staffId 
          AND assigned_date = @date
          AND status = 'approved'
      `);

    // Số căn đã duyệt tháng này
    const month = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT COUNT(*) as count FROM WorkAssignments 
        WHERE staff_id = @staffId 
          AND MONTH(assigned_date) = MONTH(GETDATE()) 
          AND YEAR(assigned_date) = YEAR(GETDATE()) 
          AND status = 'approved'
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

// GET /api/work/all-stats — Thống kê tất cả NV (Admin/Manager)
router.get('/all-stats', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const date = getLocalDate();

    const result = await pool.request()
      .input('date', sql.Date, date)
      .query(`
        SELECT 
          s.id, s.name, s.type, s.tech_role,
          ISNULL(today.completed, 0) as today_completed,
          ISNULL(today.total, 0) as today_total,
          ISNULL(monthly.completed, 0) as month_completed,
          ISNULL(tech_monthly.tech_tasks_completed, 0) as tech_tasks_completed
        FROM Staff s
        LEFT JOIN (
          SELECT staff_id, 
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as completed,
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
            AND status = 'approved'
          GROUP BY staff_id
        ) monthly ON s.id = monthly.staff_id
        LEFT JOIN (
          SELECT staff_id, COUNT(*) as tech_tasks_completed
          FROM Tasks 
          WHERE MONTH(assigned_date) = MONTH(GETDATE()) 
            AND YEAR(assigned_date) = YEAR(GETDATE()) 
            AND status = 'approved'
          GROUP BY staff_id
        ) tech_monthly ON s.id = tech_monthly.staff_id
        ORDER BY s.id
      `);

    // Tính KPI cho NV kỹ thuật hệ số 1: tasks approved + (rooms approved / 2)
    const statsWithKpi = result.recordset.map(row => {
      let kpi = null;
      if (row.tech_role === 1) {
        kpi = row.tech_tasks_completed + (row.month_completed / 2);
      }
      return { ...row, kpi };
    });

    res.json(statsWithKpi);
  } catch (err) {
    console.error('Get all stats error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/work/:id/approve — Phê duyệt công việc hoàn thành (Admin/Manager only)
router.put('/:id/approve', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    
    // Kiểm tra xem phân công có tồn tại và đang ở trạng thái completed không
    const check = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT status, apartment_id FROM WorkAssignments WHERE id = @id');
      
    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy phân công.' });
    }
    
    const wa = check.recordset[0];
    if (wa.status !== 'completed') {
      return res.status(400).json({ error: 'Chỉ có thể duyệt những công việc đã báo hoàn thành.' });
    }
    
    // Cập nhật trạng thái thành approved và căn hộ thành available
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE WorkAssignments SET status = 'approved' WHERE id = @id;
        UPDATE Apartments 
        SET status = 'available' 
        WHERE id = (SELECT apartment_id FROM WorkAssignments WHERE id = @id);
      `);
      
    sendEventToAll({ type: 'WORK_UPDATE', action: 'approve', id: req.params.id, apartment_id: wa.apartment_id });
    res.json({ message: 'Đã phê duyệt hoàn thành căn hộ và cập nhật trạng thái phòng thành Trống.' });

    // Ghi lại snapshot trạng thái sau khi duyệt
    recordStatusSnapshot(wa.apartment_id, 'available').catch(e => console.error('Snapshot error:', e.message));
  } catch (err) {
    console.error('Approve work error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
