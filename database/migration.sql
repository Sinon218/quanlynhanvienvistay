-- ===================================================================
-- MIGRATION TỔNG HỢP: ungdungquanlynhanvienvistay
-- Chạy file này trong SSMS để cập nhật database hiện tại
-- (Nếu tạo mới từ đầu, chạy schema.sql rồi seed.sql là đủ)
-- ===================================================================

USE ungdungquanlynhanvienvistay;
GO

-- ===================================================================
-- MIGRATION 1: Thêm nhân viên Lộc nếu chưa tồn tại
-- ===================================================================
IF NOT EXISTS (SELECT 1 FROM Staff WHERE name = N'Lộc')
BEGIN
    INSERT INTO Staff (name, default_name, type, room_role, tech_role)
    VALUES (N'Lộc', N'Lộc', 'full-time', 1, 0);
    PRINT N'✅ Đã thêm nhân viên Lộc';
END
GO

-- ===================================================================
-- MIGRATION 2: Cập nhật vai trò 'manager' cho Lộc và Diệu
-- ===================================================================

-- Sửa constraint role trên bảng Users cho phép 'manager'
DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('Users') AND definition LIKE '%role%';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Users DROP CONSTRAINT ' + @ConstraintName);
END
GO

ALTER TABLE Users ADD CONSTRAINT CK_Users_Role CHECK (role IN ('admin', 'employee', 'manager'));
GO

-- Tạo tài khoản loc nếu chưa có, hoặc cập nhật role
IF NOT EXISTS (SELECT 1 FROM Users WHERE username = 'loc')
BEGIN
    DECLARE @LocStaffId INT;
    SELECT @LocStaffId = id FROM Staff WHERE name = N'Lộc';
    
    IF @LocStaffId IS NOT NULL
    BEGIN
        INSERT INTO Users (username, password_hash, role, staff_id, is_active)
        VALUES ('loc', '$2a$10$7Z8.c9vH5m.7Jp679jI2.OcIlgM6B8E/R91kZ9L.F8.718p7e3e3e', 'manager', @LocStaffId, 1);
    END
END
ELSE
BEGIN
    UPDATE Users SET role = 'manager' WHERE username = 'loc';
END
GO

-- Cập nhật tài khoản dieu thành manager
UPDATE Users SET role = 'manager' WHERE username = 'dieu';
GO

-- ===================================================================
-- MIGRATION 3: Cập nhật trạng thái Apartments (bỏ 'cleaning')
-- ===================================================================
DECLARE @ConstraintName2 NVARCHAR(200);
SELECT @ConstraintName2 = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('Apartments') AND definition LIKE '%status%';

IF @ConstraintName2 IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Apartments DROP CONSTRAINT ' + @ConstraintName2);
END
GO

-- Chuyển các căn hộ đang ở trạng thái 'cleaning' về 'available'
UPDATE Apartments SET status = 'available' WHERE status = 'cleaning';
GO

ALTER TABLE Apartments ADD CONSTRAINT CK_Apartments_Status CHECK (status IN ('available', 'occupied', 'maintenance'));
GO

-- ===================================================================
-- MIGRATION 4: Bổ sung căn hộ mới theo danh sách thực tế
-- ===================================================================
IF EXISTS (SELECT 1 FROM Apartments WHERE code = 'B2102')
BEGIN
    IF EXISTS (SELECT 1 FROM Apartments WHERE code = 'B-2102')
    BEGIN
        DELETE FROM Apartments WHERE code = 'B2102';
    END
    ELSE
    BEGIN
        UPDATE Apartments SET code = 'B-2102' WHERE code = 'B2102';
    END
END
GO

DECLARE @ApartmentSeed TABLE (
    code VARCHAR(20) PRIMARY KEY,
    building NVARCHAR(10) NOT NULL,
    password NVARCHAR(50) NOT NULL,
    is_samsung BIT NOT NULL,
    room_type NVARCHAR(20) NOT NULL
);

