// ===================================================================
// Apartments Routes — CRUD + Password Management
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/apartments — Danh sách căn hộ (Admin: tất cả, Employee: không MK)
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const { building, status, search } = req.query;

    let query = 'SELECT * FROM Apartments WHERE 1=1';
    const request = pool.request();

    if (building && building !== 'all') {
      query += ' AND building = @building';
      request.input('building', sql.NVarChar, building);
    }
    if (status && status !== 'all') {
      query += ' AND status = @status';
      request.input('status', sql.VarChar, status);
    }
    if (search) {
      query += ' AND code LIKE @search';
      request.input('search', sql.VarChar, `%${search}%`);
    }

    query += ' ORDER BY building, code';
    const result = await request.query(query);

    let apartments = result.recordset;

    // Employee không được xem mật khẩu
    if (req.user.role !== 'admin') {
      apartments = apartments.map(a => ({ ...a, password: '******' }));
    }

    res.json(apartments);
  } catch (err) {
    console.error('Get apartments error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/apartments/stats — Thống kê theo tòa
router.get('/stats', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        building,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN status = 'cleaning' THEN 1 ELSE 0 END) as cleaning,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN is_samsung = 1 THEN 1 ELSE 0 END) as samsung_count
      FROM Apartments
      GROUP BY building
      ORDER BY building
    `);

    // Tổng cộng
    const totals = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN status = 'cleaning' THEN 1 ELSE 0 END) as cleaning,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN is_samsung = 1 THEN 1 ELSE 0 END) as samsung_count
      FROM Apartments
    `);

    res.json({
      byBuilding: result.recordset,
      totals: totals.recordset[0],
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/apartments/:id/status — Đổi trạng thái (Admin only)
router.put('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('status', sql.VarChar, status)
      .query('UPDATE Apartments SET status = @status WHERE id = @id');

    res.json({ message: 'Cập nhật trạng thái thành công.' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/apartments/:id/password — Đổi MK căn hộ (Admin only)
router.put('/:id/password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu mới.' });
    }

    const pool = await getPool();

    // Lấy MK cũ để ghi audit
    const current = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT password, code FROM Apartments WHERE id = @id');

    if (current.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy căn hộ.' });
    }

    const oldPassword = current.recordset[0].password;
    const newPassword = password.trim();

    // Cập nhật MK
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('password', sql.NVarChar, newPassword)
      .query('UPDATE Apartments SET password = @password WHERE id = @id');

    // Ghi audit log
    await pool.request()
      .input('apartmentId', sql.Int, req.params.id)
      .input('oldPw', sql.NVarChar, oldPassword)
      .input('newPw', sql.NVarChar, newPassword)
      .input('changedBy', sql.Int, req.user.id)
      .query(`
        INSERT INTO AuditLog (apartment_id, old_password, new_password, changed_by)
        VALUES (@apartmentId, @oldPw, @newPw, @changedBy)
      `);

    res.json({
      message: `Đổi mật khẩu căn ${current.recordset[0].code} thành công.`,
      code: current.recordset[0].code,
    });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
