// ===================================================================
// JWT Authentication Middleware
// ===================================================================
const jwt = require('jsonwebtoken');

// Verify JWT token
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập. Vui lòng đăng nhập.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role, staffId }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

// Check admin role
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập chức năng này.' });
  }
  next();
}

// Check admin or manager role
function requireManagerOrAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập chức năng này.' });
  }
  next();
}

// Check if user is accessing their own data or is admin
function requireSelfOrAdmin(req, res, next) {
  const staffId = parseInt(req.params.staffId);
  if (req.user.role === 'admin' || req.user.staffId === staffId) {
    next();
  } else {
    return res.status(403).json({ error: 'Bạn chỉ có thể xem thông tin của bản thân.' });
  }
}

// Check if user is admin or special staff (Lộc, Diệu) for password/info management
function requireAdminOrSpecialStaff(req, res, next) {
  const allowedUsernames = ['vistay', 'loc', 'dieu'];
  const allowedNames = ['Lộc', 'Diệu'];
  if (req.user.role === 'admin' 
      || req.user.role === 'manager'
      || allowedUsernames.includes(req.user.username) 
      || allowedNames.includes(req.user.staffName)) {
    next();
  } else {
    return res.status(403).json({ error: 'Chỉ Admin, Admin phụ, Lộc và Diệu có quyền thay đổi thông tin căn hộ.' });
  }
}

module.exports = { authenticate, requireAdmin, requireManagerOrAdmin, requireSelfOrAdmin, requireAdminOrSpecialStaff };
