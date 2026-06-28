// ===================================================================
// Auth Routes — Login / Me / Change Password
// ===================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query(`
        SELECT u.id, u.username, u.password_hash, u.role, u.staff_id, u.is_active,
               s.name as staff_name
        FROM Users u
        LEFT JOIN Staff s ON u.staff_id = s.id
        WHERE u.username = @username
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Tên đăng nhập không tồn tại.' });
    }

    const user = result.recordset[0];
    if (!user.is_active) {
      return res.status(401).json({ error: 'Tài khoản đã bị vô hiệu hóa.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mật khẩu không đúng.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        staffId: user.staff_id,
        staffName: user.staff_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        staffId: user.staff_id,
        staffName: user.staff_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query(`
        SELECT u.id, u.username, u.role, u.staff_id, u.is_active,
               s.name as staff_name, s.type as staff_type
        FROM Users u
        LEFT JOIN Staff s ON u.staff_id = s.id
        WHERE u.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT password_hash FROM Users WHERE id = @id');

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.request()
      .input('id', sql.Int, req.user.id)
      .input('hash', sql.VarChar, hash)
      .query('UPDATE Users SET password_hash = @hash WHERE id = @id');

    res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
