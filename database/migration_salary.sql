-- ===================================================================
-- MIGRATION: Cấu trúc bảng quản lý Lương Nhân Viên (Salary)
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- 1. Bổ sung cột lương cơ bản vào bảng Staff nếu chưa có
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'base_salary')
BEGIN
    ALTER TABLE Staff ADD base_salary DECIMAL(12,0) NULL DEFAULT 5500000;
    PRINT N'✅ Đã thêm cột base_salary (Mức lương 5.5tr) vào bảng Staff.';
END
GO

-- 2. Tạo bảng SalaryRecords để chốt tổng lương cuối tháng cho kế toán
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('SalaryRecords') AND type = 'U')
BEGIN
    CREATE TABLE SalaryRecords (
        id INT IDENTITY(1,1) PRIMARY KEY,
        staff_id INT NOT NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        base_salary_snapshot DECIMAL(12,0) NOT NULL, -- Giữ mức lương cứng tại thời điểm chốt
        total_cleaning_bonus DECIMAL(12,0) DEFAULT 0, -- Tổng tiền dọn phòng cộng dồn từ WorkAssignments
        other_bonus DECIMAL(12,0) DEFAULT 0,          -- Khen thưởng thêm
        deductions DECIMAL(12,0) DEFAULT 0,           -- Khấu trừ/Phạt
        final_salary DECIMAL(12,0) NOT NULL,          -- Tổng thực nhận cuối cùng
        status NVARCHAR(50) DEFAULT N'pending',       -- pending, approved, paid
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_SalaryRecords_Staff FOREIGN KEY (staff_id) REFERENCES Staff(id),
        CONSTRAINT UC_Staff_Month_Year UNIQUE (staff_id, month, year) -- Tránh chốt trùng lương 2 lần/tháng
    );
    PRINT N'✅ Đã tạo bảng SalaryRecords lưu trữ lịch sử lương tháng.';
END
GO