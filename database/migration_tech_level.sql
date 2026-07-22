-- ===================================================================
-- MIGRATION: Cấu trúc quản lý Bậc Kỹ Thuật (Tech Level) - ĐÃ FIX LỖI
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- 1. Bổ sung cột định danh hệ số vai trò vào bảng Staff nếu chưa có
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'tech_level')
BEGIN
    ALTER TABLE Staff ADD tech_level INT NULL DEFAULT 1;
    PRINT N'✅ Đã thêm cột tech_level vào bảng Staff (Mặc định bằng 1).';
END
GO

-- 2. Tạo bảng TechPriceConfig để lưu cấu hình hệ số tính lương
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('TechPriceConfig') AND type = 'U')
BEGIN
    CREATE TABLE TechPriceConfig (
        id INT IDENTITY(1,1) PRIMARY KEY,
        level_code INT NOT NULL UNIQUE,          
        role_name NVARCHAR(100) NOT NULL,         
        point_weight INT NOT NULL,                
        updated_at DATETIME DEFAULT GETDATE()
    );
    PRINT N'✅ Đã tạo bảng TechPriceConfig thành công.';
END
GO -- Bắt buộc phải có GO ở đây để tạo xong xuôi bảng trước khi INSERT

-- 3. Nạp dữ liệu cấu hình điểm (Chỉ nạp nếu bảng chưa có dữ liệu)
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('TechPriceConfig') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM TechPriceConfig)
    BEGIN
        INSERT INTO TechPriceConfig (level_code, role_name, point_weight)
        VALUES 
        (1, N'Nhân viên dọn phòng chính', 2),
        (2, N'Kỹ thuật viên hỗ trợ dọn phòng', 1);
        
        PRINT N'✅ Đã nạp cấu hình điểm thành công (HS1 = 2đ, HS2 = 1đ).';
    END
END
GO

-- 4. Cập nhật chức danh hệ số 2 cho anh Chiến và anh Thiên
UPDATE Staff SET tech_level = 2 WHERE name LIKE N'%Chiến%' OR name LIKE N'%Thiên%';
PRINT N'✅ Đã đồng bộ hệ số kỹ thuật (tech_level = 2) cho anh Chiến và anh Thiên.';
GO