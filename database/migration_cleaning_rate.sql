-- ===================================================================
-- MIGRATION: Bổ sung cột lưu tiền dọn dẹp thực tế theo ca làm
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- 1. Thêm cột_cleaning_bonus_received vào bảng WorkAssignments nếu chưa có
-- Cột này sẽ lưu số tiền chẵn (ví dụ: 15000, 20000, 40000) sau khi App chạy thuật toán chia điểm
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('WorkAssignments') AND name = 'cleaning_bonus_received')
BEGIN
    ALTER TABLE WorkAssignments ADD cleaning_bonus_received DECIMAL(10,0) NULL DEFAULT 0;
    PRINT N'✅ Đã thêm cột cleaning_bonus_received vào bảng WorkAssignments thành công!';
END
ELSE 
BEGIN
    PRINT N'ℹ️ Cột cleaning_bonus_received đã tồn tại từ trước.';
END
GO

-- 2. Xem thử cấu hình bảng sau khi cập nhật
SELECT TOP 1 id, staff_id, apartment_id, task_type, cleaning_bonus_received, status 
FROM WorkAssignments;
GO