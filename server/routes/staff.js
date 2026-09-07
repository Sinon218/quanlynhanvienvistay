// ===================================================================
// Staff Routes — CRUD + Role Assignment
// ===================================================================
const express = require('express');
const { sql, runQuery } = require('../db');
const { authenticate, requireAdmin, requireManagerOrAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const CONFIG = require('../config');

const router = express.Router();

function validateId(req, res, next) {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID không hợp lệ.' });
  }
  req.params.id = id;
  next();
}

function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, '');
}

// GET /api/staff — Danh sách tất cả nhân viên
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await runQuery(async (pool) => {
      if (req.user.role === 'employee' || req.user.role === 'parttime') {
        return await pool.request()
          .input('staffId', sql.Int, req.user.staffId)
          .query('SELECT * FROM Staff WHERE id = @staffId');
      }
      return await pool.request().query('SELECT * FROM Staff ORDER BY id');
    });
    res.json(result.recordset);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/staff — Tạo nhân viên mới (Admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, type, room_role } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tên nhân viên.' });
    }

    const staffType = type || 'full-time';
    const staffRoomRole = room_role !== undefined ? parseInt(room_role) : 2;
    const baseUsername = removeAccents(name.trim());
    const defaultPassword = '12345678';

    const data = await runQuery(async (pool) => {
      // Batch query: get all existing usernames with this prefix
      const existing = await pool.request()
        .input('prefix', sql.VarChar, baseUsername + '%')
        .query('SELECT username FROM Users WHERE username LIKE @prefix');

      // Find next available username
      const taken = new Set(existing.recordset.map(r => r.username));
      let username = baseUsername;
      let counter = 1;
      while (taken.has(username) && counter <= 50) {
        username = baseUsername + counter;
        counter++;
      }

      const staffResult = await pool.request()
        .input('name', sql.NVarChar, name.trim())
        .input('defaultName', sql.NVarChar, name.trim())
        .input('type', sql.VarChar, staffType)
        .input('roomRole', sql.Int, staffRoomRole)
        .input('techRole', sql.Int, 0)
        .input('baseSalary', sql.Decimal(12, 0), CONFIG.SALARY.DEFAULT_BASE_SALARY)
        .input('perRoomRate', sql.Decimal(10, 0), CONFIG.ROOM_RATES.DEFAULT)
        .query(`
          INSERT INTO Staff (name, default_name, type, room_role, tech_role, base_salary, per_room_rate)
          OUTPUT INSERTED.id
          VALUES (@name, @defaultName, @type, @roomRole, @techRole, @baseSalary, @perRoomRate)
        `);

      const staffId = staffResult.recordset[0].id;
      const hash = await bcrypt.hash(defaultPassword, 10);
      const userRole = staffType === 'part-time' ? 'parttime' : 'employee';

      await pool.request()
        .input('username', sql.VarChar, username)
        .input('passwordHash', sql.VarChar, hash)
        .input('role', sql.VarChar, userRole)
        .input('staffId', sql.Int, staffId)
        .query('INSERT INTO Users (username, password_hash, role, staff_id, is_active) VALUES (@username, @passwordHash, @role, @staffId, 1)');

      return { staffId, username };
    });

    res.json({
      message: 'Thêm nhân viên thành công.',
      staff: { name: name.trim(), type: staffType },
      user: { username, password: defaultPassword }
    });
  } catch (err) {
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/staff/:id — Chi tiết 1 nhân viên
router.get('/:id', authenticate, validateId, async (req, res) => {
  try {
    const result = await runQuery(async (pool) => {
      return await pool.request()
        .input('id', sql.Int, req.params.id)
        .query('SELECT * FROM Staff WHERE id = @id');
    });

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

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
router.put('/:id/role', authenticate, requireManagerOrAdmin, validateId, async (req, res) => {
  try {
    let { room_role, tech_role } = req.body;

    if (tech_role === 1) room_role = 2;
    if (room_role === 1) tech_role = 0;

    await runQuery(async (pool) => {
      await pool.request()
        .input('id', sql.Int, req.params.id)
        .input('roomRole', sql.Int, room_role)
        .input('techRole', sql.Int, tech_role)
        .query('UPDATE Staff SET room_role = @roomRole, tech_role = @techRole WHERE id = @id');
    });

    res.json({ message: 'Cập nhật vai trò thành công.', room_role, tech_role });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/staff/:id/name — Đổi tên part-time (Admin/Manager)
router.put('/:id/name', authenticate, requireManagerOrAdmin, validateId, async (req, res) => {
  try {
    const { name } = req.body;

    const result = await runQuery(async (pool) => {
      const check = await pool.request()
        .input('id', sql.Int, req.params.id)
        .query('SELECT type, default_name FROM Staff WHERE id = @id');

      if (check.recordset.length === 0) {
        throw Object.assign(new Error('Không tìm thấy nhân viên.'), { statusCode: 404 });
      }

      const staff = check.recordset[0];
      if (staff.type !== 'part-time') {
        throw Object.assign(new Error('Chỉ có thể đổi tên nhân viên part-time.'), { statusCode: 400 });
      }

      const newName = name && name.trim() ? name.trim() : staff.default_name;
      await pool.request()
        .input('id', sql.Int, req.params.id)
        .input('name', sql.NVarChar, newName)
        .query('UPDATE Staff SET name = @name WHERE id = @id');

      return { newName };
    });

    res.json({ message: 'Đổi tên thành công.', name: result.newName });
  } catch (err) {
    console.error('Update name error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'Lỗi server.' : err.message });
  }
});

// POST /api/staff/reset-names — Reset tên tất cả part-time (Admin only)
router.post('/reset-names', authenticate, requireAdmin, async (req, res) => {
  try {
    await runQuery(async (pool) => {
      await pool.request()
        .query("UPDATE Staff SET name = default_name WHERE type = 'part-time'");
    });
    res.json({ message: 'Đã reset tên tất cả nhân viên part-time.' });
  } catch (err) {
    console.error('Reset names error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
