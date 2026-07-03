-- ===================================================================
-- DATABASE: ungdungquanlynhanvienvistay
-- Hệ Thống Quản Lý Nhân Viên ViStay
-- ===================================================================

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
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee')),
    staff_id INT NULL FOREIGN KEY REFERENCES Staff(id),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 3: Apartments (Căn hộ) =====
CREATE TABLE Apartments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    building NVARCHAR(10) NOT NULL,
    password NVARCHAR(50) NOT NULL,
    is_samsung BIT NOT NULL DEFAULT 0,
    room_type NVARCHAR(20) NOT NULL DEFAULT N'2 ngủ',
    status VARCHAR(20) NOT NULL DEFAULT 'available' 
        CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance')),
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ===== BẢNG 4: WorkAssignments (Phân công trong ngày) =====
CREATE TABLE WorkAssignments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    staff_id INT NOT NULL FOREIGN KEY REFERENCES Staff(id),
    apartment_id INT NOT NULL FOREIGN KEY REFERENCES Apartments(id),
    task_type VARCHAR(20) NOT NULL DEFAULT 'out'
        CHECK (task_type IN ('ss_luu', 'out', 'tong_ve_sinh')),
    assigned_role INT NOT NULL DEFAULT 1 CHECK (assigned_role IN (0, 1, 2)),
    assigned_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'rejected')),
    completed_at DATETIME NULL,
    proof_image NVARCHAR(MAX) NULL,
    notes NVARCHAR(500) NULL,
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
    total_rooms INT NOT NULL DEFAULT 0,
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

-- ===== BẢNG 8: Tasks (Công việc tùy ý giao cho NV) =====
CREATE TABLE Tasks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    staff_id INT NOT NULL FOREIGN KEY REFERENCES Staff(id),
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    assigned_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'rejected')),
    completed_at DATETIME NULL,
    proof_image NVARCHAR(MAX) NULL,
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

-- ===== INDEXES =====
CREATE INDEX IX_WorkAssignments_StaffDate ON WorkAssignments(staff_id, assigned_date);
CREATE INDEX IX_WorkAssignments_ApartmentDate ON WorkAssignments(apartment_id, assigned_date);
CREATE INDEX IX_Apartments_Building ON Apartments(building);
CREATE INDEX IX_SalaryRecords_StaffMonth ON SalaryRecords(staff_id, year, month);
CREATE INDEX IX_ApartmentStatusHistory_AptDate ON ApartmentStatusHistory(apartment_id, recorded_at);
GO

PRINT N'✅ Schema created successfully!';
GO
