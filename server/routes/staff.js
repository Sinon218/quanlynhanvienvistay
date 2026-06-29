// ===================================================================
// Staff Routes — CRUD + Role Assignment
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin, requireManagerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/staff — Danh sách tất cả nhân viên
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = await getPool();

    // Nếu là employee, chỉ trả về info của bản thân
    if (req.user.role === 'employee') {
      const result = await pool.request()
        .input('staffId', sql.Int, req.user.staffId)
        .query('SELECT * FROM Staff WHERE id = @staffId');
      return res.json(result.recordset);
    }

    // Admin: trả về tất cả
    const result = await pool.request()
      .query('SELECT * FROM Staff ORDER BY id');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/staff/:id — Chi tiết 1 nhân viên
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Staff WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

    // Employee chỉ xem được bản thân
    if (req.user.role === 'employee' && req.user.staffId !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xem thông tin của bản thân.' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get staff detail error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/staff/:id/role — Cập nhật vai trò (Admin/Manager)
router.put('/:id/role', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    let { room_role, tech_role } = req.body;

    // Auto-role mapper logic (Issue #5)
    if (tech_role === 1) {
      room_role = 2; // Kỹ thuật chính → Buồng phòng phụ
    }
    if (room_role === 1) {
      tech_role = 0; // Buồng phòng chính → Kỹ thuật = 0
    }

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('roomRole', sql.Int, room_role)
      .input('techRole', sql.Int, tech_role)
      .query('UPDATE Staff SET room_role = @roomRole, tech_role = @techRole WHERE id = @id');

    res.json({ message: 'Cập nhật vai trò thành công.', room_role, tech_role });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/staff/:id/name — Đổi tên part-time (Admin/Manager)
router.put('/:id/name', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const pool = await getPool();

    // Kiểm tra nhân viên là part-time
    const check = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT type, default_name FROM Staff WHERE id = @id');

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

    const staff = check.recordset[0];
    if (staff.type !== 'part-time') {
      return res.status(400).json({ error: 'Chỉ có thể đổi tên nhân viên part-time.' });
    }

    const newName = name && name.trim() ? name.trim() : staff.default_name;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, newName)
      .query('UPDATE Staff SET name = @name WHERE id = @id');

    res.json({ message: 'Đổi tên thành công.', name: newName });
  } catch (err) {
    console.error('Update name error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/staff/reset-names — Reset tên tất cả part-time (Admin only)
router.post('/reset-names', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .query("UPDATE Staff SET name = default_name WHERE type = 'part-time'");
    res.json({ message: 'Đã reset tên tất cả nhân viên part-time.' });
  } catch (err) {
    console.error('Reset names error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
