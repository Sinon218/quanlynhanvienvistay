// ===================================================================
// GLOBAL CONFIGURATION - server/config.js
// Cấu trúc 3 tầng: Nguồn dữ liệu cấu hình duy nhất cho toàn bộ hệ thống
// ===================================================================

const CONFIG = {
  SALARY: {
    DEFAULT_BASE_SALARY: 5000000,     // Lương cơ bản mặc định: 5 triệu VND
    SPECIAL_BASE_SALARY: 7000000,     // Lương cơ bản đặc biệt: 7 triệu VND
    SPECIAL_STAFF: ['Lộc', 'Diệu'],  // Nhân viên hưởng lương đặc biệt
  },
  ROOM_RATES: {
    // Đơn giá dọn phòng theo loại phòng và loại công việc (SS lưu / Out / Tổng vệ sinh)
    'ss_luu': {
      '1 ngủ': 30000,
      '2 ngủ': 60000,
      '3 ngủ': 100000,
      '4 ngủ': 120000
    },
    'out': {
      '1 ngủ': 45000,
      '2 ngủ': 90000,
      '3 ngủ': 150000,
      '4 ngủ': 180000
    },
    'tong_ve_sinh': {
      '1 ngủ': 45000, // Tổng vệ sinh mặc định bằng giá dọn Out
      '2 ngủ': 90000,
      '3 ngủ': 150000,
      '4 ngủ': 180000
    },
    DEFAULT: 50000 // Đơn giá dự phòng nếu không tìm thấy loại phòng
  },
  TECH_PRICES: {
    1: 50000,   // Dễ
    2: 100000,  // Trung bình
    3: 150000,  // Khó
    4: 250000   // Cực khó
  }
};

module.exports = CONFIG;
