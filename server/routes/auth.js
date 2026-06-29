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

// POST /api/auth/migrate-offline — Đồng bộ dữ liệu offline lên database SQL Server
router.post('/migrate-offline', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền đồng bộ dữ liệu.' });
  }

  try {
    const { staff, apartments, work, tasks } = req.body;
    const pool = await getPool();

    // 1. Migrate Staff
    if (staff && staff.length > 0) {
      for (const s of staff) {
        // Check if staff already exists by name
        const check = await pool.request()
          .input('name', sql.NVarChar, s.name)
          .query('SELECT id FROM Staff WHERE name = @name');
          
        if (check.recordset.length === 0) {
          // Insert staff
          await pool.request()
            .input('name', sql.NVarChar, s.name)
            .input('defaultName', sql.NVarChar, s.default_name || s.name)
            .input('type', sql.VarChar, s.type || 'full-time')
            .input('roomRole', sql.Int, s.room_role || 1)
            .input('techRole', sql.Int, s.tech_role || 0)
            .input('baseSalary', sql.Decimal(18, 2), s.base_salary || null)
            .input('perRoomRate', sql.Decimal(18, 2), s.per_room_rate || null)
            .query(`
              INSERT INTO Staff (name, default_name, type, room_role, tech_role, base_salary, per_room_rate)
              VALUES (@name, @defaultName, @type, @roomRole, @techRole, @baseSalary, @perRoomRate)
            `);
            
          // If we also want to create a User account for this staff
          const cleanName = s.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, '');
          const checkUser = await pool.request()
            .input('username', sql.VarChar, cleanName)
            .query('SELECT id FROM Users WHERE username = @username');
            
          if (checkUser.recordset.length === 0) {
            const hash = await bcrypt.hash('12345678', 10);
            // Get the inserted staff ID
            const staffIdRes = await pool.request()
              .input('name', sql.NVarChar, s.name)
              .query('SELECT id FROM Staff WHERE name = @name');
            const insertedStaffId = staffIdRes.recordset[0].id;
            
            await pool.request()
              .input('username', sql.VarChar, cleanName)
              .input('hash', sql.VarChar, hash)
              .input('role', sql.VarChar, 'employee')
              .input('staffId', sql.Int, insertedStaffId)
              .query(`
                INSERT INTO Users (username, password_hash, role, staff_id, is_active)
                VALUES (@username, @hash, @role, @staffId, 1)
              `);
          }
        }
      }
    }

    // 2. Migrate Apartments
    if (apartments && apartments.length > 0) {
      for (const apt of apartments) {
        // Check if apartment exists by code
        const check = await pool.request()
          .input('code', sql.VarChar, apt.code)
          .query('SELECT id FROM Apartments WHERE code = @code');
          
        if (check.recordset.length === 0) {
          await pool.request()
            .input('code', sql.VarChar, apt.code)
            .input('building', sql.VarChar, apt.building || '')
            .input('password', sql.VarChar, apt.password || '')
            .input('isSamsung', sql.Bit, apt.is_samsung ? 1 : 0)
            .query(`
              INSERT INTO Apartments (code, building, password, is_samsung)
              VALUES (@code, @building, @password, @isSamsung)
            `);
        } else {
          // If it exists, update the password and details to match
          await pool.request()
            .input('code', sql.VarChar, apt.code)
            .input('password', sql.VarChar, apt.password || '')
            .input('isSamsung', sql.Bit, apt.is_samsung ? 1 : 0)
            .query(`
              UPDATE Apartments 
              SET password = @password, is_samsung = @isSamsung 
              WHERE code = @code
            `);
        }
      }
    }

    // 3. Migrate Work Assignments
    if (work && work.length > 0) {
      for (const w of work) {
        // We need to resolve local names/ids to actual DB staff and apartment IDs
        let dbStaffId = null;
        if (w.staff_id) {
          const localStaff = staff ? staff.find(s => s.id === w.staff_id) : null;
          if (localStaff) {
            const staffRes = await pool.request()
              .input('name', sql.NVarChar, localStaff.name)
              .query('SELECT id FROM Staff WHERE name = @name');
            if (staffRes.recordset.length > 0) {
              dbStaffId = staffRes.recordset[0].id;
            }
          }
        }
        
        let dbAptId = null;
        if (w.apartment_id) {
          const localApt = apartments ? apartments.find(a => a.id === w.apartment_id) : null;
          if (localApt) {
            const aptRes = await pool.request()
              .input('code', sql.VarChar, localApt.code)
              .query('SELECT id FROM Apartments WHERE code = @code');
            if (aptRes.recordset.length > 0) {
              dbAptId = aptRes.recordset[0].id;
            }
          }
        }

        if (dbStaffId && dbAptId) {
          // Check if assignment already exists
          const check = await pool.request()
            .input('staffId', sql.Int, dbStaffId)
            .input('aptId', sql.Int, dbAptId)
            .input('date', sql.Date, w.assigned_date)
            .query(`
              SELECT id FROM WorkAssignments 
              WHERE staff_id = @staffId AND apartment_id = @aptId AND assigned_date = @date
            `);
            
          if (check.recordset.length === 0) {
            await pool.request()
              .input('staffId', sql.Int, dbStaffId)
              .input('aptId', sql.Int, dbAptId)
              .input('date', sql.Date, w.assigned_date)
              .input('taskType', sql.VarChar, w.task_type || 'out')
              .input('assignedRole', sql.Int, w.assigned_role || 1)
              .input('status', sql.VarChar, w.status || 'pending')
              .input('completedAt', sql.DateTime, w.completed_at || null)
              .input('proofImage', sql.NVarChar, w.proof_image || null)
              .query(`
                INSERT INTO WorkAssignments (staff_id, apartment_id, assigned_date, task_type, assigned_role, status, completed_at, proof_image)
                VALUES (@staffId, @aptId, @date, @taskType, @assignedRole, @status, @completedAt, @proofImage)
              `);
          }
        }
      }
    }

    // 4. Migrate Custom Tasks
    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        // Resolve staff ID
        let dbStaffId = null;
        if (t.staff_id) {
          const localStaff = staff ? staff.find(s => s.id === t.staff_id) : null;
          if (localStaff) {
            const staffRes = await pool.request()
              .input('name', sql.NVarChar, localStaff.name)
              .query('SELECT id FROM Staff WHERE name = @name');
            if (staffRes.recordset.length > 0) {
              dbStaffId = staffRes.recordset[0].id;
            }
          }
        }

        // Insert custom task
        await pool.request()
          .input('title', sql.NVarChar, t.title)
          .input('description', sql.NVarChar, t.description || '')
          .input('staffId', sql.Int, dbStaffId)
          .input('assignedDate', sql.Date, t.assigned_date)
          .input('status', sql.VarChar, t.status || 'pending')
          .input('completedAt', sql.DateTime, t.completed_at || null)
          .input('proofImage', sql.NVarChar, t.proof_image || null)
          .query(`
            INSERT INTO Tasks (title, description, staff_id, assigned_date, status, completed_at, proof_image)
            VALUES (@title, @description, @staffId, @assignedDate, @status, @completedAt, @proofImage)
          `);
      }
    }

    res.json({ message: 'Đồng bộ dữ liệu thành công.' });
  } catch (err) {
    console.error('Migrate offline data error:', err);
    res.status(500).json({ error: 'Lỗi server khi đồng bộ dữ liệu.' });
  }
});

module.exports = router;
