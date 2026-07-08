USE ungdungquanlynhanvienvistay;
GO

-- Đổi chữ CREATE thành ALTER ở đây
ALTER PROCEDURE UpdateAndGetMonthlySalary
    @IdNhanVien INT,
    @Thang INT,
    @Nam INT
AS
BEGIN
    DECLARE @TongTienDonPhong DECIMAL(12,0);
    DECLARE @LuongCoBan DECIMAL(12,0);

    -- 1. Lấy tổng tiền dọn dẹp từ bảng WorkAssignments
    SELECT @TongTienDonPhong = ISNULL(SUM(cleaning_bonus_received), 0) 
    FROM WorkAssignments 
    WHERE staff_id = @IdNhanVien 
      AND status = 'approved'
      AND MONTH(completed_at) = @Thang 
      AND YEAR(completed_at) = @Nam;

    -- 2. Lấy lương cơ bản của nhân viên
    SELECT @LuongCoBan = ISNULL(base_salary, 0) FROM Staff WHERE id = @IdNhanVien;

    -- 3. Trả về bảng tính toán hoàn chỉnh
    SELECT 
        @IdNhanVien AS StaffId,
        @LuongCoBan AS LuongCoBan,
        @TongTienDonPhong AS TienDonPhongTichLuy,
        (@LuongCoBan + @TongTienDonPhong) AS TongLuongThucNhan;
END;
GO