INSERT INTO @ApartmentSeed (code, building, password, is_samsung, room_type) VALUES
(N'R6A-0505', N'R6A', N'111.000.222.33', 0, N'1 ngủ'),
(N'R6A-2806', N'R6A', N'2222.333.333', 0, N'1 ngủ'),
(N'S1-0405', N'S1', N'040505', 0, N'1 ngủ'),
(N'S1-0505', N'S1', N'000555', 1, N'1 ngủ'),
(N'S1-0905', N'S1', N'730399', 1, N'1 ngủ'),
(N'S1-1105', N'S1', N'220704', 0, N'1 ngủ'),
(N'S1-1605', N'S1', N'166.666', 0, N'1 ngủ'),
(N'S1-1705', N'S1', N'356835', 0, N'1 ngủ'),
(N'S1-1905', N'S1', N'199.999', 1, N'1 ngủ'),
(N'S1-2105', N'S1', N'222111', 0, N'1 ngủ'),
(N'S1-2305', N'S1', N'160.524', 0, N'1 ngủ'),
(N'S1-2405', N'S1', N'122.537', 1, N'1 ngủ'),
(N'S1-2705', N'S1', N'222777', 1, N'1 ngủ'),
(N'S1-3105', N'S1', N'333555', 1, N'1 ngủ'),
(N'S2-0610', N'S2', N'760.200', 1, N'1 ngủ'),
(N'S2-1110', N'S2', N'101010', 1, N'1 ngủ'),
(N'S2-1111', N'S2', N'838688', 1, N'1 ngủ'),
(N'S2-1512', N'S2', N'111222', 1, N'1 ngủ'),
(N'S2-1712', N'S2', N'320.500', 1, N'1 ngủ'),
(N'S2-2512', N'S2', N'225588', 1, N'1 ngủ'),
(N'S2-2810', N'S2', N'281000', 0, N'1 ngủ'),
(N'S2-3210', N'S2', N'333222', 1, N'1 ngủ'),
(N'S2-3810', N'S2', N'383838', 1, N'1 ngủ'),
(N'S2-3812', N'S2', N'101615', 1, N'1 ngủ'),
(N'S3-0511', N'S3', N'051100', 0, N'1 ngủ'),
(N'S3-1012', N'S3', N'101200', 0, N'1 ngủ'),
(N'S3-15A12', N'S3', N'111555', 1, N'1 ngủ'),
(N'S3-1811', N'S3', N'333666', 1, N'1 ngủ'),
(N'S3-2012', N'S3', N'111222', 1, N'1 ngủ'),
(N'S3-2412', N'S3', N'333666', 1, N'1 ngủ'),
(N'S3-2712', N'S3', N'271200', 0, N'1 ngủ'),
(N'S3-2911', N'S3', N'291100', 0, N'1 ngủ'),
(N'S3-3411', N'S3', N'123468', 1, N'1 ngủ'),
(N'S3-3512', N'S3', N'333.222', 1, N'1 ngủ'),
(N'R4-2519', N'R4', N'251900', 0, N'2 ngủ'),
(N'R5-2423', N'R5', N'242300', 0, N'2 ngủ'),
(N'S1-2405A', N'S1', N'456789', 1, N'2 ngủ'),
(N'S1-2505A', N'S1', N'000555', 1, N'2 ngủ'),
(N'S1-2809', N'S1', N'280900', 0, N'2 ngủ'),
(N'S2-0401', N'S2', N'040100', 0, N'2 ngủ'),
(N'S2-0501', N'S2', N'050100', 0, N'2 ngủ'),
(N'S2-0715', N'S2', N'686868', 0, N'2 ngủ'),
(N'S2-0908', N'S2', N'090800', 0, N'2 ngủ'),
(N'S2-11A11', N'S2', N'111168', 0, N'2 ngủ'),
(N'S2-1511A', N'S2', N'688688', 1, N'2 ngủ'),
(N'S2-1808', N'S2', N'180800', 0, N'2 ngủ'),
(N'S2-1901', N'S2', N'009966', 0, N'2 ngủ'),
(N'S2-2117', N'S2', N'211700', 0, N'2 ngủ'),
(N'S2-2211A', N'S2', N'668868', 1, N'2 ngủ'),
(N'S2-2411', N'S2', N'135246#', 1, N'2 ngủ'),
(N'S2-2811A', N'S2', N'281100', 0, N'2 ngủ'),
(N'S2-2916', N'S2', N'929268', 1, N'2 ngủ'),
(N'S2-3301', N'S2', N'333111', 0, N'2 ngủ'),
(N'S2-3316', N'S2', N'333366', 1, N'2 ngủ'),
(N'S2-3411A', N'S2', N'201099', 0, N'2 ngủ'),
(N'S2-3501', N'S2', N'350100', 0, N'2 ngủ'),
(N'S2-3517', N'S2', N'353568', 1, N'2 ngủ'),
(N'S2-3608', N'S2', N'363636', 0, N'2 ngủ'),
(N'S2-3708', N'S2', N'370800', 0, N'2 ngủ'),
(N'S2-3811A', N'S2', N'381100', 0, N'2 ngủ'),
(N'S2-3816', N'S2', N'383883', 1, N'2 ngủ'),
(N'S2-3908', N'S2', N'999888', 0, N'2 ngủ'),
(N'S3-0715', N'S3', N'071500', 0, N'2 ngủ'),
(N'S3-0810', N'S3', N'081000', 0, N'2 ngủ'),
(N'S3-0908', N'S3', N'999888', 0, N'2 ngủ'),
(N'S3-1001', N'S3', N'100100', 0, N'2 ngủ'),
(N'S3-15A08A', N'S3', N'150808', 0, N'2 ngủ'),
(N'S3-1616', N'S3', N'382838', 0, N'2 ngủ'),
(N'S3-1701', N'S3', N'240302', 0, N'2 ngủ'),
(N'S3-1901', N'S3', N'111119', 0, N'2 ngủ'),
(N'S3-2301', N'S3', N'230100', 0, N'2 ngủ'),
(N'S3-3001', N'S3', N'300100', 0, N'2 ngủ'),
(N'S3-3015', N'S3', N'305305', 1, N'2 ngủ'),
(N'S3-3316', N'S3', N'331600', 0, N'2 ngủ'),
(N'S3-2406', N'S3', N'240600', 0, N'3 ngủ'),
(N'S3-2909', N'S3', N'000999', 0, N'3 ngủ'),
(N'S2-1220', N'S2', N'111222', 0, N'3 ngủ'),
(N'S2-3420', N'S2', N'202002', 0, N'3 ngủ'),
(N'S3-3702', N'S3', N'370200', 0, N'3 ngủ'),
(N'S3-3906', N'S3', N'336699', 0, N'3 ngủ'),
(N'B-2102', N'B', N'456456*', 0, N'3 ngủ'),
(N'S2-2106', N'S2', N'222111', 0, N'4 ngủ'),
(N'S3-3918', N'S3', N'838386', 0, N'4 ngủ');

