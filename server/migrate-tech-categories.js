// ===================================================================
// Migration: 技术故障分类表 (TechIssueCategories)
// 安全地插入或更新技术故障分类，不会影响其他数据
// Usage: node server/migrate-tech-categories.js
// ===================================================================
const { getPool, sql } = require('./db');

const techCategories = [
  // CẤP ĐỘ 1: DỄ (Level 1 - Easy)
  { name: 'Sơn tường', level: 1, label: 'Dễ' },
  { name: 'Vệ sinh điều hòa', level: 1, label: 'Dễ' },
  { name: 'Dán decal', level: 1, label: 'Dễ' },
  { name: 'Giặt rèm trắng', level: 1, label: 'Dễ' },
  { name: 'Lắp khóa trong', level: 1, label: 'Dễ' },
  { name: 'Siết ốc', level: 1, label: 'Dễ' },
  { name: 'Thay vòi sen', level: 1, label: 'Dễ' },
  { name: 'Thay bóng đèn', level: 1, label: 'Dễ' },
  { name: 'Dán chặn cửa', level: 1, label: 'Dễ' },
  { name: 'Đặt thuốc gián', level: 1, label: 'Dễ' },
  { name: 'Lắp bộ lọc nước', level: 1, label: 'Dễ' },
  { name: 'Vệ sinh quạt', level: 1, label: 'Dễ' },

  // CẤP ĐỘ 2: TRUNG BÌNH (Level 2 - Medium)
  { name: 'Vệ sinh máy giặt cửa đứng', level: 2, label: 'Trung bình' },
  { name: 'Silicon', level: 2, label: 'Trung bình' },
  { name: 'Sơn trần', level: 2, label: 'Trung bình' },
  { name: 'Sơn bả', level: 2, label: 'Trung bình' },
  { name: 'Xử lý bản lề cửa', level: 2, label: 'Trung bình' },
  { name: 'Vệ sinh sofa và đệm', level: 2, label: 'Trung bình' },
  { name: 'Vệ sinh rèm dày', level: 2, label: 'Trung bình' },
  { name: 'Sơn chân bàn ghế', level: 2, label: 'Trung bình' },
  { name: 'Treo đèn thả bàn ăn và đèn ốp', level: 2, label: 'Trung bình' },
  { name: 'Vệ sinh cây nước', level: 2, label: 'Trung bình' },

  // CẤP ĐỘ 3: KHÓ (Level 3 - Hard)
  { name: 'Vệ sinh máy giặt cửa ngang', level: 3, label: 'Khó' },
  { name: 'Thay miệng cửa ban công', level: 3, label: 'Khó' },
  { name: 'Thay vòng bi', level: 3, label: 'Khó' },
  { name: 'Vệ sinh lưới điều hòa âm trần', level: 3, label: 'Khó' },
  { name: 'Xử lý bồn cầu và cống thoát nước', level: 3, label: 'Khó' },
  { name: 'Sửa giàn phơi', level: 3, label: 'Khó' },

  // CẤP ĐỘ 4: CẦN CHUYÊN MÔN (Level 4 - Expert)
  { name: 'Sửa tivi', level: 4, label: 'Cần chuyên môn' },
  { name: 'Sửa tủ lạnh', level: 4, label: 'Cần chuyên môn' },
  { name: 'Sửa lò vi sóng', level: 4, label: 'Cần chuyên môn' },
  { name: 'Sửa điều hòa', level: 4, label: 'Cần chuyên môn' },
  { name: 'Sửa rèm chống côn trùng', level: 4, label: 'Cần chuyên môn' },

  // KHÁC (Custom)
  { name: 'Khác...', level: 1, label: 'Dễ', is_custom: 1 }
];

async function migrateTechCategories() {
  let pool;
  try {
    pool = await getPool();
    console.log('🔧 Bắt đầu migrate TechIssueCategories...');

    // Kiểm tra bảng TechIssueCategories có tồn tại không
    const tableCheck = await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TechIssueCategories')
      BEGIN
        CREATE TABLE TechIssueCategories (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(200) NOT NULL,
          difficulty_level INT NOT NULL DEFAULT 1,
          difficulty_label NVARCHAR(50) NOT NULL DEFAULT 'Dễ',
          is_custom BIT DEFAULT 0,
          is_active BIT DEFAULT 1,
          created_at DATETIME DEFAULT GETDATE()
        );
        PRINT '✅ Đã tạo bảng TechIssueCategories';
      END
      ELSE
        PRINT 'ℹ️ Bảng TechIssueCategories đã tồn tại';
    `);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const cat of techCategories) {
      // Kiểm tra đã tồn tại chưa (theo tên)
      const existing = await pool.request()
        .input('name', sql.NVarChar, cat.name)
        .query('SELECT id FROM TechIssueCategories WHERE name = @name');

      if (existing.recordset.length > 0) {
        // Cập nhật nếu cần
        await pool.request()
          .input('id', sql.Int, existing.recordset[0].id)
          .input('level', sql.Int, cat.level)
          .input('label', sql.NVarChar, cat.label)
          .input('custom', sql.Bit, cat.is_custom ? 1 : 0)
          .query(`
            UPDATE TechIssueCategories
            SET difficulty_level = @level, difficulty_label = @label, is_custom = @custom, is_active = 1
            WHERE id = @id
          `);
        updated++;
      } else {
        // Insert mới
        await pool.request()
          .input('name', sql.NVarChar, cat.name)
          .input('level', sql.Int, cat.level)
          .input('label', sql.NVarChar, cat.label)
          .input('custom', sql.Bit, cat.is_custom ? 1 : 0)
          .query(`
            INSERT INTO TechIssueCategories (name, difficulty_level, difficulty_label, is_custom)
            VALUES (@name, @level, @label, @custom)
          `);
        inserted++;
      }
    }

    console.log('');
    console.log('✅ MIGRATE TECH CATEGORIES HOÀN TẤT!');
    console.log(`   - Đã thêm mới: ${inserted}`);
    console.log(`   - Đã cập nhật: ${updated}`);
    console.log(`   - Đã bỏ qua: ${skipped}`);
    console.log(`   - Tổng cộng: ${techCategories.length} loại lỗi`);

  } catch (err) {
    console.error('❌ MIGRATE ERROR:', err);
  } finally {
    if (pool) await pool.close();
  }
}

migrateTechCategories();
