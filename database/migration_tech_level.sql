-- ===================================================================
-- MIGRATION: Thêm cấp độ công việc kỹ thuật (tech_level, tech_price)
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- 1. Thêm cột tech_level vào bảng Tasks (1=Dễ, 2=Trung bình, 3=Khó, 4=Cực khó)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'tech_level')
BEGIN
    ALTER TABLE Tasks ADD tech_level INT NULL;
END
GO

-- 2. Thêm cột tech_price vào bảng Tasks (giá tiền tương ứng cấp độ)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'tech_price')
BEGIN
    ALTER TABLE Tasks ADD tech_price DECIMAL(10,0) NULL;
END
GO

-- 3. Thêm cột reject_reason vào bảng Tasks nếu chưa có
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'reject_reason')
BEGIN
    ALTER TABLE Tasks ADD reject_reason NVARCHAR(500) NULL;
END
GO

-- 4. Cập nhật check constraint trên bảng Tasks để thêm 'approved'
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

PRINT N'✅ Migration tech_level complete!';
GO
