-- ===================================================================
-- MIGRATION FIX TOÀN DIỆN: room_type + building
-- Ngày: 2026-07-28
-- Chạy file này trong SSMS
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- ===== BƯỚC 1: Reset TẤT CẢ về '2 ngủ' trước =====
UPDATE Apartments SET room_type = N'2 ngủ', default_cleaning_rate = 60000;
GO

-- ===== BƯỚC 2: Set '1 ngủ' — đúng danh sách bạn gửi =====
UPDATE Apartments SET room_type = N'1 ngủ', default_cleaning_rate = 30000
WHERE code IN (
    -- Tòa S1
    'S1-0405','S1-0505','S1-0905','S1-1105','S1-1605','S1-1705',
    'S1-1905','S1-2105','S1-2305','S1-2405','S1-2505','S1-2705','S1-3105',
    -- Tòa S2
    'S2-0610','S2-1110','S2-1111','S2-11A12','S2-1512','S2-1712',
    'S2-2512','S2-2810','S2-3210','S2-3612','S2-3810','S2-3812',
    -- Tòa S3
    'S3-0511','S3-1012','S3-15A12','S3-1811','S3-2012','S3-2412',
    'S3-2712','S3-2911','S3-3411','S3-3511','S3-3512',
    -- Royal City
    'R6A-0505','R6A-2806'
);
GO

-- ===== BƯỚC 3: Set '3 ngủ' — CHỈ 8 căn =====
UPDATE Apartments SET room_type = N'3 ngủ', default_cleaning_rate = 100000
WHERE code IN (
    'B-2102','S1-0508','S2-1220','S3-2406','S3-2909','S2-3420','S3-3702','S3-3906'
);
GO

-- ===== BƯỚC 4: Set '4 ngủ' — CHỈ 2 căn =====
UPDATE Apartments SET room_type = N'4 ngủ', default_cleaning_rate = 120000
WHERE code IN (
    'S2-2106','S3-3918'
);
GO

-- ===== BƯỚC 5: Chuyển R4, R5 sang HCM =====
UPDATE Apartments SET building = 'HCM' WHERE building IN ('R4', 'R5');
GO

-- ===== BƯỚC 6: Kiểm tra kết quả =====
SELECT room_type, COUNT(*) as so_luong
FROM Apartments
GROUP BY room_type
ORDER BY room_type;
GO

SELECT building, COUNT(*) as so_luong
FROM Apartments
GROUP BY building
ORDER BY building;
GO

PRINT N'✅ Fix hoàn tất!';
GO
