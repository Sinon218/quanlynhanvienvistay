// ===================================================================
// HỆ THỐNG QUẢN LÝ NHÂN VIÊN VISTAY - server/index.js
// Cấu trúc 3 tầng: App Layer (Express Server)
// ===================================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ===== Import Routes =====
const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const apartmentRoutes = require('./routes/apartments');
const workRoutes = require('./routes/work');
const salaryRoutes = require('./routes/salary');
const taskRoutes = require('./routes/tasks');
const techRoutes = require('./routes/tech');
const { initStatusHistory } = require('./statusHistory');
const { sseMiddleware } = require('./sse');
const { autoCleanHousekeepingPhotosOlderThan30Days } = require('./services/photoCleanup');

// ===== Initialize Express App =====
const app = express();

// ===== Middleware =====
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ===== Static File Serving =====
const uploadDir = path.join(__dirname, '..', 'ảnh dọn phòng của nhân viên');
app.use('/uploads', express.static(uploadDir));

// Serve Frontend Static Files (Web Layer)
app.use(express.static(path.join(__dirname, '..')));

// ===== Request Logging (Development) =====
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`⚠️ Slow request: ${req.method} ${req.originalUrl} (${duration}ms)`);
      }
    });
    next();
  });
}

// ===== API Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/work', workRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tech', techRoutes);

// ===== Real-time Event Stream =====
app.get('/api/events', sseMiddleware);

// ===== Health Check =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ===== Global Configuration Config Endpoint =====
app.get('/api/config', (req, res) => {
  const config = require('./config');
  res.json(config);
});

// ===== 404 Handler =====
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}` });
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);

  // Multer / File upload errors
  if (err.name === 'MulterError' || (err instanceof Error && (
    err.message.includes('định dạng') ||
    err.message.includes('file') ||
    err.message.includes('MulterError') ||
    err.message.includes('limit')
  ))) {
    return res.status(400).json({ error: err.message });
  }

  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500
      ? 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'
      : err.message
  });
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 ViStay Server is running on: http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Static files: ${path.join(__dirname, '..')}`);
  console.log(`📸 Uploads: ${uploadDir}`);
  console.log('====================================================');

  // Khởi tạo bảng lịch sử trạng thái phòng và seed dữ liệu nếu cần
  initStatusHistory().catch(err => console.error('Init status history failed:', err.message));

  // Tự động kiểm tra & dọn dẹp ảnh dọn phòng của nhân viên buồng phòng quá 30 ngày
  autoCleanHousekeepingPhotosOlderThan30Days().catch(err => console.error('Auto photo cleanup failed:', err.message));
  setInterval(() => {
    autoCleanHousekeepingPhotosOlderThan30Days().catch(err => console.error('Auto photo cleanup failed:', err.message));
  }, 24 * 60 * 60 * 1000);
});

// ===== Graceful Shutdown =====
function gracefulShutdown(signal) {
  console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});
