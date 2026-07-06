// ===================================================================
// Status History Helper — Record & Seed apartment status snapshots
// ===================================================================
const { sql, getPool } = require('./db');

/**
 * Ghi lại sự thay đổi trạng thái của một căn hộ cụ thể vào ApartmentStatusHistory.
 */
async function recordStatusSnapshot(apartmentId, status, pool) {
  try {
    if (!pool) pool = await getPool();
    if (!apartmentId || !status) return;

    await pool.request()
      .input('apartmentId', sql.Int, apartmentId)
      .input('status', sql.VarChar, status)
      .query(`
        INSERT INTO ApartmentStatusHistory (apartment_id, status)
        VALUES (@apartmentId, @status)
      `);
  } catch (err) {
    console.error('recordStatusSnapshot error:', err.message);
  }
}

/**
 * Tự động tạo bảng nếu chưa có, và seed dữ liệu mẫu riêng biệt cho từng phòng
 */
async function initStatusHistory() {
  try {
    const pool = await getPool();

    // Migration: Thêm các cột checkin/checkout và maintenance_duration vào Apartments table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Apartments' AND COLUMN_NAME = 'checkin_date')
      BEGIN
        ALTER TABLE Apartments ADD 
          checkin_date DATE NULL,
          checkin_time VARCHAR(10) NULL,
          checkout_date DATE NULL,
          checkout_time VARCHAR(10) NULL;
      END
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Apartments' AND COLUMN_NAME = 'maintenance_duration')
      BEGIN
        ALTER TABLE Apartments ADD maintenance_duration INT NULL;
      END
    `);

    // Migration: Thêm các cột expected_start_at và expected_end_at vào WorkAssignments table nếu chưa có
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WorkAssignments' AND COLUMN_NAME = 'expected_start_at')
      BEGIN
        ALTER TABLE WorkAssignments ADD 
          expected_start_at DATETIME NULL,
          expected_end_at DATETIME NULL;
      END
    `);

    // Migration: Cập nhật loại phòng theo danh sách chính xác của user
    const roomTypeByCode = {
      'R6A-0505': '1 ngủ', 'R6A-2806': '1 ngủ', 'S1-0405': '1 ngủ', 'S1-0505': '1 ngủ', 'S1-0905': '1 ngủ',
      'S1-1105': '1 ngủ', 'S1-1605': '1 ngủ', 'S1-1705': '1 ngủ', 'S1-1905': '1 ngủ', 'S1-2105': '1 ngủ',
      'S1-2305': '1 ngủ', 'S1-2405': '1 ngủ', 'S1-2505': '1 ngủ', 'S1-2705': '1 ngủ', 'S1-3105': '1 ngủ',
      'S2-0610': '1 ngủ', 'S2-1110': '1 ngủ', 'S2-1111': '1 ngủ', 'S2-1512': '1 ngủ', 'S2-1712': '1 ngủ',
      'S2-2512': '1 ngủ', 'S2-2810': '1 ngủ', 'S2-3210': '1 ngủ', 'S2-3810': '1 ngủ', 'S2-3812': '1 ngủ',
      'S3-0511': '1 ngủ', 'S3-1012': '1 ngủ', 'S3-15A12': '1 ngủ', 'S3-1811': '1 ngủ', 'S3-2012': '1 ngủ',
      'S3-2412': '1 ngủ', 'S3-2712': '1 ngủ', 'S3-2911': '1 ngủ', 'S3-3411': '1 ngủ', 'S3-3512': '1 ngủ',
      'R4-2519': '2 ngủ', 'R5-2423': '2 ngủ', 'S1-2405A': '2 ngủ', 'S1-2505A': '2 ngủ', 'S1-2809': '2 ngủ',
      'S2-0401': '2 ngủ', 'S2-0501': '2 ngủ', 'S2-0715': '2 ngủ', 'S2-0908': '2 ngủ', 'S2-11A11': '2 ngủ',
      'S2-1511A': '2 ngủ', 'S2-1808': '2 ngủ', 'S2-1901': '2 ngủ', 'S2-2117': '2 ngủ', 'S2-2211A': '2 ngủ',
      'S2-2411': '2 ngủ', 'S2-2811A': '2 ngủ', 'S2-2916': '2 ngủ', 'S2-3301': '2 ngủ', 'S2-3316': '2 ngủ',
      'S2-3411A': '2 ngủ', 'S2-3501': '2 ngủ', 'S2-3517': '2 ngủ', 'S2-3608': '2 ngủ', 'S2-3708': '2 ngủ',
      'S2-3811A': '2 ngủ', 'S2-3816': '2 ngủ', 'S2-3908': '2 ngủ', 'S3-0715': '2 ngủ', 'S3-0810': '2 ngủ',
      'S3-0908': '2 ngủ', 'S3-1001': '2 ngủ', 'S3-15A08A': '2 ngủ', 'S3-1616': '2 ngủ', 'S3-1701': '2 ngủ',
      'S3-1901': '2 ngủ', 'S3-2301': '2 ngủ', 'S3-3001': '2 ngủ', 'S3-3015': '2 ngủ', 'S3-3316': '2 ngủ',
      'B-2102': '3 ngủ', 'S1-0508': '3 ngủ', 'S2-1220': '3 ngủ', 'S3-2406': '3 ngủ', 'S3-2909': '3 ngủ',
      'S2-3420': '3 ngủ', 'S3-3702': '3 ngủ', 'S3-3906': '3 ngủ',
      'S2-2106': '4 ngủ', 'S3-3918': '4 ngủ'
    };
    for (const [code, type] of Object.entries(roomTypeByCode)) {
      await pool.request()
        .input('code', sql.VarChar, code)
        .input('type', sql.NVarChar, type)
        .query('UPDATE Apartments SET room_type = @type WHERE code = @code');
    }
    console.log('✅ Room types verified/updated in Apartments table');

    // Tạo bảng nếu chưa tồn tại
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ApartmentStatusHistory')
      BEGIN
        CREATE TABLE ApartmentStatusHistory (
          id INT IDENTITY(1,1) PRIMARY KEY,
          apartment_id INT NOT NULL FOREIGN KEY REFERENCES Apartments(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL CHECK (status IN ('available', 'occupied', 'maintenance')),
          recorded_at DATETIME NOT NULL DEFAULT GETDATE()
        );
        CREATE INDEX IX_ApartmentStatusHistory_AptDate ON ApartmentStatusHistory(apartment_id, recorded_at);
      END
    `);

    // Kiểm tra xem đã có dữ liệu chưa
    const countResult = await pool.request().query('SELECT COUNT(*) as cnt FROM ApartmentStatusHistory');
    const existingCount = countResult.recordset[0].cnt;

    if (existingCount === 0) {
      console.log('📊 Seeding status history data for each room individually (30 days + 24 hours)...');

      // Lấy danh sách tất cả căn hộ
      const aptsResult = await pool.request().query('SELECT id, status FROM Apartments');
      const apartments = aptsResult.recordset;

      if (apartments.length === 0) {
        console.log('⚠️ No apartments found to seed status history.');
        return;
      }

      // Lặp qua từng căn hộ để sinh lịch sử riêng biệt
      for (const apt of apartments) {
        const aptId = apt.id;
        let currentStatus = apt.status;

        // Sinh 30 ngày lịch sử — mỗi ngày chọn ngẫu nhiên trạng thái và ghi nhận lúc 12:00 trưa
        for (let d = 30; d >= 1; d--) {
          const rand = Math.random();
          let dayStatus = 'available';
          if (rand < 0.15) {
            dayStatus = 'occupied';
          } else if (rand < 0.20) {
            dayStatus = 'maintenance';
          }

          await pool.request()
            .input('aptId', sql.Int, aptId)
            .input('status', sql.VarChar, dayStatus)
            .input('daysAgo', sql.Int, d)
            .query(`
              INSERT INTO ApartmentStatusHistory (apartment_id, status, recorded_at)
              VALUES (@aptId, @status, DATEADD(HOUR, 12, DATEADD(DAY, -@daysAgo, CAST(CAST(GETDATE() AS DATE) AS DATETIME))))
            `);
        }

        // Sinh 24 giờ lịch sử gần đây — duy trì trạng thái lâu dài để biểu đồ đẹp (dạng khối liên tục)
        // Ta mô phỏng bằng cách tạo vài sự kiện đổi trạng thái trong 24 giờ qua
        let currentHourStatus = currentStatus;
        for (let h = 24; h >= 1; h--) {
          // 8% cơ hội đổi trạng thái ở mỗi giờ qua
          if (Math.random() < 0.08) {
            const rand = Math.random();
            if (rand < 0.70) {
              currentHourStatus = 'available';
            } else if (rand < 0.90) {
              currentHourStatus = 'occupied';
            } else {
              currentHourStatus = 'maintenance';
            }
          }

          await pool.request()
            .input('aptId', sql.Int, aptId)
            .input('status', sql.VarChar, currentHourStatus)
            .input('hoursAgo', sql.Int, h)
            .query(`
              INSERT INTO ApartmentStatusHistory (apartment_id, status, recorded_at)
              VALUES (@aptId, @status, DATEADD(HOUR, -@hoursAgo, GETDATE()))
            `);
        }

        // Bản ghi trạng thái hiện tại
        await recordStatusSnapshot(aptId, apt.status, pool);
      }

      console.log('✅ Individual room status history seeded successfully!');
    }
  } catch (err) {
    console.error('initStatusHistory error:', err.message);
  }
}

module.exports = { recordStatusSnapshot, initStatusHistory };
