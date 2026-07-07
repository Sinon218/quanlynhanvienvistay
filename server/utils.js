// ===================================================================
// Shared Utility Functions - server/utils.js
// Cấu trúc 3 tầng: App Layer (Shared Utilities)
// ===================================================================

/**
 * Đảm bảo bảng Notifications tồn tại
 */
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

/**
 * Lấy ngày hiện tại theo timezone Việt Nam dạng YYYY-MM-DD
 */
function getLocalDate() {
  const options = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

module.exports = { ensureNotificationsTable, getLocalDate };
