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

/**
 * Xóa ảnh theo khoảng ngày và chế độ
 * @param {string|null} startDateStr - Ngày bắt đầu (YYYY-MM-DD), null = từ ảnh đầu tiên
 * @param {string} endDateStr - Ngày kết thúc (YYYY-MM-DD)
 * @param {string} mode - 'all' = xóa tất cả ảnh, 'housekeeping' = chỉ xóa ảnh dọn phòng
 */
async function deletePhotosByDateRange(startDateStr, endDateStr, mode = 'housekeeping') {
  if (!endDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    throw new Error('Ngày kết thúc không hợp lệ (định dạng YYYY-MM-DD).');
  }

  if (startDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    throw new Error('Ngày bắt đầu không hợp lệ (định dạng YYYY-MM-DD).');
  }

  const endDate = new Date(endDateStr);
  endDate.setHours(23, 59, 59, 999);

  const startDate = startDateStr ? new Date(startDateStr) : null;

  let deletedFilesCount = 0;
  if (!fs.existsSync(uploadBaseDir)) {
    return { deletedCount: 0 };
  }

  const entries = fs.readdirSync(uploadBaseDir, { withFileTypes: true });

  for (const entry of entries) {
    // Nếu chế độ 'housekeeping', bỏ qua thư mục tech
    if (mode === 'housekeeping' && entry.name.toLowerCase() === 'tech') {
      continue;
    }

    if (!entry.isDirectory()) {
      // Xóa file phẳng nếu nằm trong khoảng ngày
      if (entry.isFile()) {
        const filePath = path.join(uploadBaseDir, entry.name);
        try {
          const stats = fs.statSync(filePath);
          const fileDate = new Date(stats.mtime);
          if (isDateInRange(fileDate, startDate, endDate)) {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          }
        } catch (e) {}
      }
      continue;
    }

    const staffDirPath = path.join(uploadBaseDir, entry.name);
    const staffEntries = fs.readdirSync(staffDirPath, { withFileTypes: true });

    for (const sub of staffEntries) {
      const subPath = path.join(staffDirPath, sub.name);

      if (sub.isDirectory()) {
        // Kiểm tra tên thư mục YYYY-MM-DD
        let folderDate = null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(sub.name)) {
          folderDate = new Date(sub.name);
        }

        // Hoặc dùng mtime
        if (!folderDate || isNaN(folderDate.getTime())) {
          try {
            const stats = fs.statSync(subPath);
            folderDate = new Date(stats.mtime);
          } catch (e) {}
        }

        if (folderDate && isDateInRange(folderDate, startDate, endDate)) {
          const files = fs.readdirSync(subPath);
          for (const f of files) {
            try {
              fs.unlinkSync(path.join(subPath, f));
              deletedFilesCount++;
            } catch (e) {}
          }
          try {
            fs.rmdirSync(subPath);
          } catch (e) {}
        }
      } else if (sub.isFile()) {
        try {
          const stats = fs.statSync(subPath);
          const fileDate = new Date(stats.mtime);
          if (isDateInRange(fileDate, startDate, endDate)) {
            fs.unlinkSync(subPath);
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

  // Cập nhật CSDL: Xóa đường dẫn proof_image cho các phân công trong khoảng ngày
  try {
    const pool = await getPool();
    if (startDateStr) {
      await pool.request()
        .input('startDate', sql.Date, startDateStr)
        .input('endDate', sql.Date, endDateStr)
        .query(`
          UPDATE WorkAssignments
          SET proof_image = NULL
          WHERE assigned_date >= @startDate AND assigned_date <= @endDate
        `);
    } else {
      await pool.request()
        .input('endDate', sql.Date, endDateStr)
        .query(`
          UPDATE WorkAssignments
          SET proof_image = NULL
          WHERE assigned_date <= @endDate
        `);
    }
  } catch (err) {
    console.warn('Cập nhật proof_image CSDL thất bại:', err.message);
  }

  return { deletedCount: deletedFilesCount };
}

/**
 * Kiểm tra ngày có nằm trong khoảng [start, end] không
 * Nếu start = null thì chỉ cần <= end
 */
function isDateInRange(date, start, end) {
  if (start === null) {
    return date <= end;
  }
  return date >= start && date <= end;
}

/**
 * Xóa ảnh theo tên nhân viên và khoảng ngày (tuỳ chọn)
 * @param {string} staffName - Tên nhân viên (tên thư mục)
 * @param {string|null} startDateStr - Ngày bắt đầu (YYYY-MM-DD), null = từ ảnh đầu tiên
 * @param {string|null} endDateStr - Ngày kết thúc (YYYY-MM-DD), null = đến ảnh cuối cùng
 */
async function deletePhotosByStaff(staffName, startDateStr, endDateStr) {
  if (!staffName || staffName.trim() === '') {
    throw new Error('Vui lòng chọn nhân viên cần xóa ảnh.');
  }

  const startDate = startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr) ? new Date(startDateStr) : null;
  let endDate = null;
  if (endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);
  }

  let deletedFilesCount = 0;
  if (!fs.existsSync(uploadBaseDir)) {
    return { deletedCount: 0 };
  }

  // Tìm thư mục nhân viên (hỗ trợ tên có dấu và không dấu)
  const entries = fs.readdirSync(uploadBaseDir, { withFileTypes: true });
  const staffDir = entries.find(e => {
    if (!e.isDirectory() || e.name.toLowerCase() === 'tech') return false;
    return e.name === staffName || e.name.toLowerCase() === staffName.toLowerCase();
  });

  if (!staffDir) {
    return { deletedCount: 0, message: `Không tìm thấy thư mục ảnh của nhân viên "${staffName}".` };
  }

  const staffDirPath = path.join(uploadBaseDir, staffDir.name);
  const staffEntries = fs.readdirSync(staffDirPath, { withFileTypes: true });

  for (const sub of staffEntries) {
    const subPath = path.join(staffDirPath, sub.name);

    if (sub.isDirectory()) {
      // Kiểm tra tên thư mục YYYY-MM-DD
      let folderDate = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(sub.name)) {
        folderDate = new Date(sub.name);
      }

      if (!folderDate || isNaN(folderDate.getTime())) {
        try {
          const stats = fs.statSync(subPath);
          folderDate = new Date(stats.mtime);
        } catch (e) {}
      }

      // Nếu không có khoảng ngày thì xóa tất cả, nếu có thì kiểm tra
      const shouldDelete = folderDate ? isDateInRange(folderDate, startDate, endDate) : true;

      if (shouldDelete) {
        const files = fs.readdirSync(subPath);
        for (const f of files) {
          try {
            fs.unlinkSync(path.join(subPath, f));
            deletedFilesCount++;
          } catch (e) {}
        }
        try {
          fs.rmdirSync(subPath);
        } catch (e) {}
      }
    } else if (sub.isFile()) {
      try {
        const stats = fs.statSync(subPath);
        const fileDate = new Date(stats.mtime);
        const shouldDelete = isDateInRange(fileDate, startDate, endDate);
        if (shouldDelete) {
          fs.unlinkSync(subPath);
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

  // Cập nhật CSDL: Xóa proof_image cho các phân công của nhân viên này
  try {
    const pool = await getPool();
    // Tìm staffId từ tên nhân viên
    const staffResult = await pool.request()
      .input('name', sql.NVarChar, staffName)
      .query(`SELECT id FROM Staff WHERE name = @name`);

    if (staffResult.recordset.length > 0) {
      const staffId = staffResult.recordset[0].id;
      if (startDate && endDate) {
        await pool.request()
          .input('staffId', sql.Int, staffId)
          .input('startDate', sql.Date, startDateStr)
          .input('endDate', sql.Date, endDateStr)
          .query(`
            UPDATE WorkAssignments
            SET proof_image = NULL
            WHERE staff_id = @staffId AND assigned_date >= @startDate AND assigned_date <= @endDate
          `);
      } else if (endDate) {
        await pool.request()
          .input('staffId', sql.Int, staffId)
          .input('endDate', sql.Date, endDateStr)
          .query(`
            UPDATE WorkAssignments
            SET proof_image = NULL
            WHERE staff_id = @staffId AND assigned_date <= @endDate
          `);
      } else {
        await pool.request()
          .input('staffId', sql.Int, staffId)
          .query(`
            UPDATE WorkAssignments
            SET proof_image = NULL
            WHERE staff_id = @staffId
          `);
      }
    }
  } catch (err) {
    console.warn('Cập nhật proof_image CSDL thất bại:', err.message);
  }

  return { deletedCount: deletedFilesCount };
}

module.exports = {
  deletePhotosByDate,
  deletePhotosByDateRange,
  deletePhotosByStaff,
  autoCleanHousekeepingPhotosOlderThan30Days
};
