USE ungdungquanlynhanvienvistay;
GO

-- 1. Thêm nhân viên Lộc nếu chưa tồn tại
IF NOT EXISTS (SELECT 1 FROM Staff WHERE name = N'Lộc')
BEGIN
    INSERT INTO Staff (name, default_name, type, room_role, tech_role)
    VALUES (N'Lộc', N'Lộc', 'full-time', 1, 0);
END
GO

-- 2. Cập nhật vai trò 'manager' cho tài khoản dieu và loc
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

IF NOT EXISTS (SELECT 1 FROM Users WHERE username = 'loc')
BEGIN
    DECLARE @LocStaffId INT;
    SELECT @LocStaffId = id FROM Staff WHERE name = N'Lộc';
    
    INSERT INTO Users (username, password_hash, role, staff_id, is_active)
    VALUES ('loc', '$2a$10$7Z8.c9vH5m.7Jp679jI2.OcIlgM6B8E/R91kZ9L.F8.718p7e3e3e', 'manager', @LocStaffId, 1);
END
ELSE
BEGIN
    UPDATE Users SET role = 'manager' WHERE username = 'loc';
END
GO

UPDATE Users SET role = 'manager' WHERE username = 'dieu';
GO

-- 3. Cập nhật check constraint trên bảng Apartments để xóa 'cleaning'
DECLARE @ConstraintName2 NVARCHAR(200);
SELECT @ConstraintName2 = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('Apartments') AND definition LIKE '%status%';

IF @ConstraintName2 IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Apartments DROP CONSTRAINT ' + @ConstraintName2);
END
GO

UPDATE Apartments SET status = 'available' WHERE status = 'cleaning';
GO

ALTER TABLE Apartments ADD CONSTRAINT CK_Apartments_Status CHECK (status IN ('available', 'occupied', 'maintenance'));
GO

-- 4. Bổ sung căn hộ và đồng bộ luôn giá dọn riêng theo loại phòng
DECLARE @ApartmentSeed TABLE (
    code VARCHAR(20) PRIMARY KEY,
    building NVARCHAR(10) NOT NULL,
    password NVARCHAR(50) NOT NULL,
    is_samsung BIT NOT NULL,
    room_type NVARCHAR(20) NOT NULL,
    default_cleaning_rate DECIMAL(10,0)
);

