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
-- Trước tiên, thay đổi check constraint trên bảng Users
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

-- Tạo tài khoản loc nếu chưa có
IF NOT EXISTS (SELECT 1 FROM Users WHERE username = 'loc')
BEGIN
    DECLARE @LocStaffId INT;
    SELECT @LocStaffId = id FROM Staff WHERE name = N'Lộc';
    
    INSERT INTO Users (username, password_hash, role, staff_id, is_active)
    VALUES ('loc', '$2a$10$7Z8.c9vH5m.7Jp679jI2.OcIlgM6B8E/R91kZ9L.F8.718p7e3e3e', 'manager', @LocStaffId, 1);
END
ELSE
BEGIN
    -- Cập nhật role thành manager
    UPDATE Users SET role = 'manager' WHERE username = 'loc';
END
GO

-- Cập nhật tài khoản dieu thành manager
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

-- Chuyển các căn hộ đang ở trạng thái 'cleaning' về 'available'
UPDATE Apartments SET status = 'available' WHERE status = 'cleaning';
GO

ALTER TABLE Apartments ADD CONSTRAINT CK_Apartments_Status CHECK (status IN ('available', 'occupied', 'maintenance'));
GO

-- 4. Cập nhật check constraint trên bảng WorkAssignments để thêm 'approved'
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

PRINT '✅ Migration complete!';
GO
