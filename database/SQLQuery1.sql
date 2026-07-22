-- ===================================================================
-- MASTER SCRIPT (FIX LỖI CK_WorkAssignments_Status)
-- Dự án: Ungdungquanlynhanvienvistay
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

PRINT N'===================================================================';
PRINT N'⚙️ BƯỚC 1: CẬP NHẬT RÀNG BUỘC CHECK (TASK_TYPE & STATUS)';
PRINT N'===================================================================';
GO

-- 1. Tự động xóa CHECK constraint cũ trên cột task_type nếu có
DECLARE @ConstraintTaskType NVARCHAR(200);
SELECT @ConstraintTaskType = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('WorkAssignments') 
  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('WorkAssignments'), 'task_type', 'ColumnId');

IF @ConstraintTaskType IS NOT NULL
BEGIN
    EXEC('ALTER TABLE WorkAssignments DROP CONSTRAINT ' + @ConstraintTaskType);
    PRINT N'✅ Đã xóa ràng buộc CHECK cũ trên cột task_type.';
END
GO

-- Nâng cấp CHECK constraint mới cho task_type
ALTER TABLE WorkAssignments 
ADD CONSTRAINT CK_WorkAssignments_TaskType 
CHECK (task_type IN ('Luu', 'Out', 'DeepClean', 'cleaning', 'maintenance', 'inspection'));
GO


-- 2. Tự động xóa CHECK constraint cũ trên cột status nếu có
DECLARE @ConstraintStatus NVARCHAR(200);
SELECT @ConstraintStatus = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('WorkAssignments') 
  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('WorkAssignments'), 'status', 'ColumnId');

IF @ConstraintStatus IS NOT NULL
BEGIN
    EXEC('ALTER TABLE WorkAssignments DROP CONSTRAINT ' + @ConstraintStatus);
    PRINT N'✅ Đã xóa ràng buộc CHECK cũ trên cột status.';
END
GO

-- Nâng cấp CHECK constraint mới cho status linh hoạt hơn
ALTER TABLE WorkAssignments 
ADD CONSTRAINT CK_WorkAssignments_Status 
CHECK (status IN ('pending', 'in_progress', 'completed', 'approved', 'rejected', 'cancelled'));
PRINT N'✅ Đã cập nhật CHECK Constraint mới cho cột status!';
GO

-- 3. Chuẩn hóa giá dọn phòng 3 ngủ về đúng 100.000 VNĐ
UPDATE Apartments 
SET default_cleaning_rate = 100000 
WHERE room_type = N'3 ngủ' AND default_cleaning_rate <> 100000;
PRINT N'✅ Đã đồng bộ giá phòng 3 ngủ về 100.000 VNĐ.';
GO


PRINT N'===================================================================';
PRINT N'📦 BƯỚC 2: BƠM DỮ LIỆU CA DỌN DẸP MẪU (WORK ASSIGNMENTS)';
PRINT N'===================================================================';
GO

-- Xóa dữ liệu cũ nếu chưa hoàn chỉnh để bơm lại bộ mẫu chuẩn
IF NOT EXISTS (SELECT 1 FROM WorkAssignments WHERE status = 'approved')
BEGIN
    DELETE FROM WorkAssignments; -- Xóa sạch ca lỗi trước đó
    
    INSERT INTO WorkAssignments (apartment_id, staff_id, task_type, cleaning_bonus_received, status, completed_at)
    VALUES 
    -- Ca 1: Chị Liên dọn căn S1-0405 (Lưu) -> Tiền công 30k
    (1, 1, 'Luu', 30000, 'approved', GETDATE()),
    
    -- Ca 2: Chị Liên dọn căn S2-0401 (Out) -> Tiền công 90k
    (17, 1, 'Out', 90000, 'approved', GETDATE()),
    
    -- Ca 3: Chị Vân dọn căn S1-2405A (Out) -> Tiền công 60k
    (12, 4, 'Out', 60000, 'approved', GETDATE()),
    
    -- Ca 4: Chị Diệu dọn căn S3-0511 (Lưu) -> Đang dọn
    (53, 5, 'Luu', 30000, 'in_progress', NULL);

    PRINT N'✅ Bơm dữ liệu ca dọn dẹp mẫu THÀNH CÔNG 100%!';