MERGE Apartments AS target
USING @ApartmentSeed AS source
ON target.code = source.code
WHEN MATCHED THEN
    UPDATE SET
        target.building = source.building,
        target.password = source.password,
        target.is_samsung = source.is_samsung,
        target.room_type = source.room_type
WHEN NOT MATCHED BY TARGET THEN
    INSERT (code, building, password, is_samsung, room_type, status)
    VALUES (source.code, source.building, source.password, source.is_samsung, source.room_type, 'available');
GO

-- ===================================================================
-- MIGRATION 5: Cập nhật trạng thái WorkAssignments (thêm 'approved')
-- ===================================================================
DECLARE @ConstraintName3 NVARCHAR(200);
SELECT @ConstraintName3 = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('WorkAssignments') AND definition LIKE '%status%';

IF @ConstraintName3 IS NOT NULL
BEGIN
    EXEC('ALTER TABLE WorkAssignments DROP CONSTRAINT ' + @ConstraintName3);
END
GO

ALTER TABLE WorkAssignments ADD CONSTRAINT CK_WorkAssignments_Status CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'rejected', 'approved'));
GO

-- ===================================================================
-- MIGRATION 6: Thêm cột cho NV kỹ thuật tự giao việc
-- ===================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'is_self_assigned')
BEGIN
    ALTER TABLE Tasks ADD is_self_assigned BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'before_image')
BEGIN
    ALTER TABLE Tasks ADD before_image NVARCHAR(MAX) NULL;
END
GO

-- ===================================================================
-- MIGRATION 7: Thêm cấp độ công việc kỹ thuật (tech_level, tech_price)
-- ===================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'tech_level')
BEGIN
    ALTER TABLE Tasks ADD tech_level INT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'tech_price')
BEGIN
    ALTER TABLE Tasks ADD tech_price DECIMAL(10,0) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'reject_reason')
BEGIN
    ALTER TABLE Tasks ADD reject_reason NVARCHAR(500) NULL;
END
GO

-- Cập nhật constraint Tasks status thêm 'approved'
DECLARE @ConstraintName4 NVARCHAR(200);
SELECT @ConstraintName4 = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('Tasks') AND definition LIKE '%status%';

IF @ConstraintName4 IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Tasks DROP CONSTRAINT ' + @ConstraintName4);
END
GO

ALTER TABLE Tasks ADD CONSTRAINT CK_Tasks_Status CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'rejected', 'approved'));
GO

-- ===================================================================
-- MIGRATION 8: Thêm cột checkin/checkout vào Apartments
-- ===================================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Apartments' AND COLUMN_NAME = 'checkin_date')
BEGIN
    ALTER TABLE Apartments ADD 
        checkin_date DATE NULL,
        checkin_time VARCHAR(10) NULL,
        checkout_date DATE NULL,
        checkout_time VARCHAR(10) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Apartments' AND COLUMN_NAME = 'maintenance_duration')
BEGIN
    ALTER TABLE Apartments ADD maintenance_duration INT NULL;
