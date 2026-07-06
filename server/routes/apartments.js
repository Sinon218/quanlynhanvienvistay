// ===================================================================
// Apartments Routes — CRUD + Password Management
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireAdmin, requireManagerOrAdmin, requireAdminOrSpecialStaff } = require('../middleware/auth');
const { recordStatusSnapshot } = require('../statusHistory');
const { sendEventToAll } = require('../sse');

const router = express.Router();

async function ensureNotificationsTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Notifications')
    BEGIN
      CREATE TABLE Notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        message NVARCHAR(500) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      );
    END
  `);
}

// GET /api/apartments — Danh sách căn hộ (Admin: tất cả, Employee: không MK)
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const { city, building, status, search, room_type } = req.query;

    let query = 'SELECT * FROM Apartments WHERE 1=1';
    const request = pool.request();

    if (city && city !== 'all') {
      if (city === 'HN') {
        query += " AND building IN ('S1', 'S2', 'S3', 'R6A', 'B')";
      } else if (city === 'HCM') {
        query += " AND building = 'HCM'";
      }
    }
    if (building && building !== 'all') {
      if (building === 'SkyLake') {
        query += " AND building IN ('S1', 'S2', 'S3')";
      } else if (building === 'Royal') {
        query += " AND building = 'R6A'";
      } else if (building === 'Imperia') {
        query += " AND building = 'B'";
      } else {
        query += ' AND building = @building';
        request.input('building', sql.NVarChar, building);
      }
    }
    if (status && status !== 'all') {
      query += ' AND status = @status';
      request.input('status', sql.VarChar, status);
    }
    if (room_type && room_type !== 'all') {
      query += ' AND room_type = @room_type';
      request.input('room_type', sql.NVarChar, room_type);
    }
    if (search) {
      query += ' AND code LIKE @search';
      request.input('search', sql.VarChar, `%${search}%`);
    }

    query += ' ORDER BY building, code';
    const result = await request.query(query);

    let apartments = result.recordset;

    // Cho phép mọi tài khoản nhân viên đã xác thực xem mật khẩu thực

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

// PUT /api/apartments/:id/status — Đổi trạng thái (Tất cả nhân viên đã xác thực)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, room_type, checkin_date, checkin_time, checkout_date, checkout_time, maintenance_duration, stays } = req.body;
    const pool = await getPool();
    const request = pool.request().input('id', sql.Int, req.params.id);
    const updates = [];

    if (status) {
      const validStatuses = ['available', 'occupied', 'maintenance'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
      }
      updates.push('status = @status');
      request.input('status', sql.VarChar, status);

      // Tự động clear các trường dựa trên status mới chọn
      if (status === 'available') {
        updates.push('checkin_date = NULL', 'checkin_time = NULL', 'checkout_date = NULL', 'checkout_time = NULL', 'maintenance_duration = NULL');
        // Clear stays table
        await pool.request().input('aptId', sql.Int, req.params.id).query('DELETE FROM ApartmentStays WHERE apartment_id = @aptId');
      } else if (status === 'occupied') {
        updates.push('maintenance_duration = NULL');
        if (Array.isArray(stays)) {
          await pool.request().input('aptId', sql.Int, req.params.id).query('DELETE FROM ApartmentStays WHERE apartment_id = @aptId');
          for (const s of stays) {
            if (s.checkin_date && s.checkout_date) {
              await pool.request()
                .input('aptId', sql.Int, req.params.id)
                .input('cinD', sql.Date, s.checkin_date)
                .input('cinT', sql.VarChar, s.checkin_time || '14:00')
                .input('coutD', sql.Date, s.checkout_date)
                .input('coutT', sql.VarChar, s.checkout_time || '12:00')
                .query('INSERT INTO ApartmentStays (apartment_id, checkin_date, checkin_time, checkout_date, checkout_time) VALUES (@aptId, @cinD, @cinT, @coutD, @coutT)');
            }
          }
          if (stays.length > 0) {
            const first = stays[0];
            updates.push('checkin_date = @cinD_main', 'checkin_time = @cinT_main', 'checkout_date = @coutD_main', 'checkout_time = @coutT_main');
            request.input('cinD_main', sql.Date, first.checkin_date);
            request.input('cinT_main', sql.VarChar, first.checkin_time || '14:00');
            request.input('coutD_main', sql.Date, first.checkout_date);
            request.input('coutT_main', sql.VarChar, first.checkout_time || '12:00');
          } else {
            updates.push('checkin_date = NULL', 'checkin_time = NULL', 'checkout_date = NULL', 'checkout_time = NULL');
          }
        } else {
          // Backward compatibility: single stay
          if (checkin_date !== undefined) {
            updates.push('checkin_date = @checkin_date');
            request.input('checkin_date', sql.Date, checkin_date || null);
          }
          if (checkin_time !== undefined) {
            updates.push('checkin_time = @checkin_time');
            request.input('checkin_time', sql.VarChar, checkin_time || null);
          }
          if (checkout_date !== undefined) {
            updates.push('checkout_date = @checkout_date');
            request.input('checkout_date', sql.Date, checkout_date || null);
          }
          if (checkout_time !== undefined) {
            updates.push('checkout_time = @checkout_time');
            request.input('checkout_time', sql.VarChar, checkout_time || null);
          }

          if (checkin_date && checkout_date) {
            await pool.request().input('aptId', sql.Int, req.params.id).query('DELETE FROM ApartmentStays WHERE apartment_id = @aptId');
            await pool.request()
              .input('aptId', sql.Int, req.params.id)
              .input('cinD', sql.Date, checkin_date)
              .input('cinT', sql.VarChar, checkin_time || '14:00')
              .input('coutD', sql.Date, checkout_date)
              .input('coutT', sql.VarChar, checkout_time || '12:00')
              .query('INSERT INTO ApartmentStays (apartment_id, checkin_date, checkin_time, checkout_date, checkout_time) VALUES (@aptId, @cinD, @cinT, @coutD, @coutT)');
          }
        }
      } else if (status === 'maintenance') {
        updates.push('checkin_date = NULL', 'checkin_time = NULL', 'checkout_date = NULL', 'checkout_time = NULL');
        await pool.request().input('aptId', sql.Int, req.params.id).query('DELETE FROM ApartmentStays WHERE apartment_id = @aptId');
        if (maintenance_duration !== undefined) {
          updates.push('maintenance_duration = @maintenance_duration');
          request.input('maintenance_duration', sql.Int, maintenance_duration ? parseInt(maintenance_duration) : null);
        }
      }
    } else {
      if (Array.isArray(stays)) {
        await pool.request().input('aptId', sql.Int, req.params.id).query('DELETE FROM ApartmentStays WHERE apartment_id = @aptId');
        for (const s of stays) {
          if (s.checkin_date && s.checkout_date) {
            await pool.request()
              .input('aptId', sql.Int, req.params.id)
              .input('cinD', sql.Date, s.checkin_date)
              .input('cinT', sql.VarChar, s.checkin_time || '14:00')
              .input('coutD', sql.Date, s.checkout_date)
              .input('coutT', sql.VarChar, s.checkout_time || '12:00')
              .query('INSERT INTO ApartmentStays (apartment_id, checkin_date, checkin_time, checkout_date, checkout_time) VALUES (@aptId, @cinD, @cinT, @coutD, @coutT)');
          }
        }
        if (stays.length > 0) {
          const first = stays[0];
          updates.push('checkin_date = @cinD_main', 'checkin_time = @cinT_main', 'checkout_date = @coutD_main', 'checkout_time = @coutT_main');
          request.input('cinD_main', sql.Date, first.checkin_date);
          request.input('cinT_main', sql.VarChar, first.checkin_time || '14:00');
          request.input('coutD_main', sql.Date, first.checkout_date);
          request.input('coutT_main', sql.VarChar, first.checkout_time || '12:00');
        } else {
          updates.push('checkin_date = NULL', 'checkin_time = NULL', 'checkout_date = NULL', 'checkout_time = NULL');
        }
      } else {
        if (checkin_date !== undefined) {
          updates.push('checkin_date = @checkin_date');
          request.input('checkin_date', sql.Date, checkin_date || null);
        }
        if (checkin_time !== undefined) {
          updates.push('checkin_time = @checkin_time');
          request.input('checkin_time', sql.VarChar, checkin_time || null);
        }
        if (checkout_date !== undefined) {
          updates.push('checkout_date = @checkout_date');
          request.input('checkout_date', sql.Date, checkout_date || null);
        }
        if (checkout_time !== undefined) {
          updates.push('checkout_time = @checkout_time');
          request.input('checkout_time', sql.VarChar, checkout_time || null);
        }
      }
      if (maintenance_duration !== undefined) {
        updates.push('maintenance_duration = @maintenance_duration');
        request.input('maintenance_duration', sql.Int, maintenance_duration ? parseInt(maintenance_duration) : null);
      }
    }

    if (room_type) {
      const validTypes = ['1 ngủ', '2 ngủ', '3 ngủ', '4 ngủ'];
      if (!validTypes.includes(room_type)) {
        return res.status(400).json({ error: 'Loại phòng không hợp lệ.' });
      }
      updates.push('room_type = @room_type');
      request.input('room_type', sql.NVarChar, room_type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Không có trường dữ liệu nào cần cập nhật.' });
    }

    const query = `UPDATE Apartments SET ${updates.join(', ')} WHERE id = @id`;
    await request.query(query);

    if (status) {
      recordStatusSnapshot(req.params.id, status).catch(e => console.error('Snapshot error:', e.message));
    }

    sendEventToAll({ 
      type: 'APARTMENT_UPDATE', 
      id: req.params.id, 
      status,
      checkin_date,
      checkin_time,
      checkout_date,
      checkout_time,
      maintenance_duration,
      stays
    });
    res.json({ message: 'Cập nhật căn hộ thành công.' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/apartments/:id/password — Đổi MK căn hộ (Chỉ Admin, Lộc, Diệu)
router.put('/:id/password', authenticate, requireAdminOrSpecialStaff, async (req, res) => {
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

    // Ghi thông báo thay đổi mật khẩu cho toàn bộ nhân viên
    await ensureNotificationsTable(pool);
    const roomCode = current.recordset[0].code;
    const notificationMsg = `Mật khẩu căn ${roomCode} đã được thay đổi.`;
    await pool.request()
      .input('msg', sql.NVarChar, notificationMsg)
      .query('INSERT INTO Notifications (message) VALUES (@msg)');

    res.json({
      message: `Đổi mật khẩu căn ${roomCode} thành công.`,
      code: roomCode,
    });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/apartments/status-history — Lịch sử trạng thái phòng cho biểu đồ (từng căn hoặc tổng hợp tòa)
router.get('/status-history', authenticate, async (req, res) => {
  try {
    const apartmentId = req.query.apartment_id ? parseInt(req.query.apartment_id) : null;
    const mode = req.query.mode || 'hourly'; // 'hourly' hoặc 'daily'
    const building = req.query.building || 'all'; // 'all', 'S1', 'S2', 'S3', 'B', 'R6A'

    const pool = await getPool();
    const timeBuckets = [];
    const now = new Date();

    if (mode === 'hourly') {
      // 24 mốc giờ qua
      for (let i = 24; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 3600 * 1000);
        timeBuckets.push(time);
      }
    } else {
      // 30 ngày qua
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);
        timeBuckets.push(date);
      }
    }

    if (apartmentId) {
      // 1. Biểu đồ lịch sử riêng của MỘT căn hộ (trạng thái nhị phân)
      const result = await pool.request()
        .input('apartmentId', sql.Int, apartmentId)
        .query(`
          SELECT status, recorded_at 
          FROM ApartmentStatusHistory 
          WHERE apartment_id = @apartmentId 
          ORDER BY recorded_at ASC
        `);

      const history = result.recordset;

      const currentRes = await pool.request()
        .input('apartmentId', sql.Int, apartmentId)
        .query('SELECT status FROM Apartments WHERE id = @apartmentId');
      
      if (currentRes.recordset.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy căn hộ.' });
      }
      const currentStatus = currentRes.recordset[0].status;

      const formattedData = timeBuckets.map(bucket => {
        let activeStatus = history.length > 0 ? history[0].status : currentStatus;
        for (let j = history.length - 1; j >= 0; j--) {
          if (new Date(history[j].recorded_at) <= bucket) {
            activeStatus = history[j].status;
            break;
          }
        }
        return {
          time_bucket: bucket.toISOString(),
          status: activeStatus
        };
      });

      return res.json(formattedData);
    } else {
      // 2. Biểu đồ lịch sử tổng hợp của NHIỀU căn hộ (theo tòa hoặc tất cả)
      // Loại bỏ các căn chưa có mã căn (tại HCM) và các căn có mã SSTN
      let queryApartments = `
        SELECT id, status, building 
        FROM Apartments 
        WHERE building != 'HCM' AND is_samsung = 0
      `;
      const request = pool.request();
      if (building !== 'all') {
        queryApartments += ' AND building = @building';
        request.input('building', sql.NVarChar, building);
      }
      
      const aptRes = await request.query(queryApartments);
      const apartments = aptRes.recordset;

      if (apartments.length === 0) {
        const emptyData = timeBuckets.map(bucket => ({
          time_bucket: bucket.toISOString(),
          available_count: 0,
          occupied_count: 0,
          maintenance_count: 0
        }));
        return res.json(emptyData);
      }

      const apartmentIds = apartments.map(a => a.id);
      const historyRes = await pool.request().query(`
        SELECT apartment_id, status, recorded_at 
        FROM ApartmentStatusHistory 
        WHERE apartment_id IN (${apartmentIds.join(',')})
        ORDER BY recorded_at ASC
      `);
      const history = historyRes.recordset;

      const historyByApt = {};
      apartmentIds.forEach(id => {
        historyByApt[id] = [];
      });
      history.forEach(h => {
        if (historyByApt[h.apartment_id]) {
          historyByApt[h.apartment_id].push(h);
        }
      });

      const formattedData = timeBuckets.map(bucket => {
        let availableCount = 0;
        let occupiedCount = 0;
        let maintenanceCount = 0;

        apartments.forEach(apt => {
          const aptHistory = historyByApt[apt.id] || [];
          let activeStatus = aptHistory.length > 0 ? aptHistory[0].status : apt.status;
          
          for (let j = aptHistory.length - 1; j >= 0; j--) {
            if (new Date(aptHistory[j].recorded_at) <= bucket) {
              activeStatus = aptHistory[j].status;
              break;
            }
          }

          if (activeStatus === 'available') availableCount++;
          else if (activeStatus === 'occupied') occupiedCount++;
          else if (activeStatus === 'maintenance') maintenanceCount++;
        });

        return {
          time_bucket: bucket.toISOString(),
          available_count: availableCount,
          occupied_count: occupiedCount,
          maintenance_count: maintenanceCount
        };
      });

      return res.json(formattedData);
    }
  } catch (err) {
    console.error('Get status history error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/apartments/status-timeline — Dòng thời gian trạng thái theo từng căn hộ
router.get('/status-timeline', authenticate, async (req, res) => {
  try {
    const building = req.query.building || 'all';
    const mode = req.query.mode || 'daily';

    const pool = await getPool();
    const timeBuckets = [];
    const now = new Date();

    const formatBucketLabel = (bucket, m) => {
      if (m === 'hourly') {
        const hour = bucket.getHours();
        const min = bucket.getMinutes();
        const roundedMin = min < 15 ? 0 : (min < 45 ? 30 : 0);
        let roundedHour = min >= 45 ? (hour + 1) % 24 : hour;
        return roundedMin === 30 ? `${roundedHour}h30` : `${roundedHour}h`;
      }
      return bucket.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    let todayIndex = -1;
    if (mode === 'hourly') {
      // 48 buckets cho 24 giờ (mỗi bước 30 phút)
      for (let i = 48; i >= 0; i--) {
        timeBuckets.push(new Date(now.getTime() - i * 30 * 60 * 1000));
      }
      const nowTime = now.getTime();
      let minDiff = Infinity;
      for (let i = 0; i < timeBuckets.length; i++) {
        const diff = Math.abs(timeBuckets[i].getTime() - nowTime);
        if (diff < minDiff) {
          minDiff = diff;
          todayIndex = i;
        }
      }
    } else {
      // Bắt đầu từ hôm nay và hiển thị 15 ngày tiếp theo trong tương lai (tổng cộng 15 ngày)
      for (let i = 0; i < 15; i++) {
        timeBuckets.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 23, 59, 59));
      }
      todayIndex = 0;
    }

    let queryApartments = `
      SELECT id, code, building, room_type, status, checkin_date, checkin_time, checkout_date, checkout_time, maintenance_duration
      FROM Apartments
      WHERE 1=1
    `;
    const request = pool.request();

    if (building === 'SkyLake') {
      queryApartments += " AND building IN ('S1', 'S2', 'S3')";
    } else if (building === 'Royal') {
      queryApartments += " AND building = 'R6A'";
    } else if (building === 'Imperia') {
      queryApartments += " AND building = 'B'";
    } else if (building && building !== 'all') {
      queryApartments += ' AND building = @building';
      request.input('building', sql.NVarChar, building);
    }

    queryApartments += ' ORDER BY building, code';

    const aptRes = await request.query(queryApartments);
    const apartments = aptRes.recordset;

    if (apartments.length === 0) {
      return res.json({
        labels: timeBuckets.map(bucket => formatBucketLabel(bucket, mode)),
        rooms: []
      });
    }

    const apartmentIds = apartments.map(apt => apt.id);
    const cutoffDate = new Date();
    if (mode === 'hourly') {
      cutoffDate.setDate(cutoffDate.getDate() - 2);
    } else {
      cutoffDate.setDate(cutoffDate.getDate() - 35);
    }

    const historyRes = await pool.request()
      .input('cutoff', sql.DateTime, cutoffDate)
      .query(`
        SELECT apartment_id, status, recorded_at
        FROM ApartmentStatusHistory
        WHERE apartment_id IN (${apartmentIds.join(',')})
          AND recorded_at >= @cutoff
        ORDER BY recorded_at ASC
      `);

    const initialStatusesRes = await pool.request()
      .input('cutoff', sql.DateTime, cutoffDate)
      .query(`
        SELECT h.apartment_id, h.status
        FROM ApartmentStatusHistory h
        INNER JOIN (
          SELECT apartment_id, MAX(id) as max_id
          FROM ApartmentStatusHistory
          WHERE apartment_id IN (${apartmentIds.join(',')})
            AND recorded_at < @cutoff
          GROUP BY apartment_id
        ) latest ON h.id = latest.max_id
      `);

    const initialStatusByApt = {};
    initialStatusesRes.recordset.forEach(row => {
      initialStatusByApt[row.apartment_id] = row.status;
    });

    const getLocalDate = () => {
      const options = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
      const formatter = new Intl.DateTimeFormat('en-CA', options);
      return formatter.format(new Date());
    };

    const date = getLocalDate();
    const assignmentsRes = await pool.request()
      .input('date', sql.Date, date)
      .query(`
        SELECT wa.id, wa.apartment_id, wa.staff_id, wa.task_type, wa.expected_start_at, wa.expected_end_at, s.name as staff_name
        FROM WorkAssignments wa
        JOIN Staff s ON wa.staff_id = s.id
        WHERE wa.assigned_date = @date AND wa.status <> 'rejected'
      `);

    const assignmentsByApt = {};
    apartmentIds.forEach(id => {
      assignmentsByApt[id] = [];
    });
    assignmentsRes.recordset.forEach(wa => {
      if (assignmentsByApt[wa.apartment_id]) {
        assignmentsByApt[wa.apartment_id].push({
          id: wa.id,
          staff_id: wa.staff_id,
          staff_name: wa.staff_name,
          task_type: wa.task_type,
          expected_start_at: wa.expected_start_at,
          expected_end_at: wa.expected_end_at
        });
      }
    });

    const historyByApt = {};
    apartmentIds.forEach(id => {
      historyByApt[id] = [];
    });

    historyRes.recordset.forEach(entry => {
      if (historyByApt[entry.apartment_id]) {
        historyByApt[entry.apartment_id].push(entry);
      }
    });

    const staysRes = await pool.request()
      .query(`
        SELECT apartment_id, checkin_date, checkin_time, checkout_date, checkout_time
        FROM ApartmentStays
        WHERE apartment_id IN (${apartmentIds.join(',')})
      `);
    const staysByApt = {};
    apartmentIds.forEach(id => {
      staysByApt[id] = [];
    });
    staysRes.recordset.forEach(stay => {
      if (staysByApt[stay.apartment_id]) {
        staysByApt[stay.apartment_id].push(stay);
      }
    });

    const labels = timeBuckets.map(bucket => formatBucketLabel(bucket, mode));

    const rooms = apartments.map(apt => {
      const aptHistory = historyByApt[apt.id] || [];

      const statuses = timeBuckets.map(bucket => {
        const bucketTime = bucket.getTime();
        const nowTime = now.getTime();

        if (bucketTime <= nowTime) {
          // Past or present: read from history
          let activeStatus = initialStatusByApt[apt.id] || (aptHistory.length > 0 ? aptHistory[0].status : apt.status);
          for (let j = aptHistory.length - 1; j >= 0; j--) {
            if (new Date(aptHistory[j].recorded_at) <= bucket) {
              activeStatus = aptHistory[j].status;
              break;
            }
          }
          return activeStatus;
        } else {
          // Future: determine based on stays table and maintenance fields
          const currentStatus = apt.status || 'available';

          const aptStays = staysByApt[apt.id] || [];
          let hasStay = false;
          for (const stay of aptStays) {
            const formatDateString = (d) => {
              if (d instanceof Date) return d.toISOString().split('T')[0];
              return String(d).split('T')[0];
            };
            const checkinStr = `${formatDateString(stay.checkin_date)}T${stay.checkin_time || '14:00'}:00`;
            const checkoutStr = `${formatDateString(stay.checkout_date)}T${stay.checkout_time || '12:00'}:00`;
            const checkinDate = new Date(checkinStr);
            const checkoutDate = new Date(checkoutStr);

            if (bucket >= checkinDate && bucket <= checkoutDate) {
              hasStay = true;
              break;
            }
          }

          if (hasStay) {
            return 'occupied';
          }

          if (currentStatus === 'maintenance') {
            // Check maintenance duration
            const maintHistory = aptHistory.filter(h => h.status === 'maintenance');
            if (maintHistory.length > 0 && apt.maintenance_duration) {
              const startMaint = new Date(maintHistory[maintHistory.length - 1].recorded_at);
              const endMaint = new Date(startMaint.getTime() + apt.maintenance_duration * 60 * 60 * 1000);
              if (bucket <= endMaint) {
                return 'maintenance';
              }
            }
          }

          return 'available';
        }
      });

      const segments = [];
      let startIndex = 0;

      while (startIndex < statuses.length) {
        const status = statuses[startIndex];
        let endIndex = startIndex + 1;

        while (endIndex < statuses.length && statuses[endIndex] === status) {
          endIndex++;
        }

        segments.push({
          status,
          start_index: startIndex,
          span: endIndex - startIndex
        });

        startIndex = endIndex;
      }

      return {
        id: apt.id,
        code: apt.code,
        building: apt.building,
        room_type: apt.room_type,
        current_status: apt.status,
        statuses,
        segments,
        assignments: assignmentsByApt[apt.id] || []
      };
    });

    return res.json({ labels, rooms, todayIndex });
  } catch (err) {
    console.error('Get status timeline error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/apartments/notifications — Tải danh sách thông báo thay đổi mật khẩu (20 tin mới nhất)
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    await ensureNotificationsTable(pool);
    const result = await pool.request().query(`
      SELECT TOP 20 id, message, created_at 
      FROM Notifications 
      ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/apartments/:id/stays — Lấy danh sách các khoảng thời gian có khách của căn hộ
router.get('/:id/stays', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('aptId', sql.Int, req.params.id)
      .query('SELECT checkin_date, checkin_time, checkout_date, checkout_time FROM ApartmentStays WHERE apartment_id = @aptId ORDER BY checkin_date ASC, checkin_time ASC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get apartment stays error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