END
ELSE
BEGIN
    PRINT N'ℹ️ Bảng WorkAssignments đã có dữ liệu chuẩn sẵn.';
END
GO


PRINT N'===================================================================';
PRINT N'📊 BƯỚC 3: KẾT XUẤT TRỌN BỘ BÁO CÁO BUỒNG PHÒNG REALTIME';
PRINT N'===================================================================';
GO

-- BÁO CÁO 1: DANH SÁCH TẤT CẢ CĂN HỘ, LOẠI PHÒNG & MẬT KHẨU CỬA
SELECT 
    code AS [Mã Căn Hộ],
    building AS [Tòa],
    room_type AS [Loại Phòng],
    password AS [Mật Khẩu Cửa],
    CASE 
        WHEN status = 'available' THEN N'🟢 Trống (Sẵn sàng đón)'
        WHEN status = 'occupied' THEN N'🔴 Đang có khách ở'
        WHEN status = 'maintenance' THEN N'🛠️ Đang bảo trì'
        ELSE status
    END AS [Trạng Thái Phòng]
FROM Apartments
ORDER BY building, code;
GO

-- BÁO CÁO 2: LỊCH PHÂN CÔNG VÀ TIẾN ĐỘ DỌN DẸP CHI TIẾT
SELECT 
    wa.id AS [Mã Ca],
    s.name AS [Nhân Viên Dọn],
    a.code AS [Mã Căn Hộ],
    a.building AS [Tòa],
    a.room_type AS [Loại Phòng],
    a.password AS [Mật Khẩu Cửa],
    wa.task_type AS [Loại Ca (Lưu/Out)],
    FORMAT(ISNULL(wa.cleaning_bonus_received, 0), '##,##0 VNĐ') AS [Tiền Công Ca],
    CASE 
        WHEN wa.status = 'pending' THEN N'⏳ Đang chờ dọn'
        WHEN wa.status = 'in_progress' THEN N'🧹 Đang dọn dẹp'
        WHEN wa.status = 'completed' THEN N'📸 Đã dọn xong (Chờ duyệt)'
        WHEN wa.status = 'approved' THEN N'✅ Đã duyệt (Đã cộng tiền)'
        ELSE wa.status
    END AS [Trạng Thái Dọn]
FROM WorkAssignments wa
JOIN Staff s ON wa.staff_id = s.id
JOIN Apartments a ON wa.apartment_id = a.id
ORDER BY wa.id DESC;
GO

-- BÁO CÁO 3: BẢNG TỔNG HỢP LƯƠNG & TIỀN CÔNG TÍCH LŨY CỦA BUỒNG PHÒNG
SELECT 
    s.id AS [Mã NV],
    s.name AS [Tên Nhân Viên],
    s.type AS [Hình Thức],
    FORMAT(ISNULL(s.base_salary, 0), '##,##0 VNĐ') AS [Lương Cứng],
    COUNT(CASE WHEN wa.status = 'approved' THEN wa.id END) AS [Số Ca Đã Dọn],
    FORMAT(ISNULL(SUM(CASE WHEN wa.status = 'approved' THEN wa.cleaning_bonus_received ELSE 0 END), 0), '##,##0 VNĐ') AS [Tiền Dọn Phòng Tích Lũy],
    FORMAT(ISNULL(s.base_salary, 0) + ISNULL(SUM(CASE WHEN wa.status = 'approved' THEN wa.cleaning_bonus_received ELSE 0 END), 0), '##,##0 VNĐ') AS [TỔNG LƯƠNG THỰC NHẬN]
FROM Staff s
LEFT JOIN WorkAssignments wa ON s.id = wa.staff_id
WHERE s.room_role = 1
GROUP BY s.id, s.name, s.type, s.base_salary
ORDER BY s.id;
GO