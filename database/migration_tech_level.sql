-- ===================================================================
-- MIGRATION: Thêm cấp độ công việc kỹ thuật (tech_level, tech_price)
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- 1. Thêm các cột kỹ thuật vào Tasks nếu chưa có
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

-- 2. Cập nhật check constraint status của Tasks
DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('Tasks') AND definition LIKE '%status%';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Tasks DROP CONSTRAINT ' + @ConstraintName);
END
GO

ALTER TABLE Tasks ADD CONSTRAINT CK_Tasks_Status CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'rejected', 'approved'));
GO

-- 3. Tạo bảng lưu cấu hình bảng giá cố định theo số SAO kỹ thuật (1* đến 4*)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TechPriceConfig')
BEGIN
    CREATE TABLE TechPriceConfig (
        tech_level INT PRIMARY KEY CHECK (tech_level IN (1, 2, 3, 4)),
        level_name NVARCHAR(50) NOT NULL,
        price DECIMAL(10,0) NOT NULL
    );

    -- Nạp luôn bảng giá cố định làm mẫu
    INSERT INTO TechPriceConfig (tech_level, level_name, price) VALUES
    (1, N'1* - Dễ', 50000),
    (2, N'2* - Trung bình', 120000),
    (3, N'3* - Khó', 250000),
    (4, N'4* - Cực khó', 500000);
END
GO

PRINT N'✅ Migration tech_level & TechPriceConfig complete!';
GO