INSERT INTO @ApartmentSeed (code, building, password, is_samsung, room_type, default_cleaning_rate) VALUES
('R6A-0505', N'R6A', N'111.000.222.33', 0, N'1 ngủ', 40000),
('R6A-2806', N'R6A', N'2222.333.333', 0, N'1 ngủ', 40000),
('S1-0405', N'S1', N'040505', 0, N'1 ngủ', 40000),
('S1-0505', N'S1', N'000555', 1, N'1 ngủ', 40000),
('S1-0905', N'S1', N'730399', 1, N'1 ngủ', 40000),
('S1-1105', N'S1', N'220704', 0, N'1 ngủ', 40000),
('S1-1605', N'S1', N'166.666', 0, N'1 ngủ', 40000),
('S1-1705', N'S1', N'356835', 0, N'1 ngủ', 40000),
('S1-1905', N'S1', N'199.999', 1, N'1 ngủ', 40000),
('S1-2105', N'S1', N'222111', 0, N'1 ngủ', 40000),
('S1-2305', N'S1', N'160.524', 0, N'1 ngủ', 40000),
('S1-2405', N'S1', N'122.537', 1, N'1 ngủ', 40000),
('S1-2705', N'S1', N'222777', 1, N'1 ngủ', 40000),
('S1-3105', N'S1', N'333555', 1, N'1 ngủ', 40000),
('S2-0610', N'S2', N'760.200', 1, N'1 ngủ', 40000),
('S2-1110', N'S2', N'101010', 1, N'1 ngủ', 40000),
('S2-1111', N'S2', N'838688', 1, N'1 ngủ', 40000),
('S2-1512', N'S2', N'111222', 1, N'1 ngủ', 40000),
('S2-1712', N'S2', N'320.500', 1, N'1 ngủ', 40000),
('S2-2512', N'S2', N'225588', 1, N'1 ngủ', 40000),
('S2-2810', N'S2', N'281000', 0, N'1 ngủ', 40000),
('S2-3210', N'S2', N'333222', 1, N'1 ngủ', 40000),
('S2-3810', N'S2', N'383838', 1, N'1 ngủ', 40000),
('S2-3812', N'S2', N'101615', 1, N'1 ngủ', 40000),
('S3-0511', N'S3', N'051100', 0, N'1 ngủ', 40000),
('S3-1012', N'S3', N'101200', 0, N'1 ngủ', 40000),
('S3-15A12', N'S3', N'111555', 1, N'1 ngủ', 40000),
('S3-1811', N'S3', N'333666', 1, N'1 ngủ', 40000),
('S3-2012', N'S3', N'111222', 1, N'1 ngủ', 40000),
('S3-2412', N'S3', N'333666', 1, N'1 ngủ', 40000),
('S3-2712', N'S3', N'271200', 0, N'1 ngủ', 40000),
('S3-2911', N'S3', N'291100', 0, N'1 ngủ', 40000),
('S3-3411', N'S3', N'123468', 1, N'1 ngủ', 40000),
('S3-3512', N'S3', N'333.222', 1, N'1 ngủ', 40000),
('R4-2519', N'R4', N'251900', 0, N'2 ngủ', 50000),
('R5-2423', N'R5', N'242300', 0, N'2 ngủ', 50000),
('S1-2405A', N'S1', N'456789', 1, N'2 ngủ', 50000),
('S1-2505A', N'S1', N'000555', 1, N'2 ngủ', 50000),
('S1-2809', N'S1', N'280900', 0, N'2 ngủ', 50000),
('S2-0401', N'S2', N'040100', 0, N'2 ngủ', 50000),
('S2-0501', N'S2', N'050100', 0, N'2 ngủ', 50000),
('S2-0715', N'S2', N'686868', 0, N'2 ngủ', 50000),
('S2-0908', N'S2', N'090800', 0, N'2 ngủ', 50000),
('S2-11A11', N'S2', N'111168', 0, N'2 ngủ', 50000),
('S2-1511A', N'S2', N'688688', 1, N'2 ngủ', 50000),
('S2-1808', N'S2', N'180800', 0, N'2 ngủ', 50000),
('S2-1901', N'S2', N'009966', 0, N'2 ngủ', 50000),
('S2-2117', N'S2', N'211700', 0, N'2 ngủ', 50000),
('S2-2211A', N'S2', N'668868', 1, N'2 ngủ', 50000),
('S2-2411',  N'S2', N'135246#', 1, N'2 ngủ', 50000),
('S2-2811A', N'S2', N'281100', 0, N'2 ngủ', 50000),
('S2-2916',  N'S2', N'929268', 1, N'2 ngủ', 50000),
('S2-3301',  'S2', '333111',       0, N'2 ngủ', 50000),
('S2-3316',  'S2', '333366',       1, N'2 ngủ', 50000),
('S2-3411A', 'S2', '201099',       0, N'2 ngủ', 50000),
('S2-3501',  'S2', '350100',       0, N'2 ngủ', 50000),
('S2-3517',  'S2', '353568',       1, N'2 ngủ', 50000),
('S2-3608',  'S2', '363636',       0, N'2 ngủ', 50000),
('S2-3708',  'S2', '370800',       0, N'2 ngủ', 50000),
('S2-3811A', 'S2', '381100',       0, N'2 ngủ', 50000),
('S2-3816',  'S2', '383883',       1, N'2 ngủ', 50000),
('S2-3908',  'S2', '999888',       0, N'2 ngủ', 50000),
('S3-0715',  'S3', '071500',       0, N'2 ngủ', 50000),
('S3-0810',  'S3', '081000',       0, N'2 ngủ', 50000),
('S3-0908',  'S3', '999888',       0, N'2 ngủ', 50000),
('S3-1001',  'S3', '100100',       0, N'2 ngủ', 50000),
('S3-15A08A','S3', '150808',       0, N'2 ngủ', 50000),
('S3-1616',  'S3', '382838',       0, N'2 ngủ', 50000),
('S3-1701',  'S3', '240302',       0, N'2 ngủ', 50000),
('S3-1901',  'S3', '111119',       0, N'2 ngủ', 50000),
('S3-2301',  'S3', '230100',       0, N'2 ngủ', 50000),
('S3-3001',  'S3', '300100',       0, N'2 ngủ', 50000),
('S3-3015',  'S3', '305305',       1, N'2 ngủ', 50000),
('S3-3316',  'S3', '331600',       0, N'2 ngủ', 50000),
('S3-2406',  'S3', '240600',       0, N'3 ngủ', 70000),
('S3-2909',  'S3', '000999',       0, N'3 ngủ', 70000),
('S2-1220',  'S2', '111222',       0, N'3 ngủ', 70000),
('S2-3420',  'S2', '202002',       0, N'3 ngủ', 70000),
('S3-3702',  'S3', '370200',       0, N'3 ngủ', 70000),
('S3-3906',  'S3', '336699',       0, N'3 ngủ', 70000),
('B-2102',   'B',  '456456*',      0, N'3 ngủ', 70000),
('S2-2106',  'S2', '222111',       0, N'4 ngủ', 100000),
('S3-3918',  'S3', '838386',       0, N'4 ngủ', 100000);

MERGE Apartments AS target
USING @ApartmentSeed AS source
ON target.code = source.code
WHEN MATCHED THEN
    UPDATE SET
        target.building = source.building,
        target.password = source.password,
        target.is_samsung = source.is_samsung,
        target.room_type = source.room_type,
        target.default_cleaning_rate = source.default_cleaning_rate
WHEN NOT MATCHED BY TARGET THEN
    INSERT (code, building, password, is_samsung, room_type, default_cleaning_rate, status)
    VALUES (source.code, source.building, source.password, source.is_samsung, source.room_type, source.default_cleaning_rate, 'available');
GO

-- 5. Cập nhật các trạng thái hợp lệ cho WorkAssignments
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

-- 6. Thêm cột mới vào bảng Tasks nếu chưa có
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

-- 7. Tạo bảng Notifications nếu thiếu
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Notifications')
BEGIN
    CREATE TABLE Notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        message NVARCHAR(500) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

PRINT '✅ Migration complete with dynamic room rates!';
GO