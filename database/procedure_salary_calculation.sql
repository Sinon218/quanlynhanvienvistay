-- ===================================================================
-- PROCEDURE: Tính toán và kết xuất tổng lương tháng của nhân viên
-- Quy trình: Lương thực nhận = Lương cơ bản + Tổng tiền dọn dẹp tích lũy
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- Sử dụng CREATE OR ALTER để tránh lỗi trùng lặp đối tượng khi chạy lại nhiều lần
CREATE OR ALTER PROCEDURE UpdateAndGetMonthlySalary
    @IdNhanVien INT,
    @Thang INT,
    @Nam INT
AS
BEGIN
    -- Thiết kế chế độ chặn đếm dòng vô hình để tối ưu tốc độ kết nối API
    SET NOCOUNT ON;

    DECLARE @TongTienDonPhong DECIMAL(12,0);
    DECLARE @LuongCoBan DECIMAL(12,0);

    -- 1. Tính tổng công dọn dẹp tích lũy từ bảng phân công WorkAssignments (Chỉ tính ca 'approved')
    SELECT @TongTienDonPhong = ISNULL(SUM(cleaning_bonus_received), 0) 
    FROM WorkAssignments 
    WHERE staff_id = @IdNhanVien 
      AND status = 'approved'
      AND MONTH(completed_at) = @Thang 
      AND YEAR(completed_at) = @Nam;

    -- 2. Truy vấn lấy mức lương cứng hiện tại của nhân viên trong bảng Staff
    SELECT @LuongCoBan = ISNULL(base_salary, 0) 
    FROM Staff 
    WHERE id = @IdNhanVien;

    -- 3. Xuất kết quả hoàn chỉnh (Cộng dồn tự động, kết quả chẵn khít)
    SELECT 
        @IdNhanVien AS StaffId,
        @Thang AS [ThangChot],
        @Nam AS [NamChot],
        @LuongCoBan AS LuongCoBan,
        @TongTienDonPhong AS TienDonPhongTichLuy,
        (@LuongCoBan + @TongTienDonPhong) AS TongLuongThucNhan;
END;
GO

PRINT N'✅ Stored Procedure [UpdateAndGetMonthlySalary] created/updated successfully!';
GO