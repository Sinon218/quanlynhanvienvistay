# ViStay Employee Management System
## Hệ Thống Quản Lý Nhân Viên ViStay

### Cấu Trúc 3 Tầng (3-Tier Architecture)

```
quanlynhanvien/
├── database/                    # 🗄️ TẦNG 1: DATABASE LAYER
│   ├── schema.sql              # Cấu trúc bảng (DDL)
│   ├── seed.sql                # Dữ liệu mẫu (DML)
│   ├── migration.sql           # Migration: role manager, căn hộ mới
│   ├── migration_tech_level.sql # Migration: cấp độ kỹ thuật
│   └── migration_salary.sql    # Migration: cố định mức lương
│
├── server/                      # ⚙️ TẦNG 2: APPLICATION LAYER (API)
│   ├── index.js                # Entry point - Express server
│   ├── db.js                   # Database connection pool
│   ├── .env                    # Cấu hình kết nối (không commit)
│   ├── seed.js                 # Script seed dữ liệu
│   ├── migrate.js              # Script migration tự động
│   ├── migrate_salary.js       # Script migration lương
│   ├── statusHistory.js        # Quản lý lịch sử trạng thái
│   ├── sse.js                  # Server-Sent Events (real-time)
│   ├── utils.js                # Shared utilities
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   └── upload.js           # Multer file upload
│   └── routes/
│       ├── auth.js             # Đăng nhập, đổi MK, /me
│       ├── staff.js            # CRUD nhân viên
│       ├── apartments.js       # Quản lý căn hộ, timeline
│       ├── work.js             # Phân công dọn phòng
│       ├── tasks.js            # Công việc kỹ thuật
│       └── salary.js           # Bảng lương
│
├── web/                         # 🌐 TẦNG 3: WEB LAYER (Frontend)
│   └── (web khách hàng - sẽ bổ sung sau)
│
├── index.html                   # Trang đăng nhập
├── admin.html                   # Admin Dashboard
├── admin.js                     # Admin logic
├── employee.html                # Giao diện nhân viên
├── employee.js                  # Employee logic
├── app.js                       # Shared frontend logic (offline)
├── style.css                    # Stylesheet
└── package.json                 # Root scripts
```

### Cấu Hình Lương Cố Định

| Nhân viên | Lương cơ bản | Đơn giá/phòng |
|-----------|-------------|---------------|
| Tất cả NV | 5.000.000 VND | 50.000 VND |
| **Lộc** | **7.000.000 VND** | 50.000 VND |
| **Diệu** | **7.000.000 VND** | 50.000 VND |

### Tài Khoản Đăng Nhập

| Vai trò | Username | Password |
|---------|----------|----------|
| Admin | vistay | 12345678 |
| Manager | loc | 12345678 |
| Manager | dieu | 12345678 |
| NV | lien, thien, thuong, van, hoan | 12345678 |
| NV Part-time | parttime1, parttime2 | 12345678 |

### Scripts

```bash
# Khởi động server
npm start                # Production mode
npm run dev              # Development mode (auto-reload)

# Database
npm run seed             # Seed toàn bộ dữ liệu (XOÁ hết rồi tạo lại)
npm run migrate          # Chạy migration (thêm cột mới)
npm run migrate:salary   # Cập nhật mức lương cố định
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | ❌ | Đăng nhập |
| GET | /api/auth/me | ✅ | Thông tin user |
| PUT | /api/auth/change-password | ✅ | Đổi mật khẩu |
| GET | /api/staff | ✅ | Danh sách NV |
| GET | /api/apartments | ✅ | Danh sách căn hộ |
| GET | /api/apartments/stats | ✅ | Thống kê |
| GET | /api/apartments/status-history | ✅ | Lịch sử trạng thái |
| GET | /api/apartments/status-timeline | ✅ | Timeline trạng thái |
| POST | /api/work/assign | ✅ Admin | Giao việc |
| GET | /api/work/today | ✅ | Việc hôm nay |
| GET | /api/salary | ✅ Admin | Bảng lương |
| GET | /api/salary/:staffId | ✅ Self/Admin | Lương cá nhân |
| GET | /api/health | ❌ | Health check |
| GET | /api/events | ✅ | SSE real-time |
