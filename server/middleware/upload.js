const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'ảnh dọn phòng của nhân viên');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeFolderName(name) {
  if (!name) return 'Chung';
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const rawStaffName = (req.user && (req.user.staffName || req.user.username)) || 'Chung';
    const staffFolder = sanitizeFolderName(rawStaffName);
    const dateFolder = getLocalDateString();

    const targetDir = path.join(uploadDir, staffFolder, dateFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: function (req, file, cb) {
    const isImageMime = file.mimetype && file.mimetype.startsWith('image/');
    const filetypes = /jpeg|jpg|png|webp|gif|heic|heif|tiff/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (isImageMime || extname) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận các định dạng file ảnh (jpg, jpeg, png, webp, gif, heic, heif)!'));
  }
});

module.exports = upload;
