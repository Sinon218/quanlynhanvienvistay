-- ===================================================================
-- DATABASE SCHEMA: ungdungquanlynhanvienvistay
-- Hệ Thống Quản Lý Nhân Viên ViStay
-- Chạy file này trong SSMS để tạo mới toàn bộ database
-- ===================================================================

USE master;
GO

IF EXISTS (SELECT name FROM sys.databases WHERE name = N'ungdungquanlynhanvienvistay')
BEGIN
    ALTER DATABASE ungdungquanlynhanvienvistay SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE ungdungquanlynhanvienvistay;
END
GO

CREATE DATABASE ungdungquanlynhanvienvistay;
GO

USE ungdungquanlynhanvienvistay;
GO

-- ===== BẢNG 1: Staff (Nhân viên) =====
CREATE TABLE Staff (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    default_name NVARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('full-time', 'part-time')),
    room_role INT NOT NULL DEFAULT 0 CHECK (room_role IN (0, 1, 2)),
    tech_role INT NOT NULL DEFAULT 0 CHECK (tech_role IN (0, 1, 2)),
    base_salary DECIMAL(12,0) NULL,
    per_room_rate DECIMAL(10,0) NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 2: Users (Tài khoản đăng nhập) =====
-- Role: admin, employee, manager
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CONSTRAINT CK_Users_Role CHECK (role IN ('admin', 'employee', 'manager')),
    staff_id INT NULL FOREIGN KEY REFERENCES Staff(id),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 3: Apartments (Căn hộ) =====
-- Status: available, occupied, maintenance (không có cleaning)
CREATE TABLE Apartments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    building NVARCHAR(10) NOT NULL,
    password NVARCHAR(50) NOT NULL,
    is_samsung BIT NOT NULL DEFAULT 0,
    room_type NVARCHAR(20) NOT NULL DEFAULT N'2 ngủ',
    status VARCHAR(20) NOT NULL DEFAULT 'available' 
        CONSTRAINT CK_Apartments_Status CHECK (status IN ('available', 'occupied', 'maintenance')),
    default_cleaning_rate DECIMAL(10,0) NULL,
    checkin_date DATE NULL,
    checkin_time VARCHAR(10) NULL,
    checkout_date DATE NULL,
    checkout_time VARCHAR(10) NULL,
    maintenance_duration INT NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 4: WorkAssignments (Phân công trong ngày) =====
-- Status: pending, accepted, in-progress, completed, rejected, approved
CREATE TABLE WorkAssignments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    staff_id INT NOT NULL FOREIGN KEY REFERENCES Staff(id),
    apartment_id INT NOT NULL FOREIGN KEY REFERENCES Apartments(id),
    task_type VARCHAR(20) NOT NULL DEFAULT 'out'
        CHECK (task_type IN ('ss_luu', 'out', 'tong_ve_sinh')),
    assigned_role INT NOT NULL DEFAULT 1 CHECK (assigned_role IN (0, 1, 2)),
    assigned_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CONSTRAINT CK_WorkAssignments_Status CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'rejected', 'approved')),
    completed_at DATETIME NULL,
    proof_image NVARCHAR(MAX) NULL,
    notes NVARCHAR(500) NULL,
    expected_start_at DATETIME NULL,
    expected_end_at DATETIME NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 5: SalaryRecords (Bảng lương tháng) =====
CREATE TABLE SalaryRecords (
    id INT IDENTITY(1,1) PRIMARY KEY,
    staff_id INT NOT NULL FOREIGN KEY REFERENCES Staff(id),
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL,
    base_salary DECIMAL(12,0) NULL,
    per_room_rate DECIMAL(10,0) NULL,
    total_rooms DECIMAL(6,2) NOT NULL DEFAULT 0,
    bonus DECIMAL(12,0) NOT NULL DEFAULT 0,
    deductions DECIMAL(12,0) NOT NULL DEFAULT 0,
    total_salary DECIMAL(12,0) NULL,
    notes NVARCHAR(500) NULL,
    created_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_Salary_Staff_Month UNIQUE (staff_id, month, year)
);
GO

-- ===== BẢNG 6: AuditLog (Lịch sử đổi MK căn hộ) =====
CREATE TABLE AuditLog (
    id INT IDENTITY(1,1) PRIMARY KEY,
    apartment_id INT NOT NULL FOREIGN KEY REFERENCES Apartments(id),
    old_password NVARCHAR(50),
    new_password NVARCHAR(50),
    changed_by INT NULL FOREIGN KEY REFERENCES Users(id),
    changed_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 7: Notifications (Thông báo thay đổi mật khẩu) =====
CREATE TABLE Notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    message NVARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 8: Tasks (Công việc kỹ thuật) =====
-- Status: pending, accepted, in-progress, completed, rejected, approved
CREATE TABLE Tasks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    staff_id INT NOT NULL FOREIGN KEY REFERENCES Staff(id),
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    assigned_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CONSTRAINT CK_Tasks_Status CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'rejected', 'approved')),
    completed_at DATETIME NULL,
    proof_image NVARCHAR(MAX) NULL,
    is_self_assigned BIT NOT NULL DEFAULT 0,
    before_image NVARCHAR(MAX) NULL,
    tech_level INT NULL,
    tech_price DECIMAL(10,0) NULL,
    reject_reason NVARCHAR(500) NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 9: ApartmentStatusHistory (Lịch sử trạng thái phòng) =====
CREATE TABLE ApartmentStatusHistory (
    id INT IDENTITY(1,1) PRIMARY KEY,
    apartment_id INT NOT NULL FOREIGN KEY REFERENCES Apartments(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('available', 'occupied', 'maintenance')),
    recorded_at DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- ===== BẢNG 10: ApartmentStays (Lịch sử lưu trú) =====
CREATE TABLE ApartmentStays (
    id INT IDENTITY(1,1) PRIMARY KEY,
    apartment_id INT NOT NULL FOREIGN KEY REFERENCES Apartments(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    checkin_time VARCHAR(10) NOT NULL,
    checkout_date DATE NOT NULL,
    checkout_time VARCHAR(10) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- ===== INDEXES =====
CREATE INDEX IX_WorkAssignments_StaffDate ON WorkAssignments(staff_id, assigned_date);
CREATE INDEX IX_WorkAssignments_ApartmentDate ON WorkAssignments(apartment_id, assigned_date);
CREATE INDEX IX_Apartments_Building ON Apartments(building);
CREATE INDEX IX_SalaryRecords_StaffMonth ON SalaryRecords(staff_id, year, month);
CREATE INDEX IX_ApartmentStatusHistory_AptDate ON ApartmentStatusHistory(apartment_id, recorded_at);
CREATE INDEX IX_ApartmentStays_AptDate ON ApartmentStays(apartment_id, checkin_date, checkout_date);
CREATE INDEX IX_Tasks_StaffDate ON Tasks(staff_id, assigned_date);
GO

PRINT N'✅ Schema created successfully!';
PRINT N'   Bao gồm: Staff, Users(admin/employee/manager), Apartments, WorkAssignments,';
PRINT N'   SalaryRecords, AuditLog, Notifications, Tasks, ApartmentStatusHistory, ApartmentStays';
GO