END
GO

-- ===================================================================
-- MIGRATION 9: Thêm cột expected_start/end vào WorkAssignments
-- ===================================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WorkAssignments' AND COLUMN_NAME = 'expected_start_at')
BEGIN
    ALTER TABLE WorkAssignments ADD 
        expected_start_at DATETIME NULL,
        expected_end_at DATETIME NULL;
END
GO

-- ===================================================================
-- MIGRATION 10: Thêm cột per_room_rate vào SalaryRecords
-- ===================================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SalaryRecords' AND COLUMN_NAME = 'per_room_rate')
BEGIN
    ALTER TABLE SalaryRecords ADD per_room_rate DECIMAL(10,0) NULL;
END
GO

-- Đổi kiểu total_rooms từ INT sang DECIMAL nếu cần
-- (SQL Server không cho đổi type trực tiếp nếu có data, skip nếu đã đúng)

-- ===================================================================
-- MIGRATION 11: Tạo bảng Notifications nếu chưa tồn tại
-- ===================================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Notifications')
BEGIN
    CREATE TABLE Notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        message NVARCHAR(500) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- ===================================================================
-- MIGRATION 12: Tạo bảng ApartmentStays nếu chưa tồn tại
-- ===================================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ApartmentStays')
BEGIN
    CREATE TABLE ApartmentStays (
        id INT IDENTITY(1,1) PRIMARY KEY,
        apartment_id INT NOT NULL FOREIGN KEY REFERENCES Apartments(id) ON DELETE CASCADE,
        checkin_date DATE NOT NULL,
        checkin_time VARCHAR(10) NOT NULL,
        checkout_date DATE NOT NULL,
        checkout_time VARCHAR(10) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_ApartmentStays_AptDate ON ApartmentStays(apartment_id, checkin_date, checkout_date);
END
GO

-- ===================================================================
-- MIGRATION 13: Cố định mức lương nhân viên
-- Mức lương: 5,000,000 VND (tất cả), 7,000,000 VND (Lộc, Diệu)
-- ===================================================================
UPDATE Staff SET base_salary = 5000000, per_room_rate = 50000
WHERE name NOT IN (N'Lộc', N'Diệu');
GO

UPDATE Staff SET base_salary = 7000000, per_room_rate = 50000
WHERE name IN (N'Lộc', N'Diệu');
GO

-- ===================================================================
-- MIGRATION 14: Cập nhật room_type cho tất cả căn hộ
-- ===================================================================
UPDATE Apartments SET room_type = N'1 ngủ' WHERE code IN ('R6A-0505','R6A-2806','S1-0405','S1-0505','S1-0905','S1-1105','S1-1605','S1-1705','S1-1905','S1-2105','S1-2305','S1-2405','S1-2505','S1-2705','S1-3105','S2-0610','S2-1110','S2-1111','S2-1512','S2-1712','S2-2512','S2-2810','S2-3210','S2-3810','S2-3812','S3-0511','S3-1012','S3-15A12','S3-1811','S3-2012','S3-2412','S3-2712','S3-2911','S3-3411','S3-3512');
UPDATE Apartments SET room_type = N'2 ngủ' WHERE code IN ('R4-2519','R5-2423','S1-2405A','S1-2505A','S1-2809','S2-0401','S2-0501','S2-0715','S2-0908','S2-11A11','S2-1511A','S2-1808','S2-1901','S2-2117','S2-2211A','S2-2411','S2-2811A','S2-2916','S2-3301','S2-3316','S2-3411A','S2-3501','S2-3517','S2-3608','S2-3708','S2-3811A','S2-3816','S2-3908','S3-0715','S3-0810','S3-0908','S3-1001','S3-15A08A','S3-1616','S3-1701','S3-1901','S3-2301','S3-3001','S3-3015','S3-3316');
UPDATE Apartments SET room_type = N'3 ngủ' WHERE code IN ('B-2102','S1-0508','S2-1220','S3-2406','S3-2909','S2-3420','S3-3702','S3-3906');
UPDATE Apartments SET room_type = N'4 ngủ' WHERE code IN ('S2-2106','S3-3918');
GO

-- ===================================================================
PRINT N'✅ Migration tổng hợp hoàn tất!';
PRINT N'   - Role manager cho Lộc, Diệu';
PRINT N'   - Lương cố định: 5tr (tất cả), 7tr (Lộc, Diệu)';
PRINT N'   - Status approved cho WorkAssignments và Tasks';
PRINT N'   - Cột tech_level, tech_price, reject_reason cho Tasks';
PRINT N'   - Cột checkin/checkout cho Apartments';
PRINT N'   - Bảng ApartmentStays, Notifications';
GO