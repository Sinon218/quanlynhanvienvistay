-- ===================================================================
-- MIGRATION: Cập nhật mức lương cố định cho nhân viên
-- Mức lương: 5,000,000 VND (tất cả), 7,000,000 VND (Lộc, Diệu)
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- 1. Cập nhật lương cơ bản cho TẤT CẢ nhân viên = 5,000,000
UPDATE Staff SET base_salary = 5000000, per_room_rate = 50000
WHERE name NOT IN (N'Lộc', N'Diệu');
GO

-- 2. Cập nhật lương cơ bản cho Lộc và Diệu = 7,000,000
UPDATE Staff SET base_salary = 7000000, per_room_rate = 50000
WHERE name IN (N'Lộc', N'Diệu');
GO

-- 3. Kiểm tra kết quả
SELECT id, name, type, base_salary, per_room_rate 
FROM Staff 
ORDER BY id;
GO

PRINT N'✅ Salary migration complete!';
GO