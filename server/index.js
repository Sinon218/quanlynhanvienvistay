// ===================================================================
// HỆ THỐNG QUẢN LÝ NHÂN VIÊN VISTAY - server/index.js
// ===================================================================
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const apartmentRoutes = require('./routes/apartments');
const workRoutes = require('./routes/work');
const salaryRoutes = require('./routes/salary');
const taskRoutes = require('./routes/tasks');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/work', workRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/tasks', taskRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống.' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
