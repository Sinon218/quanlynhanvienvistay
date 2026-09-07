-- ===================================================================
-- MIGRATION: Thêm bảng Attendance cho Part-Time Check-in/Out
-- Chạy file này trong SSMS trước khi sử dụng tính năng chấm công
-- ===================================================================

USE ungdungquanlynhanvienvistay;
GO

-- ===== BƯỚC 1: Thêm role 'parttime' vào Users =====
-- Xóa constraint cũ
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'CK_Users_Role' AND type = 'C')
BEGIN
    ALTER TABLE Users DROP CONSTRAINT CK_Users_Role;
END
GO

-- Thêm constraint mới với role 'parttime'
ALTER TABLE Users ADD CONSTRAINT CK_Users_Role 
    CHECK (role IN ('admin', 'employee', 'manager', 'parttime'));
GO

PRINT N'✅ Đã cập nhật constraint Users.role (thêm parttime)';
GO

-- ===== BƯỚC 2: Tạo bảng Attendance =====
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Attendance')
BEGIN
    CREATE TABLE Attendance (
        id INT IDENTITY(1,1) PRIMARY KEY,
        staff_id INT NOT NULL FOREIGN KEY REFERENCES Staff(id),
        check_in DATETIME NOT NULL,
        check_in_rounded VARCHAR(10) NOT NULL,
        check_out DATETIME NULL,
        check_out_rounded VARCHAR(10) NULL,
        work_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        total_hours DECIMAL(5,2) NULL,
        notes NVARCHAR(500) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_Attendance_StaffDate UNIQUE (staff_id, work_date)
    );

    CREATE INDEX IX_Attendance_StaffDate ON Attendance(staff_id, work_date);
    CREATE INDEX IX_Attendance_WorkDate ON Attendance(work_date);

    PRINT N'✅ Đã tạo bảng Attendance';
END
ELSE
BEGIN
    PRINT N'⚠️ Bảng Attendance đã tồn tại, bỏ qua.';
END
GO

PRINT N'✅ Migration Attendance hoàn tất!';
PRINT N'   Bảng Attendance: staff_id, check_in, check_in_rounded, check_out, check_out_rounded, work_date, total_hours';
GO
