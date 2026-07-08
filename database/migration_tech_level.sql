-- ===================================================================
-- MIGRATION: Cấu trúc quản lý Bậc Kỹ Thuật (Tech Level)
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- 1. Bổ sung cột định danh hệ số vai trò vào bảng Staff nếu chưa có
-- Quy ước: 1 = Nhân viên dọn dẹp chính | 2 = Nhân viên kỹ thuật (Thương, Thiên...)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'tech_level')
BEGIN
    ALTER TABLE Staff ADD tech_level INT NULL DEFAULT 1;
    PRINT N'✅ Đã thêm cột tech_level vào bảng Staff (Mặc định bằng 1).';
END
GO

-- 2. Tạo bảng TechPriceConfig để lưu cấu hình hệ số tính lương (nếu cần mở rộng sau này)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('TechPriceConfig') AND type = 'U')
BEGIN
    CREATE TABLE TechPriceConfig (
        id INT IDENTITY(1,1) PRIMARY KEY,
        level_code INT NOT NULL UNIQUE,          -- 1 hoặc 2
        role_name NVARCHAR(100) NOT NULL,         -- N'Dọn phòng' hoặc N'Kỹ thuật hỗ trợ'
        point_weight INT NOT NULL,                -- Hệ số điểm cổ phần (HS1 = 2 điểm, HS2 = 1 điểm)
        updated_at DATETIME DEFAULT GETDATE()
    );
    
    -- Nạp dữ liệu cấu hình điểm mặc định theo ý tưởng thuật toán đã chốt
    INSERT INTO TechPriceConfig (level_code, role_name, point_weight)
    VALUES 
    (1, N'Nhân viên dọn phòng chính', 2),
    (2, N'Kỹ thuật viên hỗ trợ dọn phòng', 1);
    
    PRINT N'✅ Đã tạo bảng TechPriceConfig và nạp cấu hình điểm (HS1 = 2đ, HS2 = 1đ).';
END
GO

-- 3. Cập nhật chức danh hệ số 2 cho anh Thương và anh Thiên
-- (Giả định ID của anh Thương và anh Thiên trong bảng Staff, bạn có thể sửa lại theo đúng tên thực tế)
UPDATE Staff SET tech_level = 2 WHERE name LIKE N'%Thương%' OR name LIKE N'%Thiên%';
PRINT N'✅ Đã đồng bộ hệ số kỹ thuật (tech_level = 2) cho anh Thương và anh Thiên.';
GO