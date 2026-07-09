-- ===================================================================
-- DASHBOARD: Báo Cáo Trạng Thái Phòng Và Bảng Lương Nhân Viên
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

PRINT N'===================================================================';
PRINT N'   📊 HỆ THỐNG BÁO CÁO DỮ LIỆU VISTAY - THỜI GIAN THỰC (REALTIME)   ';
PRINT N'===================================================================';
GO

-- ==========================================
-- BÁO CÁO 1: KIỂM TRA TRẠNG THÁI PHÒNG (Trống hay Có khách)
-- ==========================================
PRINT N'👉 1. DANH SÁCH TRẠNG THÁI CÁC CĂN HỘ CURRENTLY';

SELECT 
    code AS [Mã Căn Hộ],
    building AS [Tòa Nhà],
    room_type AS [Loại Phòng],
    CASE 
        WHEN status = 'available' THEN N'🟢 Còn trống (Sẵn sàng đón khách)'
        WHEN status = 'occupied' THEN N'🔴 Đang có khách ở'
        WHEN status = 'maintenance' THEN N'🛠️ Đang bảo trì/Sửa chữa'
        ELSE status
    END AS [Trạng Thái Hiện Tại],
    password AS [Mật Khẩu Phòng]
FROM Apartments
ORDER BY building, code;
GO


-- ==========================================
-- BÁO CÁO 2: BẢNG LƯƠNG NHÂN VIÊN TỰ ĐỘNG CỘNG DỒN SAU MỖI CA HOÀN THÀNH
-- ==========================================
PRINT N'👉 2. BẢNG LƯƠNG NHÂN VIÊN (Đã tự động cộng dồn tiền dọn phòng sau mỗi ca)';

SELECT 
    s.id AS [Mã NV],
    s.name AS [Tên Nhân Viên],
    s.type AS [Hình Thức],
    FORMAT(ISNULL(s.base_salary, 0), '##,##0 VNĐ') AS [Lương Cứng],
    
    -- Đếm tổng số ca dọn dẹp bất kỳ loại phòng nào đã được duyệt hoàn thành
    (SELECT COUNT(*) FROM WorkAssignments wa 
     WHERE wa.staff_id = s.id AND wa.status = 'approved') AS [Số Ca Đã Dọn],
     
    -- Tự động cộng dồn số tiền dọn phòng thực tế thu được từ cột cleaning_bonus_received
    FORMAT(ISNULL((
        SELECT SUM(cleaning_bonus_received) 
        FROM WorkAssignments wa 
        WHERE wa.staff_id = s.id AND wa.status = 'approved'
    ), 0), '##,##0 VNĐ') AS [Tiền Dọn Phòng Tích Lũy],

    -- Tổng lương thực tế tại thời điểm hiện tại = Lương cứng + Tiền dọn phòng tích lũy
    FORMAT(ISNULL(s.base_salary, 0) + ISNULL((
        SELECT SUM(cleaning_bonus_received) 
        FROM WorkAssignments wa 
        WHERE wa.staff_id = s.id AND wa.status = 'approved'
    ), 0), '##,##0 VNĐ') AS [TỔNG LƯƠNG THỰC NHẬN]
FROM Staff s
ORDER BY s.id;
GO


-- ==========================================
-- BÁO CÁO 3: THỐNG KÊ BIỂU GIÁ DỌN DẸP TRONG DATABASE
-- (Hiện tại giá dọn Out/Lưu đang để theo cấu hình chẵn tiền bạn chốt)
-- ==========================================
PRINT N'👉 3. BIỂU GIÁ CẤU HÌNH DỌN DẸP TRONG HỆ THỐNG';

SELECT 
    room_type AS [Loại Căn Hộ],
    FORMAT(default_cleaning_rate, '##,##0 VNĐ') AS [Giá Dọn Gốc (Tạm Tính)],
    COUNT(*) AS [Tổng Số Lượng Căn]
FROM Apartments
GROUP BY room_type, default_cleaning_rate
ORDER BY default_cleaning_rate;
GO