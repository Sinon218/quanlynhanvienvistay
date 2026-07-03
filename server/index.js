// ===================================================================
// HỆ THỐNG QUẢN LÝ NHÂN VIÊN VISTAY - server/index.js
// ===================================================================
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const apartmentRoutes = require('./routes/apartments');
const workRoutes = require('./routes/work');
const salaryRoutes = require('./routes/salary');
const taskRoutes = require('./routes/tasks');
const { initStatusHistory } = require('./statusHistory');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const path = require('path');
const uploadDir = path.join(__dirname, '..', 'ảnh dọn phòng của nhân viên');
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/work', workRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/tasks', taskRoutes);

// Real-time Event Stream
const { sseMiddleware } = require('./sse');
app.get('/api/events', sseMiddleware);

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, '..')));

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (err instanceof Error && (err.message.includes('định dạng') || err.message.includes('file') || err.message.includes('MulterError') || err.message.includes('limit'))) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || 'Đã xảy ra lỗi hệ thống.' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on: http://localhost:${PORT}`);
  // Khởi tạo bảng lịch sử trạng thái phòng và seed dữ liệu nếu cần
  initStatusHistory().catch(err => console.error('Init status history failed:', err.message));
});
