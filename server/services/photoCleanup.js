// ===================================================================
// Photo Cleanup Service — Automatic 30-day cleanup & deletion by date
// ===================================================================
const fs = require('fs');
const path = require('path');
const { getPool, sql } = require('../db');

const uploadBaseDir = path.join(__dirname, '..', '..', 'ảnh dọn phòng của nhân viên');

/**
 * Xóa tất cả ảnh dọn phòng của nhân viên (buồng phòng) theo ngày chỉ định (YYYY-MM-DD)
 * Không đụng tới thư mục 'tech'
 */
async function deletePhotosByDate(targetDateStr) {
  if (!targetDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
    throw new Error('Ngày không hợp lệ (định dạng YYYY-MM-DD).');
  }

  let deletedFilesCount = 0;
  if (!fs.existsSync(uploadBaseDir)) {
    return { deletedCount: 0 };
  }

  const entries = fs.readdirSync(uploadBaseDir, { withFileTypes: true });

  for (const entry of entries) {
    // Bỏ qua thư mục tech (công việc kỹ thuật)
    if (!entry.isDirectory() || entry.name.toLowerCase() === 'tech') {
      continue;
    }

    const staffDirPath = path.join(uploadBaseDir, entry.name);
    const staffEntries = fs.readdirSync(staffDirPath, { withFileTypes: true });

    for (const sub of staffEntries) {
      if (sub.isDirectory() && sub.name === targetDateStr) {
        // Thư mục ngày trùng khớp
        const dateDirPath = path.join(staffDirPath, sub.name);
        const files = fs.readdirSync(dateDirPath);
        for (const file of files) {
          const filePath = path.join(dateDirPath, file);
          try {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          } catch (e) {
            console.error(`Lỗi xóa tệp ${filePath}:`, e.message);
          }
        }
        // Xóa thư mục ngày rỗng
        try {
          fs.rmdirSync(dateDirPath);
        } catch (e) {}
      } else if (sub.isFile()) {
        // Kiểm tra tệp ảnh phẳng nếu thời gian tạo trùng với targetDateStr
        const filePath = path.join(staffDirPath, sub.name);
        try {
          const stats = fs.statSync(filePath);
          const fileDateStr = stats.mtime.toISOString().split('T')[0];
          if (fileDateStr === targetDateStr) {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          }
        } catch (e) {}
      }
    }

    // Xóa thư mục nhân viên nếu rỗng
    try {
      const remaining = fs.readdirSync(staffDirPath);
      if (remaining.length === 0) {
        fs.rmdirSync(staffDirPath);
      }
    } catch (e) {}
  }

  // Cập nhật CSDL: Xóa đường dẫn proof_image cho các phân công trong ngày đó
  try {
    const pool = await getPool();
    await pool.request()
      .input('date', sql.Date, targetDateStr)
      .query(`
        UPDATE WorkAssignments
        SET proof_image = NULL
        WHERE assigned_date = @date
      `);
  } catch (err) {
    console.warn('Cập nhật proof_image CSDL thất bại:', err.message);
  }

  return { deletedCount: deletedFilesCount };
}

/**
 * Tự động xóa tất cả ảnh dọn phòng của nhân viên buồng phòng đã quá 30 ngày
 * KHÔNG đụng tới ảnh/video trong thư mục 'tech'
 */
async function autoCleanHousekeepingPhotosOlderThan30Days() {
  console.log('🧹 [AUTO-CLEANUP] Bắt đầu tự động kiểm tra ảnh dọn phòng quá 30 ngày...');
  if (!fs.existsSync(uploadBaseDir)) return;

  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  const entries = fs.readdirSync(uploadBaseDir, { withFileTypes: true });

  for (const entry of entries) {
    // BỎ QUA thư mục 'tech' (công việc kỹ thuật bảo trì)
    if (!entry.isDirectory() || entry.name.toLowerCase() === 'tech') {
      continue;
    }

    const staffDirPath = path.join(uploadBaseDir, entry.name);
    const staffEntries = fs.readdirSync(staffDirPath, { withFileTypes: true });

    for (const sub of staffEntries) {
      const subPath = path.join(staffDirPath, sub.name);

      if (sub.isDirectory()) {
        // Kiểm tra tên thư mục YYYY-MM-DD
        let isExpired = false;
        if (/^\d{4}-\d{2}-\d{2}$/.test(sub.name)) {
          const folderDate = new Date(sub.name);
          if (!isNaN(folderDate.getTime()) && (now - folderDate.getTime()) > THIRTY_DAYS_MS) {
            isExpired = true;
          }
        }

        // Hoặc kiểm tra mtime của thư mục
        if (!isExpired) {
          try {
            const stats = fs.statSync(subPath);
            if ((now - stats.mtimeMs) > THIRTY_DAYS_MS) {
              isExpired = true;
            }
          } catch (e) {}
        }

        if (isExpired) {
          const files = fs.readdirSync(subPath);
          for (const f of files) {
            try {
              fs.unlinkSync(path.join(subPath, f));
              deletedCount++;
            } catch (e) {}
          }
          try {
            fs.rmdirSync(subPath);
          } catch (e) {}
        }
      } else if (sub.isFile()) {
        try {
          const stats = fs.statSync(subPath);
          if ((now - stats.mtimeMs) > THIRTY_DAYS_MS) {
            fs.unlinkSync(subPath);
            deletedCount++;
          }
        } catch (e) {}
      }
    }

    // Xóa thư mục nhân viên nếu rỗng
    try {
      const remaining = fs.readdirSync(staffDirPath);
      if (remaining.length === 0) {
        fs.rmdirSync(staffDirPath);
      }
    } catch (e) {}
  }

  // Đồng thời xóa các file nằm trực tiếp ở gốc uploadDir nếu quá 30 ngày (trừ thư mục tech)
  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(uploadBaseDir, entry.name);
      try {
        const stats = fs.statSync(filePath);
        if ((now - stats.mtimeMs) > THIRTY_DAYS_MS) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (e) {}
    }
  }

  console.log(`✅ [AUTO-CLEANUP] Đã tự động dọn dẹp ${deletedCount} tệp ảnh dọn phòng quá 30 ngày.`);
}

module.exports = {
  deletePhotosByDate,
  autoCleanHousekeepingPhotosOlderThan30Days
};
